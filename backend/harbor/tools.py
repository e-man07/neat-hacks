"""Harbor's tools. Each call is a neatlogs TOOL span and is recorded in the conversation context.

`issue_refund` moves money (writes to the ledger) unless the context is a dry run (replays).
"""

from __future__ import annotations

import json
import time
import zlib
from dataclasses import dataclass, field
from typing import Any

from harbor import adapters, orders_service, policy
from ops.db import OpsDB
from ops.tracing import child, set_attrs

TOOL_SPECS: dict[str, dict[str, Any]] = {
    "lookup_order": {
        "description": "Look up an order by id (format H-1234). Returns status, items, total and delivery info.",
        "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]},
    },
    "check_refund_policy": {
        "description": "Check whether an order is eligible for a refund and the maximum refundable amount.",
        "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]},
    },
    "issue_refund": {
        "description": "Refund money to the customer for an order. This moves money and cannot be undone.",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "amount": {"type": "number", "description": "Amount in USD"},
                "reason": {"type": "string"},
            },
            "required": ["order_id", "amount", "reason"],
        },
    },
    "escalate_to_human": {
        "description": "Hand the conversation to a human support specialist with a short reason.",
        "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": ["reason"]},
    },
    "track_shipment": {
        "description": "Get live carrier tracking for an order.",
        "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]},
    },
}


def openai_tools(names: list[str]) -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": n, **TOOL_SPECS[n]}} for n in names if n in TOOL_SPECS]


@dataclass
class ToolContext:
    db: OpsDB | None
    conversation_id: str
    release_id: str
    orders_api: str = "v1"
    dry_run: bool = False
    refunds: list[dict[str, Any]] = field(default_factory=list)
    escalations: list[str] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)
    tool_errors: int = 0
    policy_checked: set[str] = field(default_factory=set)
    tracking_attempts: int = 0


def _lookup(ctx: ToolContext, order_id: str) -> dict[str, Any]:
    return adapters.get_adapter(ctx.orders_api)(order_id)


def _do(ctx: ToolContext, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "lookup_order":
        return _lookup(ctx, args["order_id"])
    if name == "check_refund_policy":
        order = _lookup(ctx, args["order_id"])
        ctx.policy_checked.add(order["order_id"])
        return {"order_id": order["order_id"], **policy.evaluate(order)}
    if name == "issue_refund":
        amount = round(float(args["amount"]), 2)
        order_id = str(args["order_id"]).strip().upper()
        if order_id not in orders_service.ORDERS:
            raise orders_service.OrderNotFound(order_id)
        refund = {"order_id": order_id, "amount": amount, "reason": args.get("reason", "")}
        ctx.refunds.append(refund)
        if ctx.db is not None and not ctx.dry_run:
            ctx.db.insert("ledger", {"ts": time.time(), "order_id": order_id, "amount": amount,
                                     "reason": refund["reason"], "conversation_id": ctx.conversation_id,
                                     "release": ctx.release_id})
        return {"status": "refunded", "order_id": order_id, "amount": amount,
                "dry_run": ctx.dry_run}
    if name == "escalate_to_human":
        reason = str(args.get("reason", ""))
        ctx.escalations.append(reason)
        if ctx.db is not None and not ctx.dry_run:
            ctx.db.insert("tickets", {"ts": time.time(), "conversation_id": ctx.conversation_id, "reason": reason})
        return {"status": "escalated", "ticket": f"T-{zlib.crc32(ctx.conversation_id.encode()) % 100000:05d}"}
    if name == "track_shipment":
        ctx.tracking_attempts += 1
        return orders_service.get_tracking(args["order_id"], attempt_seed=zlib.crc32(f"{ctx.conversation_id}:{ctx.tracking_attempts}".encode()))
    raise ValueError(f"unknown tool {name}")


def run_tool(ctx: ToolContext, name: str, raw_args: str | dict[str, Any]) -> dict[str, Any]:
    """Execute one tool call inside a TOOL span. Errors are returned to the model, not raised."""
    try:
        args = raw_args if isinstance(raw_args, dict) else json.loads(raw_args or "{}")
    except json.JSONDecodeError:
        args = {}
    started = time.time()
    with child(name, kind="TOOL", **{"neatlogs.tool.name": name, "neatlogs.tool.input": json.dumps(args)}) as span:
        try:
            result = _do(ctx, name, args)
            ok = True
        except Exception as exc:  # tool failures are data for the model and for Nightly
            ctx.tool_errors += 1
            result = {"error": f"{type(exc).__name__}: {exc}"}
            ok = False
            try:
                span.set_attribute("error", True)
                span.set_attribute("neatlogs.tool.error", result["error"])
            except Exception:  # pragma: no cover
                pass
        set_attrs(span, **{"neatlogs.tool.output": json.dumps(result, default=str)[:4000]})
    ctx.calls.append({"tool": name, "args": args, "ok": ok, "result": result,
                      "ms": round((time.time() - started) * 1000, 1)})
    return result
