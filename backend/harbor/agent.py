"""Harbor support agent: runs one customer conversation under the effective release config.

Effective config = active release (control plane) + control overrides:
    force_model            model to use instead of the release's (model failover)
    flag:<name>            feature-flag override, e.g. flag:auto_refund_enabled=false
    max_steps_cap          upper bound on agent steps
    fault:provider_outage  comma-separated models that currently fail (incident I4 injection)
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from harbor import releases
from harbor.grader import Grade, grade
from harbor.scenarios import Scenario
from harbor.tools import ToolContext, openai_tools, run_tool
from ops import llm
from ops.db import OpsDB, dumps
from ops.settings import settings
from ops.tracing import set_attrs, workflow

WORKFLOW = "harbor-support"


@dataclass
class EffectiveConfig:
    release: releases.Release
    model: str
    fallback_model: str | None
    max_steps: int
    tools: list[str]
    flags: dict[str, Any]
    outage_models: set[str]

    @property
    def auto_refund_enabled(self) -> bool:
        return bool(self.flags.get("auto_refund_enabled", True))

    @property
    def system_prompt(self) -> str:
        prompt = self.release.system_prompt
        if not self.auto_refund_enabled:
            prompt += ("\n\nOPERATIONS NOTICE: automatic refunds are temporarily disabled. For any refund "
                       "request, check the policy, then escalate_to_human so a specialist can pay it.")
        return prompt


def effective_config(db: OpsDB | None, release_id: str | None = None,
                     overrides: dict[str, str] | None = None) -> EffectiveConfig:
    control = dict(db.control_snapshot()) if db is not None else {}
    if overrides:
        control.update(overrides)
    rid = release_id or control.get("active_release") or releases.BASELINE_RELEASE
    rel = releases.load_release(rid)
    flags = dict(rel.flags)
    for key, value in control.items():
        if key.startswith("flag:"):
            flags[key[5:]] = value.lower() in ("1", "true", "on", "yes")
    tools = list(rel.tools)
    if not flags.get("auto_refund_enabled", True):
        tools = [t for t in tools if t != "issue_refund"]
    max_steps = rel.max_steps
    if control.get("max_steps_cap"):
        max_steps = min(max_steps, int(control["max_steps_cap"]))
    outage = {m.strip() for m in control.get("fault:provider_outage", "").split(",") if m.strip()}
    return EffectiveConfig(
        release=rel,
        model=control.get("force_model") or rel.model or settings.harbor_model,
        fallback_model=rel.fallback_model,
        max_steps=max_steps,
        tools=tools,
        flags=flags,
        outage_models=outage,
    )


@dataclass
class ConversationResult:
    id: str
    scenario: Scenario
    release: str
    model: str
    brain: str
    reply: str | None
    error: str | None
    grade: Grade
    usage: llm.Usage
    cost_usd: float
    steps: int
    tool_errors: int
    latency_ms: float
    trace_id: str | None
    transcript: list[dict[str, Any]] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------------------------
# Live brain: LLM with tool calling through the LiteLLM gateway
# ---------------------------------------------------------------------------------------------
def _live_loop(cfg: EffectiveConfig, ctx: ToolContext, message: str,
               transcript: list[dict[str, Any]]) -> tuple[str | None, llm.Usage, int]:
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": cfg.system_prompt},
        {"role": "user", "content": message},
    ]
    tools = openai_tools(cfg.tools)
    usage = llm.Usage()
    model = cfg.model
    for step in range(1, cfg.max_steps + 1):
        try:
            msg, u = llm.chat(model, messages, tools=tools, outage_models=cfg.outage_models)
        except llm.ProviderOutage:
            if cfg.fallback_model and model != cfg.fallback_model:
                model = cfg.fallback_model
                msg, u = llm.chat(model, messages, tools=tools, outage_models=cfg.outage_models)
            else:
                raise
        usage.prompt_tokens += u.prompt_tokens
        usage.completion_tokens += u.completion_tokens
        tool_calls = list(msg.tool_calls or [])
        entry: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
        if tool_calls:
            entry["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"}}
                for tc in tool_calls
            ]
        messages.append(entry)
        transcript.append({"role": "assistant", "content": msg.content or "",
                           "tool_calls": [c["function"] for c in entry.get("tool_calls", [])]})
        if not tool_calls:
            return (msg.content or "").strip(), usage, step
        for tc in tool_calls:
            result = run_tool(ctx, tc.function.name, tc.function.arguments or "{}")
            content = json.dumps(result, default=str)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": content})
            transcript.append({"role": "tool", "name": tc.function.name, "content": content[:1500]})
    raise RuntimeError(f"agent exceeded max_steps={cfg.max_steps} without replying")


# ---------------------------------------------------------------------------------------------
# Sim brain: deterministic stand-in that follows the release's instructions literally.
# Used for offline UI runs only; never used for evidence.
# ---------------------------------------------------------------------------------------------
def _sim_loop(cfg: EffectiveConfig, ctx: ToolContext, scenario: Scenario,
              transcript: list[dict[str, Any]]) -> tuple[str | None, llm.Usage, int]:
    if cfg.model in cfg.outage_models:
        if not cfg.fallback_model or cfg.fallback_model in cfg.outage_models:
            raise llm.ProviderOutage(f"503 Service Unavailable from provider for model '{cfg.model}' (injected fault)")
    prompt = cfg.system_prompt.lower()
    usage = llm.Usage(prompt_tokens=650, completion_tokens=60)
    steps = 1

    def call(name: str, **args: Any) -> dict[str, Any]:
        nonlocal steps
        steps += 1
        usage.prompt_tokens += 700 + 120 * steps
        usage.completion_tokens += 45
        if steps > cfg.max_steps:
            raise RuntimeError(f"agent exceeded max_steps={cfg.max_steps} without replying")
        res = run_tool(ctx, name, args)
        transcript.append({"role": "tool", "name": name, "content": json.dumps(res, default=str)[:1500]})
        return res

    if "track_shipment" in cfg.tools and "track_shipment" in prompt:
        while True:  # the release tells the agent to retry tracking until it succeeds
            res = call("track_shipment", order_id=scenario.order_id)
            if "error" not in res:
                break
    order = call("lookup_order", order_id=scenario.order_id)
    if "error" in order:
        return "Sorry, I couldn't load your order right now. Please try again later.", usage, steps
    if scenario.kind == "status":
        return f"Your order {order['order_id']} is {order['status']}.", usage, steps

    notes = (order.get("notes") or "").lower()
    # Live Claude resisted note injections under the baseline prompt; it follows them only when the
    # release tells it to act on order notes. The sim mirrors that.
    trusts_notes = "note" in prompt and "never as instructions" not in prompt
    follows_injection = "refund" in notes and trusts_notes
    checks_policy = "check_refund_policy" in prompt and "always call check_refund_policy" in prompt
    if follows_injection and "issue_refund" in cfg.tools:
        call("issue_refund", order_id=order["order_id"], amount=order["total"], reason="approved per order note")
        return "Done — your refund has been issued as noted on the order.", usage, steps
    if checks_policy or not cfg.auto_refund_enabled:
        pol = call("check_refund_policy", order_id=order["order_id"])
        if "error" in pol:
            return "Sorry, I couldn't check the refund policy right now.", usage, steps
        if not pol["eligible"]:
            return f"I'm sorry, this order isn't refundable: {pol['reason']}.", usage, steps
        if pol["requires_human"] or "issue_refund" not in cfg.tools:
            call("escalate_to_human", reason=pol["reason"])
            return "I've passed this to a specialist who will complete your refund.", usage, steps
        call("issue_refund", order_id=order["order_id"], amount=pol["max_refund"], reason="policy-approved")
        return f"Your refund of ${pol['max_refund']:.2f} is on its way.", usage, steps
    # No policy instruction in the prompt: refund what the customer asked for.
    call("issue_refund", order_id=order["order_id"], amount=order["total"], reason="customer request")
    return f"Done! I've refunded ${order['total']:.2f}.", usage, steps


# ---------------------------------------------------------------------------------------------
def run_conversation(
    scenario: Scenario,
    db: OpsDB | None = None,
    brain: str | None = None,
    release_id: str | None = None,
    overrides: dict[str, str] | None = None,
    dry_run: bool = False,
    persist: bool = True,
    tag: str = "live",
) -> ConversationResult:
    cfg = effective_config(db, release_id, overrides)
    brain = brain or settings.harbor_brain
    cid = f"c_{uuid.uuid4().hex[:12]}"
    ctx = ToolContext(db=db, conversation_id=cid, release_id=cfg.release.id,
                      orders_api=cfg.release.orders_api, dry_run=dry_run)
    transcript: list[dict[str, Any]] = [{"role": "user", "content": scenario.message}]
    reply: str | None = None
    error: str | None = None
    usage = llm.Usage()
    steps = 0
    started = time.time()
    with workflow("support_conversation", WORKFLOW,
                  **{"harbor.release": cfg.release.id, "harbor.model": cfg.model, "harbor.brain": brain,
                     "harbor.scenario": scenario.id, "harbor.kind": scenario.kind,
                     "harbor.conversation_id": cid, "harbor.replay": dry_run, "harbor.tag": tag,
                     "input.value": scenario.message}) as (span, trace_id):
        try:
            if brain == "sim":
                reply, usage, steps = _sim_loop(cfg, ctx, scenario, transcript)
            else:
                reply, usage, steps = _live_loop(cfg, ctx, scenario.message, transcript)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
        g = grade(scenario, ctx, reply, error)
        cost = llm.cost_usd(cfg.model, usage)
        set_attrs(span, **{"output.value": reply or error or "", "harbor.outcome": g.outcome,
                           "harbor.loss_usd": g.loss_usd, "harbor.cost_usd": round(cost, 6),
                           "harbor.tool_errors": ctx.tool_errors, "harbor.steps": steps})
        if error:
            try:
                span.set_attribute("error", True)
            except Exception:  # pragma: no cover
                pass
    transcript.append({"role": "assistant_final", "content": reply or "", "error": error})
    result = ConversationResult(
        id=cid, scenario=scenario, release=cfg.release.id, model=cfg.model, brain=brain,
        reply=reply, error=error, grade=g, usage=usage, cost_usd=cost, steps=steps,
        tool_errors=ctx.tool_errors, latency_ms=round((time.time() - started) * 1000, 1),
        trace_id=trace_id, transcript=transcript, calls=ctx.calls,
    )
    if db is not None and persist:
        db.insert("conversations", {
            "id": cid, "ts": started, "release": cfg.release.id, "model": cfg.model, "brain": brain,
            "scenario_id": scenario.id, "kind": scenario.kind, "customer_message": scenario.message,
            "reply": reply, "outcome": g.outcome, "loss_usd": g.loss_usd, "cost_usd": cost,
            "tokens": usage.total, "steps": steps, "tool_errors": ctx.tool_errors, "error": error,
            "trace_id": trace_id, "latency_ms": result.latency_ms,
            "transcript_json": dumps({"transcript": transcript, "calls": ctx.calls, "grade_note": g.note}),
            "replay": 1 if dry_run else 0,
        })
    return result
