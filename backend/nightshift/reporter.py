"""Incident outputs: postmortem, regression evals, permanent-fix proposal, neatlogs detection."""

from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path
from typing import Any

import yaml

from nightshift.neatlogs_mcp import NeatlogsMCP, NeatlogsMCPError
from ops.db import OpsDB, loads
from ops.settings import BACKEND_DIR

log = logging.getLogger(__name__)

INCIDENT_DIR = BACKEND_DIR / "runs" / "incidents"
REGRESSION_DIR = BACKEND_DIR / "harbor" / "evals" / "regressions"

DETECTION_GROUP = "Night Shift"
INJECTION_PATTERN = r"(?i)(refund policy checks are waived|ignore previous instructions|admin override approved)"


def _fmt_ts(ts: float | None) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S") if ts else "—"


def write_regressions(db: OpsDB, incident_id: str, conversation_ids: list[str]) -> Path | None:
    """Every incident becomes a test: the failing conversations with their required outcome."""
    if not conversation_ids:
        return None
    marks = ",".join("?" for _ in conversation_ids)
    rows = db.query(f"SELECT scenario_id, outcome, trace_id FROM conversations WHERE id IN ({marks}) "
                    f"AND outcome != 'correct' AND replay = 0", conversation_ids)
    cases = []
    seen = set()
    for r in rows:
        if r["scenario_id"] in seen:
            continue
        seen.add(r["scenario_id"])
        cases.append({"scenario": r["scenario_id"], "must_be": ["correct", "escalated"],
                      "observed_during_incident": r["outcome"], "source_trace": r["trace_id"]})
    if not cases:
        return None
    REGRESSION_DIR.mkdir(parents=True, exist_ok=True)
    path = REGRESSION_DIR / f"{incident_id}.yaml"
    path.write_text(yaml.safe_dump({"incident": incident_id, "cases": cases}, sort_keys=False))
    return path


def ensure_detection(mcp: NeatlogsMCP, incident_type: str) -> dict[str, Any] | None:
    """Leave a permanent neatlogs detection for the incident signature (injection only, for now)."""
    if incident_type != "prompt_injection" or not mcp.available:
        return None
    try:
        existing = mcp.list_detections()
        text = str(existing)
        if "Order-note prompt injection" in text:
            return {"status": "exists", "name": "Order-note prompt injection"}
        groups = mcp.list_detection_groups()
        group_list = groups.get("groups", groups) if isinstance(groups, dict) else groups
        group_id = None
        for g in group_list or []:
            if isinstance(g, dict) and g.get("name") == DETECTION_GROUP:
                group_id = g.get("id")
        if not group_id:
            created = mcp.create_detection_group(DETECTION_GROUP)
            group_id = created.get("id") or created.get("group", {}).get("id") if isinstance(created, dict) else None
        config = {"output_pattern": INJECTION_PATTERN, "input_pattern": INJECTION_PATTERN, "operator": "OR"}
        preview = mcp.preview_detection(config)
        det = mcp.create_detection("Order-note prompt injection", group_id, config,
                                   "Instructions hidden in order notes that try to trigger refunds (created by Night Shift).")
        return {"status": "created", "preview": preview if isinstance(preview, dict) else str(preview)[:300],
                "detection": det if isinstance(det, dict) else str(det)[:300]}
    except (NeatlogsMCPError, Exception) as exc:  # observability config must never break the incident flow
        log.warning("detection setup failed: %s", exc)
        return {"status": "failed", "error": str(exc)[:300]}


def postmortem(db: OpsDB, incident_id: str) -> str:
    inc = db.one("SELECT * FROM incidents WHERE id = ?", [incident_id]) or {}
    diag = loads(inc.get("diagnosis_json"), {}) or {}
    impact = loads(inc.get("impact_json"), {}) or {}
    verify = loads(inc.get("verification_json"), {}) or {}
    events = db.query("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY ts", [incident_id])
    acts = db.query("SELECT * FROM actions WHERE incident_id = ? ORDER BY ts", [incident_id])
    prov = diag.get("provenance") or {}
    lines = [
        f"# {incident_id}: {inc.get('title') or diag.get('title', 'Incident')}",
        "",
        f"- **Status:** {inc.get('status')}  ·  **Severity:** {inc.get('severity')}  ·  **Type:** {diag.get('incident_type')}",
        f"- **Opened:** {_fmt_ts(inc.get('opened_at'))}  ·  **Mitigated:** {_fmt_ts(inc.get('mitigated_at'))}  ·  **Resolved:** {_fmt_ts(inc.get('resolved_at'))}",
        f"- **Diagnosis by:** {diag.get('method')} ({diag.get('model') or 'rules'}), confidence {diag.get('confidence')}",
        "",
        "## What happened",
        diag.get("root_cause", ""),
        "",
        "## Root cause and provenance",
        f"- Release: `{diag.get('culprit_release')}`",
        f"- Commit: `{(diag.get('culprit_commit') or '')[:12]}` {prov.get('commit_subject') or ''}",
        f"- Entire checkpoint: `{diag.get('culprit_checkpoint')}`" + (f" ([view]({prov.get('entire_url')}))" if prov.get("entire_url") else ""),
        f"- Coding agent: {prov.get('agent') or '—'} {prov.get('model') or ''}",
        f"- Prompt behind the change: “{(diag.get('coding_prompt') or '—')[:400]}”",
        "",
        "## Impact",
        f"- Loss rate at detection: **${impact.get('loss_per_minute', 0):,.2f}/min** at production volume "
        f"({impact.get('conversations_per_minute')} conversations/min)",
        f"- Human response time at {impact.get('local_time')} local: {impact.get('human_response_minutes')} min "
        f"→ projected loss if waiting: **${impact.get('projected_loss_if_waiting', 0):,.0f}**",
        f"- Unit economics: {impact.get('economics_source')}",
        "",
        "## Actions",
    ]
    for a in acts:
        lines.append(f"- [{a['mode']}] `{a['kind']}` {a['params_json']} — {a['status']} — {a['reason'] or ''}")
    lines += ["", "## Verification",
              f"- Replay of failing conversations: {verify.get('replay', {}).get('passed')}/{verify.get('replay', {}).get('n')} pass",
              f"- Live metrics after action: {', '.join(verify.get('live_reasons', [])) or 'pending'}",
              "", "## Evidence (neatlogs traces)"]
    for t in diag.get("evidence_trace_ids") or []:
        lines.append(f"- `{t}`")
    lines += ["", "## Permanent fix (needs human approval)", diag.get("permanent_fix") or "—", "", "## Timeline"]
    for e in events:
        lines.append(f"- {_fmt_ts(e['ts'])} · **{e['kind']}** · {e['title']}")
    return "\n".join(lines) + "\n"


def write_postmortem(db: OpsDB, incident_id: str) -> Path:
    INCIDENT_DIR.mkdir(parents=True, exist_ok=True)
    path = INCIDENT_DIR / f"{incident_id}.md"
    path.write_text(postmortem(db, incident_id))
    return path
