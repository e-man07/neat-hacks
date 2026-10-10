"""Night Shift's on-call loop and incident state machine.

    OPEN → INVESTIGATING → MITIGATING → MONITORING → RESOLVED
                       ↘ AWAITING_HUMAN (not allowed to act alone)       ↘ ESCALATED (verify failed → undone)

Every transition and step is persisted, so a restarted process resumes the open incident.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from typing import Any, Callable

from harbor import deploy as deploys
from nightshift import actions, detector, impact as impact_mod, notifier, policy, reporter, verifier
from nightshift.investigator import Diagnosis, Investigation
from nightshift.neatlogs_mcp import NeatlogsMCP
from ops import clock
from ops.db import OpsDB, dumps, loads
from ops.settings import settings
from ops.tracing import flush, set_attrs, workflow

log = logging.getLogger(__name__)

ACTIVE = ("OPEN", "INVESTIGATING", "MITIGATING", "MONITORING")
LIVE_WATCH_MIN = 5          # conversations after the action before judging recovery
LIVE_WATCH_TIMEOUT_S = 240


class NightShift:
    def __init__(self, db: OpsDB, mcp: NeatlogsMCP | None = None, brain: str | None = None,
                 on_event: Callable[[dict[str, Any]], None] | None = None, page: bool = True):
        self.db = db
        self.mcp = mcp or NeatlogsMCP()
        self.brain = brain or settings.harbor_brain
        self.on_event = on_event or (lambda e: None)
        self.page = page
        self._lock = threading.Lock()
        self.enabled = True

    # -- bookkeeping --------------------------------------------------------------------------
    def event(self, incident_id: str, kind: str, title: str, detail: Any = None) -> dict[str, Any]:
        row = {"incident_id": incident_id, "ts": time.time(), "kind": kind, "title": title,
               "detail_json": dumps(detail) if detail is not None else None}
        row["id"] = self.db.insert("incident_events", row)
        out = {**row, "detail": detail}
        out.pop("detail_json", None)
        try:
            self.on_event({"type": "incident_event", **out})
        except Exception:  # pragma: no cover - UI callbacks must not break the loop
            pass
        return out

    def _set(self, incident_id: str, **values: Any) -> None:
        self.db.update("incidents", "id", incident_id, values)
        try:
            self.on_event({"type": "incident_update", "incident_id": incident_id, **{
                k: v for k, v in values.items() if not k.endswith("_json")}})
        except Exception:  # pragma: no cover
            pass

    def open_incident(self) -> dict[str, Any] | None:
        return self.db.one(f"SELECT * FROM incidents WHERE status IN ({','.join('?' * len(ACTIVE))}) "
                           "ORDER BY opened_at DESC LIMIT 1", ACTIVE)

    def quiet_since(self) -> float:
        row = self.db.one("SELECT MAX(COALESCE(mitigated_at, resolved_at, opened_at)) t FROM incidents")
        return float(row["t"]) if row and row["t"] else 0.0

    # -- main entry -----------------------------------------------------------------------------
    def tick(self) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        with self._lock:
            inc = self.open_incident()
            if inc is None:
                stats, base, signals = detector.detect(self.db, since=self.quiet_since())
                if not signals:
                    return None
                inc = self._open(stats, base, signals)
                return self._handle(inc["id"], stats, base, signals)
            if inc["status"] in ("OPEN", "INVESTIGATING"):  # resume after a crash
                stats, base, signals = detector.detect(self.db, since=self.quiet_since())
                return self._handle(inc["id"], stats, base, signals)
            if inc["status"] == "MONITORING":
                return self._monitor(inc)
            return inc

    def _open(self, stats: detector.WindowStats, base: dict[str, float], signals: list[detector.Signal]) -> dict[str, Any]:
        n = (self.db.one("SELECT COUNT(*) n FROM incidents") or {"n": 0})["n"] + 1
        iid = f"INC-{time.strftime('%m%d')}-{n:02d}-{uuid.uuid4().hex[:4]}"
        row = {"id": iid, "opened_at": time.time(), "status": "OPEN", "title": "Investigating anomaly",
               "signals_json": dumps({"signals": [s.__dict__ for s in signals], "window": stats.as_dict(),
                                      "baseline": base})}
        self.db.insert("incidents", row)
        self.event(iid, "detect", "Anomaly detected: " + "; ".join(s.description for s in signals),
                   {"signals": [s.__dict__ for s in signals], "window": stats.as_dict(), "baseline": base})
        return row

    # -- the incident pipeline ------------------------------------------------------------------
    def _handle(self, iid: str, stats: detector.WindowStats, base: dict[str, float],
                signals: list[detector.Signal]) -> dict[str, Any]:
        with workflow("oncall_incident", "nightshift", **{"nightshift.incident": iid}) as (span, trace_id):
            self._set(iid, status="INVESTIGATING")
            self.event(iid, "investigate", "Investigating with neatlogs traces, deploy log and Entire provenance",
                       {"nightshift_trace_id": trace_id})
            focus = self._since_change(stats)
            inv = Investigation(self.db, stats, base, signals, mcp=self.mcp, brain=self.brain, focus=focus,
                                on_step=lambda s: self.event(iid, "step", f"{s['tool']}: {s['summary']}",
                                                             {"tool": s["tool"], "args": s["args"]}))
            diag = inv.run()
            fresh, _, _ = detector.detect(self.db, since=self.quiet_since())
            focus = self._since_change(fresh, size=20) if fresh.n else focus
            imp = impact_mod.assess(focus, base)
            safety = diag.incident_type in policy.load_policy()["gates"]["safety_incident_types"]
            severity = "SEV1" if safety or imp.projected_loss_if_waiting >= 1000 else (
                "SEV2" if imp.projected_loss_if_waiting >= 25 else "SEV3")
            self._set(iid, title=diag.title, type=diag.incident_type, severity=severity, summary=diag.root_cause,
                      diagnosis_json=dumps({**diag.as_dict(), "nightshift_trace_id": trace_id}),
                      impact_json=dumps(imp.as_dict()))
            self.event(iid, "diagnosis", f"{diag.title} ({diag.incident_type}, confidence {diag.confidence:.2f})",
                       {k: v for k, v in diag.as_dict().items() if k != "steps"})
            self.event(iid, "impact", f"${imp.loss_per_minute:,.2f}/min · human response at {imp.local_time}: "
                       f"{imp.human_response_minutes:.0f} min · ${imp.projected_loss_if_waiting:,.0f} at risk",
                       imp.as_dict())
            set_attrs(span, **{"nightshift.type": diag.incident_type, "nightshift.severity": severity,
                               "nightshift.projected_loss": imp.projected_loss_if_waiting})
            result = self._contain(iid, diag, imp, stats, base)
        flush()
        return result

    def _contain(self, iid: str, diag: Diagnosis, imp: impact_mod.Impact, stats: detector.WindowStats,
                 base: dict[str, float]) -> dict[str, Any]:
        self._propose_permanent_fix(iid, diag)
        if diag.action == "none":
            return self._await_human(iid, diag, imp, "No safe containment action identified")
        taken = (self.db.one("SELECT COUNT(*) n FROM actions WHERE incident_id = ? AND mode = 'auto'", [iid]) or {"n": 0})["n"]
        dec = policy.decide(diag.action, diag.action_params, diag.incident_type, diag.confidence,
                            imp.projected_loss_if_waiting, taken)
        self.event(iid, "decide", f"Policy: {dec.mode} — {diag.action} {diag.action_params}", dec.as_dict())
        if dec.mode == "defer":
            actions.record_proposal(self.db, iid, diag.action, diag.action_params, "; ".join(dec.reasons))
            return self._defer(iid, diag, imp, "; ".join(dec.reasons))
        if dec.mode != "auto":
            actions.record_proposal(self.db, iid, diag.action, diag.action_params, "; ".join(dec.reasons))
            return self._await_human(iid, diag, imp, "; ".join(dec.reasons))

        self._set(iid, status="MITIGATING")
        applied = actions.apply(self.db, iid, diag.action, diag.action_params, "auto", "; ".join(dec.reasons))
        self.event(iid, "act", f"Auto action: {applied['summary']}", applied)

        rep = verifier.replay(self.db, stats.conversation_ids, brain=self.brain)
        self.event(iid, "verify", f"Replayed {rep.n} failing conversations on the new config: {rep.passed}/{rep.n} pass",
                   rep.as_dict())
        gate = policy.load_policy()["gates"]["verify_replay_min_pass_rate"]
        if rep.n and rep.rate < gate:
            note = actions.undo(self.db, applied["id"])
            self.event(iid, "undo", f"Verification failed ({rep.rate:.0%} < {gate:.0%}); {note}", {"replay": rep.as_dict()})
            self._set(iid, status="ESCALATED", verification_json=dumps({"replay": rep.as_dict()}))
            self._page(iid, "🚨 Night Shift needs you", f"{diag.title}. My containment didn't verify, so I undid it. "
                       f"${imp.loss_per_minute:,.0f}/min at risk.", "urgent")
            reporter.write_postmortem(self.db, iid)
            return {"id": iid, "status": "ESCALATED"}

        now = time.time()
        self._set(iid, status="MONITORING", mitigated_at=now, verification_json=dumps({"replay": rep.as_dict()}))
        self._outputs(iid, diag, stats)
        opened = (self.db.one("SELECT opened_at FROM incidents WHERE id = ?", [iid]) or {"opened_at": now})["opened_at"]
        minutes = max((now - opened) / 60, 0.1)
        lost = imp.loss_per_minute * minutes
        prevented = max(imp.projected_loss_if_waiting - lost, 0)
        self._page(iid, "✅ Incident handled — no action needed tonight",
                   f"{diag.title}. {applied['summary'].capitalize()} at {clock.local_now():%H:%M}. "
                   f"{rep.passed}/{rep.n} failed conversations now pass. ~${lost:,.0f} lost, ~${prevented:,.0f} prevented. "
                   f"Permanent fix is waiting for your approval.", "default")
        reporter.write_postmortem(self.db, iid)
        return {"id": iid, "status": "MONITORING"}

    def _monitor(self, inc: dict[str, Any]) -> dict[str, Any]:
        iid = inc["id"]
        stats = verifier.live_window(self.db, inc["mitigated_at"])
        if stats.n < LIVE_WATCH_MIN and time.time() - inc["mitigated_at"] < LIVE_WATCH_TIMEOUT_S:
            return inc
        base = loads(inc["signals_json"], {}).get("baseline", detector.DEFAULT_BASELINE)
        ok, reasons = verifier.recovered(stats, base)
        verify = loads(inc["verification_json"], {}) or {}
        verify.update({"live": stats.as_dict(), "live_ok": ok, "live_reasons": reasons})
        if ok:
            self._set(iid, status="RESOLVED", resolved_at=time.time(), verification_json=dumps(verify))
            self.event(iid, "resolved", f"Live metrics recovered over {stats.n} new conversations: " + "; ".join(reasons),
                       {"live": stats.as_dict()})
        else:
            last = self.db.one("SELECT id FROM actions WHERE incident_id = ? AND mode = 'auto' AND status = 'applied' "
                               "ORDER BY ts DESC LIMIT 1", [iid])
            note = actions.undo(self.db, last["id"]) if last else "no action to undo"
            self._set(iid, status="ESCALATED", verification_json=dumps(verify))
            self.event(iid, "undo", "Live metrics did not recover: " + "; ".join(reasons) + f"; {note}", {"live": stats.as_dict()})
            self._page(iid, "🚨 Night Shift needs you", "Containment did not hold in production; I rolled my change back.", "urgent")
        reporter.write_postmortem(self.db, iid)
        return {"id": iid, "status": "RESOLVED" if ok else "ESCALATED"}

    # -- helpers --------------------------------------------------------------------------------
    def _since_change(self, stats: detector.WindowStats, size: int | None = None) -> detector.WindowStats:
        """Restrict the window to conversations after the last control change (deploy, fault)
        inside it, so healthy pre-change traffic does not dilute the price of the incident."""
        if not stats.first_ts:
            return stats
        row = self.db.one("SELECT MAX(ts) t FROM control_history WHERE ts >= ? AND actor != 'nightshift'",
                          [stats.first_ts])
        if not row or not row["t"]:
            return stats
        if size:
            rows = self.db.query("SELECT * FROM conversations WHERE replay = 0 AND ts >= ? ORDER BY ts DESC LIMIT ?",
                                 [row["t"], size])
        else:
            marks = ",".join("?" for _ in stats.conversation_ids)
            rows = self.db.query(f"SELECT * FROM conversations WHERE id IN ({marks}) AND ts >= ?",
                                 [*stats.conversation_ids, row["t"]])
        return detector._stats(rows) if len(rows) >= 3 else stats

    def _await_human(self, iid: str, diag: Diagnosis, imp: impact_mod.Impact, why: str) -> dict[str, Any]:
        self._set(iid, status="AWAITING_HUMAN")
        self.event(iid, "page", f"Waiting for a human: {why}", {"why": why})
        self._page(iid, "🚨 Night Shift needs a decision", f"{diag.title}. {why}. "
                   f"${imp.loss_per_minute:,.2f}/min at risk.", "urgent")
        reporter.write_postmortem(self.db, iid)
        return {"id": iid, "status": "AWAITING_HUMAN"}

    def _defer(self, iid: str, diag: Diagnosis, imp: impact_mod.Impact, why: str) -> dict[str, Any]:
        """Low impact: not worth waking anyone. Leave it, with the proposed fix, for the morning."""
        self._set(iid, status="DEFERRED")
        self.event(iid, "defer", f"Not worth waking anyone: ${imp.projected_loss_if_waiting:,.0f} at risk until morning. "
                   "Left the proposed fix for the day shift.", {"why": why})
        self._page(iid, "🌙 For the morning", f"{diag.title}. Low impact (${imp.projected_loss_if_waiting:,.0f} until "
                   "morning), so I didn't wake you. Proposed fix is waiting.", "low")
        reporter.write_postmortem(self.db, iid)
        return {"id": iid, "status": "DEFERRED"}

    def _propose_permanent_fix(self, iid: str, diag: Diagnosis) -> None:
        if not diag.permanent_fix:
            return
        params: dict[str, Any] = {"summary": diag.permanent_fix}
        if diag.culprit_commit:
            params["revert_commit"] = diag.culprit_commit
        if diag.culprit_release:
            params["release"] = diag.culprit_release
        actions.record_proposal(self.db, iid, "deploy_code_fix", params, "forward fix: needs human approval")
        self.event(iid, "propose", f"Permanent fix proposed (needs approval): {diag.permanent_fix}", params)

    def _outputs(self, iid: str, diag: Diagnosis, stats: detector.WindowStats) -> None:
        path = reporter.write_regressions(self.db, iid, stats.conversation_ids)
        if path:
            self.event(iid, "regression", f"Added regression eval {path.name} from the failing conversations",
                       {"path": str(path)})
        det = reporter.ensure_detection(self.mcp, diag.incident_type)
        if det:
            self.event(iid, "detection", f"neatlogs detection: {det.get('status')}", det)

    def _page(self, iid: str, title: str, body: str, priority: str) -> None:
        if not self.page:
            return
        res = notifier.send(notifier.Page(title=title, body=body, priority=priority,
                                          click_url=f"{settings.public_base_url}/incidents/{iid}"))
        self.event(iid, "page", f"Paged on-call via {', '.join(res['delivered'])}: {title}", res)


def approve(db: OpsDB, action_id: int, actor: str = "human") -> dict[str, Any]:
    """A human approves a proposed action. Containment actions are applied; code fixes are marked approved."""
    row = db.one("SELECT * FROM actions WHERE id = ?", [action_id])
    if row is None or row["status"] != "proposed":
        return {"error": "not a pending proposal"}
    params = loads(row["params_json"], {})
    if row["kind"] in ("rollback_release", "failover_model", "disable_flag", "cap_steps"):
        db.update("actions", "id", action_id, {"status": "approved"})
        applied = actions.apply(db, row["incident_id"], row["kind"], params, "approved", f"approved by {actor}")
        return {"status": "applied", "action": applied}
    if row["kind"] == "deploy_code_fix" and params.get("release"):
        # The forward fix for a bad release is to make the known-good release the new baseline.
        target = deploys.last_known_good(db, params["release"])
        db.update("actions", "id", action_id, {"status": "approved"})
        return {"status": "approved", "note": f"fix approved by {actor}; revert of {params.get('revert_commit', '')[:8]} "
                                              f"queued as a PR against main (baseline {target})"}
    db.update("actions", "id", action_id, {"status": "approved"})
    return {"status": "approved"}
