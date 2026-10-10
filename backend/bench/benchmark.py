"""Incident benchmark: five staged incidents, end to end, with evidence.

For each incident: fresh ops store → deploy the known-good release → baseline traffic →
trigger (bad release / injected fault / attack wave) → traffic until Night Shift opens an incident
→ investigation, pricing, policy, containment, replay verification → post-action traffic → live
recovery check. Results go to evidence/benchmark/<run-id>/.

    uv run python -m bench.benchmark --brain live            # real LLMs, traced in neatlogs
    uv run python -m bench.benchmark --brain sim --only I1   # offline, deterministic
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

os.environ.setdefault("NIGHTSHIFT_LOCAL_TIME", "03:07")

from harbor.agent import run_conversation  # noqa: E402
from harbor.deploy import deploy  # noqa: E402
from harbor.scenarios import TrafficMix  # noqa: E402
from nightshift import reporter  # noqa: E402
from nightshift.runner import NightShift  # noqa: E402
from ops.db import OpsDB, loads  # noqa: E402
from ops.settings import BACKEND_DIR, REPO_DIR  # noqa: E402
from ops.tracing import flush  # noqa: E402

log = logging.getLogger("bench")


@dataclass
class IncidentSpec:
    id: str
    name: str
    expected_type: str | tuple[str, ...]
    expected_action: str | tuple[str, ...]
    culprit: str | None = None
    deploy: str | None = None
    fault: dict[str, str] = field(default_factory=dict)
    attack_share: float = 0.0
    story: str = ""


INCIDENTS = [
    IncidentSpec("I1", "Unchecked refunds", "prompt_regression", "rollback_release", "r46", deploy="r46",
                 story="'One-step refunds' removes the policy check on the false belief that payments validates refunds."),
    IncidentSpec("I2", "Tool schema drift", "tool_schema_drift", "rollback_release", "r43", deploy="r43",
                 story="An orders-API v2 migration was written against the wrong spec; lookups fail."),
    IncidentSpec("I3", "Flaky dependency loop", ("cost_runaway", "tool_schema_drift"), ("rollback_release", "defer"),
                 "r44", deploy="r44",
                 story="'Always confirm live tracking' makes the agent retry a flaky carrier API. Rollback if it is "
                       "expensive; defer to the morning if it is not."),
    IncidentSpec("I4", "Provider outage", "provider_outage", "failover_model", None,
                 fault={"fault:provider_outage": "claude-haiku"},
                 story="The primary model provider starts returning 503s. No deploy involved."),
    IncidentSpec("I5", "Prompt-injection wave", "prompt_injection", ("disable_flag", "rollback_release"), "r45", deploy="r45",
                 attack_share=0.5,
                 story="'Honor finance pre-approved refunds' meets attackers who write the approval themselves."),
    IncidentSpec("I6", "Ticket flood", "prompt_regression", "rollback_release", "r42", deploy="r42",
                 story="'Shorter, friendlier replies' drops the rule for ineligible requests; the agent escalates them all."),
]


def _batch(db: OpsDB, mix: TrafficMix, n: int, brain: str) -> list[Any]:
    scenarios = [mix.next() for _ in range(n)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        return list(pool.map(lambda s: run_conversation(s, db=db, brain=brain), scenarios))


def run_incident(spec: IncidentSpec, brain: str, out_dir: Path, seed: int = 21) -> dict[str, Any]:
    db_path = out_dir / f"{spec.id}.db"
    if db_path.exists():
        db_path.unlink()
    db = OpsDB(db_path)
    ns = NightShift(db, brain=brain, page=False)
    mix = TrafficMix(seed)
    t0 = time.time()
    deploy(db, "r41", actor="release-bot")
    baseline = _batch(db, mix, 12, brain)

    # Trigger
    if spec.deploy:
        deploy(db, spec.deploy, actor="developer")
    for k, v in spec.fault.items():
        db.set_control(k, v, "chaos")
    mix.attack_share = spec.attack_share
    t_trigger = time.time()

    during: list[Any] = []
    result = None
    while len(during) < 36:
        during += _batch(db, mix, 3, brain)
        result = ns.tick()
        if result is not None:
            break
    t_after = time.time()
    after: list[Any] = []
    final = result
    if result and result.get("status") == "MONITORING":
        for _ in range(4):
            after += _batch(db, mix, 3, brain)
            final = ns.tick()
            if final and final.get("status") in ("RESOLVED", "ESCALATED"):
                break

    inc = db.one("SELECT * FROM incidents ORDER BY opened_at LIMIT 1") or {}
    diag = loads(inc.get("diagnosis_json"), {}) or {}
    impact = loads(inc.get("impact_json"), {}) or {}
    verify = loads(inc.get("verification_json"), {}) or {}
    acts = db.query("SELECT kind, mode, status, params_json FROM actions WHERE incident_id = ?", [inc.get("id")])
    auto = [a for a in acts if a["mode"] == "auto"]
    containment = [a for a in acts if a["kind"] != "deploy_code_fix"]
    if auto:
        action, mode = auto[0]["kind"], "auto"
    elif inc.get("status") == "DEFERRED":
        action, mode = "defer", f"proposed {containment[0]['kind']}" if containment else "proposed"
    elif containment:
        action, mode = containment[0]["kind"], "needs_approval"
    else:
        action, mode = None, None
    want_type = spec.expected_type if isinstance(spec.expected_type, tuple) else (spec.expected_type,)
    want_action = spec.expected_action if isinstance(spec.expected_action, tuple) else (spec.expected_action,)

    def agg(rows: list[Any]) -> dict[str, Any]:
        n = len(rows) or 1
        return {"n": len(rows),
                "correct_rate": round(sum(r.grade.outcome == "correct" for r in rows) / n, 3),
                "loss_per_conv": round(sum(r.grade.loss_usd for r in rows) / n, 2),
                "cost_per_conv": round(sum(r.cost_usd for r in rows) / n, 5),
                "failed_rate": round(sum(r.grade.outcome == "failed" for r in rows) / n, 3),
                "wrong_refund_rate": round(sum(r.grade.outcome == "wrong_refund" for r in rows) / n, 3),
                "avg_steps": round(sum(r.steps for r in rows) / n, 2),
                "trace_ids": [r.trace_id for r in rows if r.trace_id][:6]}

    events = db.query("SELECT ts, kind, title FROM incident_events WHERE incident_id = ? ORDER BY ts", [inc.get("id")])
    act_ts = next((e["ts"] for e in events if e["kind"] == "act"), None)
    out = {
        "incident": spec.id, "name": spec.name, "story": spec.story, "brain": brain,
        "incident_id": inc.get("id"), "status": inc.get("status"), "severity": inc.get("severity"),
        "detected": bool(inc), "conversations_to_detect": len(during),
        "seconds_to_detect": round((inc.get("opened_at") or t_after) - t_trigger, 1) if inc else None,
        "seconds_detect_to_mitigate": round(act_ts - inc["opened_at"], 1) if act_ts and inc else None,
        "diagnosed_type": diag.get("incident_type"), "expected_type": "/".join(want_type),
        "type_correct": diag.get("incident_type") in want_type,
        "culprit": diag.get("culprit_release"), "expected_culprit": spec.culprit,
        "culprit_correct": (diag.get("culprit_release") == spec.culprit) if spec.culprit else diag.get("culprit_release") in (None, "", "none", "r41"),
        "checkpoint": diag.get("culprit_checkpoint"), "coding_prompt": (diag.get("coding_prompt") or "")[:300],
        "action": action, "action_mode": mode, "expected_action": "/".join(want_action),
        "action_correct": action in want_action,
        "replay": verify.get("replay", {}).get("passed"), "replay_n": verify.get("replay", {}).get("n"),
        "live_recovered": verify.get("live_ok"),
        "diagnosis_method": diag.get("method"), "diagnosis_model": diag.get("model"),
        "confidence": diag.get("confidence"), "nightshift_cost_usd": round(diag.get("cost_usd") or 0, 4),
        "nightshift_trace_id": diag.get("nightshift_trace_id"),
        "evidence_trace_ids": diag.get("evidence_trace_ids") or [],
        "loss_per_minute": impact.get("loss_per_minute"),
        "projected_loss_if_waiting": impact.get("projected_loss_if_waiting"),
        "before": agg(baseline), "during": agg(during), "after": agg(after),
        "traffic_cost_usd": round(sum(r.cost_usd for r in baseline + during + after), 4),
        "wall_seconds": round(time.time() - t0, 1),
        "timeline": [{"t": round(e["ts"] - t_trigger, 1), "kind": e["kind"], "title": e["title"]} for e in events],
    }
    pm = reporter.write_postmortem(db, inc["id"]) if inc else None
    if pm:
        shutil.copy(pm, out_dir / f"{spec.id}-postmortem.md")
    return out


def summary_md(results: list[dict[str, Any]], run_id: str, brain: str) -> str:
    ok = lambda b: "✅" if b else "❌"  # noqa: E731
    lines = [f"# Night Shift incident benchmark — run `{run_id}` ({brain})", "",
             "Incidents are staged on purpose (bad releases written by real coding-agent sessions, injected faults, attack traffic).",
             "Money figures use production volume from `business/unit_economics.yaml`; on-call clock pinned to 03:07 local.", "",
             "| # | Incident | Detected after | Diagnosis | Culprit | Action | Replay | Live recovered | Loss/conv during → after | Projected loss if waiting | Night Shift LLM cost |",
             "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in results:
        lines.append(
            f"| {r['incident']} | {r['name']} | {r['conversations_to_detect']} conv · {r['seconds_to_detect']}s "
            f"| {ok(r['type_correct'])} {r['diagnosed_type']} | {ok(r['culprit_correct'])} {r['culprit'] or '—'} "
            f"| {ok(r['action_correct'])} {r['action']} ({r['action_mode']}) | {r['replay'] if r['replay'] is not None else '—'}/{r['replay_n'] if r['replay_n'] is not None else '—'} "
            f"| {'—' if r['live_recovered'] is None else ok(r['live_recovered'])} | ${r['during']['loss_per_conv']} → ${r['after']['loss_per_conv']} "
            f"| ${r['projected_loss_if_waiting']:,} | ${r['nightshift_cost_usd']} |")
    lines += ["", "## Before / during / after (per incident)", ""]
    for r in results:
        lines += [f"### {r['incident']} {r['name']} — {r['incident_id']}", r["story"], "",
                  "| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |",
                  "|---|---|---|---|---|---|---|---|"]
        for w in ("before", "during", "after"):
            a = r[w]
            lines.append(f"| {w} | {a['n']} | {a['correct_rate']:.0%} | ${a['loss_per_conv']} | ${a['cost_per_conv']} "
                         f"| {a['failed_rate']:.0%} | {a['wrong_refund_rate']:.0%} | {a['avg_steps']} |")
        lines += ["", f"- Culprit checkpoint: `{r['checkpoint']}` · prompt: “{r['coding_prompt'][:200]}”",
                  f"- Night Shift trace (neatlogs): `{r['nightshift_trace_id']}` · evidence traces: "
                  + ", ".join(f"`{t}`" for t in r["evidence_trace_ids"][:4]),
                  f"- Detect → mitigate: {r['seconds_detect_to_mitigate']}s · diagnosis by {r['diagnosis_method']} "
                  f"({r['diagnosis_model']}), confidence {r['confidence']}", ""]
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brain", default="live", choices=["live", "sim"])
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--run-id", default=time.strftime("%Y%m%d-%H%M%S"))
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING)
    out_dir = REPO_DIR / "evidence" / "benchmark" / f"{args.run_id}-{args.brain}"
    out_dir.mkdir(parents=True, exist_ok=True)
    reporter.REGRESSION_DIR = out_dir / "regressions"
    reporter.INCIDENT_DIR = BACKEND_DIR / "runs" / "incidents"
    results = []
    for spec in INCIDENTS:
        if args.only and spec.id not in args.only:
            continue
        print(f"== {spec.id} {spec.name}", flush=True)
        r = run_incident(spec, args.brain, out_dir)
        results.append(r)
        print(json.dumps({k: r[k] for k in ("incident_id", "status", "diagnosed_type", "culprit", "action",
                                            "replay", "replay_n", "live_recovered", "seconds_to_detect",
                                            "seconds_detect_to_mitigate", "nightshift_cost_usd", "traffic_cost_usd")}),
              flush=True)
        (out_dir / "results.json").write_text(json.dumps(results, indent=2, default=str))
        (out_dir / "SUMMARY.md").write_text(summary_md(results, args.run_id, args.brain))
    for db_file in out_dir.glob("*.db*"):
        db_file.unlink()
    flush()
    print(f"wrote {out_dir}")


if __name__ == "__main__":
    main()
