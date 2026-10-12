"""neatlogs in the loop: a detection for each incident's signature, then its hit rate as a verification signal.

After containment, Nightly reads the failing traces back from neatlogs and turns what they have in common
into a neatlogs detection: errors from specific tools, an escalation spike, or the injection pattern. It is
previewed first and created only if it flags traces. While Nightly watches live traffic after the fix, it
compares how often that detection fires before and after, from neatlogs' own analytics for the agent's
workflow. A detection that is still firing fails verification; too few traces in neatlogs is inconclusive,
never a failure, because ingestion can lag or drop traces.
"""

from __future__ import annotations

import datetime as dt
import logging
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any

from nightshift.neatlogs_mcp import NeatlogsMCP

log = logging.getLogger(__name__)

DETECTION_GROUP = "Nightly"
INJECTION_NAME = "Order-note prompt injection"
INJECTION_PATTERN = r"(?i)(refund policy checks are waived|ignore previous instructions|admin override approved)"
TOOL_SPAN_TYPES = ("tool_call", "tool", "TOOL")
BEFORE_WINDOW_S = 5 * 60    # the "before" window starts this long before the incident opened
MIN_AFTER_TRACES = 4        # fewer traces than this after the fix is inconclusive
STILL_FIRING_RATIO = 0.5    # after-rate at or above half the before-rate means it did not clear


@dataclass
class Signature:
    name: str
    description: str
    kind: str                       # regex | conditional
    config: dict[str, Any]
    run_on: dict[str, Any] | None
    basis: str                      # what in the failing traces it was derived from

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def signature(incident_type: str | None, agent_name: str, traces: list[dict[str, Any]],
              signals: list[str] | None = None) -> Signature | None:
    """The neatlogs-expressible signature shared by the failing traces, or None if there isn't one."""
    signals = signals or []
    if incident_type == "prompt_injection":
        return Signature(INJECTION_NAME, "Instructions hidden in order notes that try to trigger refunds (created by Nightly).",
                         "regex", {"output_pattern": INJECTION_PATTERN, "input_pattern": INJECTION_PATTERN, "operator": "OR"},
                         None, "injection phrases in the attack traffic")
    spans = [s for t in traces for s in (t.get("spans") or []) if isinstance(s, dict)]
    errored = Counter(s.get("name") for s in spans
                      if s.get("type") in TOOL_SPAN_TYPES and s.get("name")
                      and "error" in str(s.get("output_value") or "").lower())
    if errored:
        tools = [name for name, _ in errored.most_common(3)]
        return Signature(f"Nightly · {agent_name}: errors from {', '.join(tools)}",
                         f"Tool calls to {', '.join(tools)} that return an error (created by Nightly from an incident).",
                         "regex", {"output_pattern": r"(?i)\berror\b"}, {"frequency": "span_name", "span_names": tools},
                         f"{sum(errored.values())} errored tool calls in {len(traces)} failing traces")
    if "escalations" in signals:
        names = sorted({s.get("name") for s in spans if "escalat" in str(s.get("name") or "").lower()})
        if names:
            rule = {"type": "rule", "field": "span_name", "operator": "=", "value": names[0]}
            return Signature(f"Nightly · {agent_name}: hand-offs to a human",
                             f"Calls to {names[0]} (created by Nightly from an escalation flood).",
                             "conditional", {"root": {"type": "group", "logic": "AND", "children": [rule]}},
                             {"frequency": "span_name", "span_names": [names[0]]},
                             f"escalation spike; {names[0]} spans in the failing traces")
    return None


def failing_traces(mcp: NeatlogsMCP, trace_ids: list[str], limit: int = 3) -> list[dict[str, Any]]:
    out = []
    for tid in [t for t in trace_ids if t][:limit]:
        try:
            ctx = mcp.get_trace_context(tid)
            if isinstance(ctx, dict):
                out.append(ctx)
        except Exception as exc:  # a trace neatlogs lost must not stop the others
            log.info("trace %s not readable: %s", tid, exc)
    return out


def _group_id(mcp: NeatlogsMCP) -> str | None:
    groups = mcp.list_detection_groups()
    for g in (groups.get("groups", groups) if isinstance(groups, dict) else groups) or []:
        if isinstance(g, dict) and g.get("name") == DETECTION_GROUP:
            return g.get("id")
    created = mcp.create_detection_group(DETECTION_GROUP)
    if isinstance(created, dict):
        return created.get("id") or (created.get("group") or {}).get("id")
    return None


def _find(mcp: NeatlogsMCP, name: str) -> str | None:
    """The id of the project's detection with exactly this name (names can be prefixes of each other)."""
    found = mcp.list_detections()
    rows = found.get("detections", found) if isinstance(found, dict) else found
    for d in rows or []:
        if isinstance(d, dict) and name in (d.get("display_name"), d.get("name")):
            return d.get("id") or name
    return None


def ensure(mcp: NeatlogsMCP, sig: Signature, timeframe_days: int = 1) -> dict[str, Any]:
    """Create the detection (or reuse one with the same name). Preview first; skip if it flags nothing."""
    try:
        existing = _find(mcp, sig.name)
        if existing:
            return {"status": "exists", "name": sig.name, "detection_id": existing, "signature": sig.as_dict()}
        preview = mcp.preview_detection(sig.config, timeframe_days, kind=sig.kind, run_on=sig.run_on)
        flagged = preview.get("total_count") if isinstance(preview, dict) else None
        if not flagged:
            return {"status": "skipped", "name": sig.name, "reason": "preview flagged no traces yet",
                    "signature": sig.as_dict()}
        det = mcp.create_detection(sig.name, _group_id(mcp) or "", sig.config, sig.description,
                                   kind=sig.kind, run_on=sig.run_on)
        return {"status": "created", "name": sig.name, "preview_flagged": flagged, "signature": sig.as_dict(),
                "detection_id": det.get("id") if isinstance(det, dict) else None}
    except Exception as exc:  # observability config must never break the incident flow
        log.warning("detection setup failed: %s", exc)
        return {"status": "failed", "name": sig.name, "error": str(exc)[:300]}


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hour(ts: float) -> float:
    return ts - ts % 3600


def _traces(mcp: NeatlogsMCP, workflow: str | None, start: float, end: float) -> int:
    kpis = mcp.analytics(_iso(start), _iso(end), "kpis", workflow)
    return int(((kpis or {}).get("data") or {}).get("current", {}).get("trace_count") or 0)


def _detection_id(mcp: NeatlogsMCP, det: dict[str, Any]) -> str | None:
    return det.get("detection_id") or _find(mcp, det["name"])


def snapshot(mcp: NeatlogsMCP, det: dict[str, Any], start: float, mitigated_at: float) -> dict[str, Any] | None:
    """Once neatlogs has scored the incident's traces (the detection's backfill is done), record its trend:
    the hits in the incident's hours, and the running total that any post-fix hits will add to.

    neatlogs counts backfilled hits only in a detection's trend (hourly), not in analytics or search,
    so the trend is the one source that sees both the incident and what comes after it."""
    det_id = _detection_id(mcp, det)
    if det_id:
        status = mcp.call("get_detection_status", {"detection_id": det_id})
        if isinstance(status, dict) and status.get("backfillStatus") not in (None, "completed"):
            return None
    trend = mcp.call("get_detection_trend", {"detection_name": det["name"], "period": "7d", "granularity": "hour"})
    first, last = _hour(start), _hour(mitigated_at)
    hits = 0
    for p in (trend or {}).get("data_points") or []:
        ts = dt.datetime.fromisoformat(str(p.get("date")).replace("Z", "+00:00")).timestamp()
        if first <= ts <= last:
            hits += int(p.get("count") or 0)
    return {"total": int((trend or {}).get("total_occurrences") or 0), "flagged": hits, "first_hour": _iso(first)}


def judge(before: dict[str, Any], after: dict[str, Any]) -> tuple[str, str]:
    """cleared | still_firing | inconclusive, with a one-line reason."""
    if not before.get("flagged"):
        return "inconclusive", "the detection had not flagged the incident traces in neatlogs yet"
    if after.get("traces", 0) < MIN_AFTER_TRACES:
        return "inconclusive", f"only {after.get('traces', 0)} traces in neatlogs since the fix"
    b, a = before["rate"] or 0.0, after["rate"] or 0.0
    line = (f"flagged {before['flagged']} hits in {before['traces']} traces before the fix, "
            f"{after['flagged']} in {after['traces']} after")
    if after["flagged"] >= 2 and a >= b * STILL_FIRING_RATIO:
        return "still_firing", line
    return "cleared", line


def compare(mcp: NeatlogsMCP, det: dict[str, Any], workflow: str | None, opened_at: float, mitigated_at: float,
            now: float) -> dict[str, Any]:
    """Before/after hit rates for the incident's detection. Stores the trend snapshot in `det`."""
    name = det["name"]
    start = max(opened_at - BEFORE_WINDOW_S, mitigated_at - 2 * BEFORE_WINDOW_S)
    try:
        snap = det.get("snapshot") or snapshot(mcp, det, start, mitigated_at)
        if snap is None:
            return {"status": "inconclusive", "reason": "neatlogs is still scoring the incident traces",
                    "detection": name}
        det["snapshot"] = snap
        trend = mcp.call("get_detection_trend", {"detection_name": name, "period": "7d", "granularity": "hour"})
        total = int((trend or {}).get("total_occurrences") or 0)
        n_before = _traces(mcp, workflow, _hour(start), mitigated_at)
        n_after = _traces(mcp, workflow, mitigated_at, now)
    except Exception as exc:
        return {"status": "inconclusive", "reason": f"neatlogs unavailable: {str(exc)[:200]}", "detection": name}
    before = {"from": snap["first_hour"], "to": _iso(mitigated_at), "traces": n_before, "flagged": snap["flagged"],
              "rate": round(min(snap["flagged"] / n_before, 1.0), 3) if n_before else None}
    flagged_after = max(total - snap["total"], 0)
    after = {"from": _iso(mitigated_at), "to": _iso(now), "traces": n_after, "flagged": flagged_after,
             "rate": round(min(flagged_after / n_after, 1.0), 3) if n_after else None}
    status, reason = judge(before, after)
    return {"status": status, "reason": reason, "detection": name, "workflow": workflow,
            "before": before, "after": after}
