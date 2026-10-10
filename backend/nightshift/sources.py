"""Signals for SDK agents: traces from the customer's neatlogs project (plus optional outcome
events reported by the SDK), written as rows in the agent's `conversations` table so the same
detector, investigator and verifier work for every agent."""

from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any

from nightshift.neatlogs_mcp import NeatlogsMCP, NeatlogsMCPError
from ops import llm
from ops.db import OpsDB, dumps

log = logging.getLogger(__name__)

NEGATIVE = ("failed", "negative", "escalated")


def _ts(value: str | None) -> float:
    if not value:
        return time.time()
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return time.time()


def _release_at(db: OpsDB, ts: float) -> str:
    row = db.one("SELECT release FROM deploys WHERE ts <= ? ORDER BY ts DESC LIMIT 1", [ts])
    return row["release"] if row else (db.get_control("active_release") or "unknown")


def _event_for(db: OpsDB, trace_id: str) -> dict[str, Any] | None:
    return db.one("SELECT * FROM events WHERE trace_id = ? ORDER BY ts DESC LIMIT 1", [trace_id])


def row_from_trace(db: OpsDB, t: dict[str, Any], cost_per_failed_run: float, price_model: str) -> dict[str, Any]:
    ts = _ts(t.get("start_ts") or t.get("created_at"))
    errored = int(t.get("errored_span_count") or 0)
    failed = (t.get("status") or "success") != "success"
    tokens = int(t.get("total_tokens") or 0)
    ev = _event_for(db, t["trace_id"])
    outcome = "failed" if failed else ("tool_error" if errored else "correct")
    loss = cost_per_failed_run if failed else 0.0
    model = ""
    if ev:
        model = ev.get("model") or ""
        if ev["outcome"] in NEGATIVE:
            outcome = "escalated" if ev["outcome"] == "escalated" else "failed"
            loss = max(loss, float(ev.get("value_usd") or 0) or cost_per_failed_run)
        elif ev["outcome"] == "ok" and not failed:
            outcome = "correct"
    usage = llm.Usage(prompt_tokens=int(tokens * 0.9), completion_tokens=tokens - int(tokens * 0.9))
    return {
        "id": t["trace_id"], "ts": ts, "release": (ev or {}).get("release") or _release_at(db, ts),
        "model": model or price_model, "brain": "neatlogs", "scenario_id": None, "kind": "trace",
        "customer_message": (t.get("input_preview") or t.get("trace_input") or "")[:2000],
        "reply": (t.get("output_preview") or t.get("trace_output") or "")[:2000],
        "outcome": outcome, "loss_usd": round(loss, 2), "cost_usd": llm.cost_usd(model or price_model, usage),
        "tokens": tokens, "steps": int(t.get("span_count") or 0), "tool_errors": errored,
        "error": None if not failed else f"trace status {t.get('status')}", "trace_id": t["trace_id"],
        "latency_ms": float(t.get("duration_ms") or 0),
        "transcript_json": dumps({"neatlogs": {k: t.get(k) for k in ("root_span_name", "status", "span_names",
                                                                     "detections", "workflow_name")},
                                  "grade_note": (ev or {}).get("note")}),
        "replay": 0,
    }


def poll_neatlogs(db: OpsDB, mcp: NeatlogsMCP, agent: dict[str, Any], lookback_s: int = 1800) -> int:
    """Fetch the agent's recent traces and upsert them. Returns the number of new traces."""
    query = agent.get("root_span_name") or agent.get("workflow_name")
    if not query or not mcp.available:
        return 0
    since = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - lookback_s))
    try:
        res = mcp.search_traces(query, limit=100, workflow_name=agent.get("workflow_name") or None, date_from=since)
    except NeatlogsMCPError as exc:
        log.warning("neatlogs poll failed for %s: %s", agent.get("id"), exc)
        return 0
    econ = agent.get("economics") or {}
    cost_failed = float(econ.get("cost_per_failed_run_usd", 5.0))
    price_model = db.get_control("default_model") or "claude-haiku"
    new = 0
    for t in (res.get("results") or []) if isinstance(res, dict) else []:
        if not t.get("trace_id"):
            continue
        if t.get("root_span_name") and agent.get("root_span_name") and t["root_span_name"] != agent["root_span_name"]:
            continue
        exists = db.one("SELECT id FROM conversations WHERE id = ?", [t["trace_id"]])
        if exists:
            continue
        db.insert("conversations", row_from_trace(db, t, cost_failed, price_model))
        new += 1
    return new


def apply_event(db: OpsDB, event: dict[str, Any], cost_per_failed_run: float) -> None:
    """An outcome event from the SDK; updates the trace row if it was already observed."""
    db.insert("events", {"ts": time.time(), "trace_id": event.get("trace_id"), "outcome": event["outcome"],
                         "value_usd": float(event.get("value_usd") or 0), "release": event.get("release"),
                         "model": event.get("model"), "note": event.get("note")})
    tid = event.get("trace_id")
    if not tid:
        return
    row = db.one("SELECT * FROM conversations WHERE id = ?", [tid])
    if not row:
        return
    if event["outcome"] in NEGATIVE:
        outcome = "escalated" if event["outcome"] == "escalated" else "failed"
        loss = max(float(row["loss_usd"] or 0), float(event.get("value_usd") or 0) or cost_per_failed_run)
        db.update("conversations", "id", tid, {"outcome": outcome, "loss_usd": round(loss, 2)})
