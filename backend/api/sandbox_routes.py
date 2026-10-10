"""Sandbox routes: the built-in Harbor agent and its demo controls (the original console API)."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.deps import platform, require_user_for_writes
from api.runtime import Runtime
from harbor import deploy as deploys
from harbor import releases
from harbor.agent import effective_config
from nightshift import actions as ns_actions
from nightshift import detector, policy, provenance, reporter
from nightshift.runner import approve
from ops import clock
from ops.db import loads
from ops.economics import load_economics
from ops.settings import REPO_DIR, settings

router = APIRouter()


def rt() -> Runtime:
    return platform().sandbox


def _incident_row(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": r["id"], "status": r["status"], "type": r["type"], "severity": r["severity"], "title": r["title"],
        "summary": r["summary"], "opened_at": r["opened_at"], "mitigated_at": r["mitigated_at"],
        "resolved_at": r["resolved_at"], "impact": loads(r["impact_json"], None),
    }


# -- reads ------------------------------------------------------------------------------------------
@router.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "brain": rt().brain, "llm": settings.llm_available, "neatlogs": settings.neatlogs_available}


@router.get("/api/state")
def state() -> dict[str, Any]:
    r = rt()
    cfg = effective_config(r.db)
    stats, base, signals = detector.detect(r.db, since=r.nightshift.quiet_since())
    open_inc = r.nightshift.open_incident()
    totals = r.db.one("SELECT COUNT(*) n, COALESCE(SUM(loss_usd),0) loss, COALESCE(SUM(cost_usd),0) cost "
                      "FROM conversations WHERE replay = 0") or {}
    now = clock.local_now()
    return {
        "brain": r.brain,
        "local_time": now.strftime("%H:%M:%S"),
        "local_time_simulated": clock.is_simulated(),
        # add to a unix timestamp and format as UTC to get the on-call wall clock
        "local_offset_s": round(now.replace(tzinfo=dt.timezone.utc).timestamp() - time.time(), 1),
        "release": cfg.release.id, "release_title": cfg.release.title, "model": cfg.model,
        "flags": cfg.flags, "max_steps": cfg.max_steps, "outage_models": sorted(cfg.outage_models),
        "control": r.db.control_snapshot(),
        "traffic": {"running": r.traffic.running, "per_minute": r.traffic.per_minute,
                    "attack_share": r.traffic.mix.attack_share},
        "nightshift_enabled": r.nightshift.enabled,
        "window": stats.as_dict(), "baseline": base, "signals": [s.__dict__ for s in signals],
        "open_incident": _incident_row(open_inc) if open_inc else None,
        "totals": totals,
        "budget": r.budget(),
        "economics": {"conversations_per_minute": load_economics().conversations_per_minute(now),
                      "human_response_minutes": load_economics().human_response_minutes(now)},
    }


@router.get("/api/metrics")
def metrics(minutes: int = 15, bucket_s: int = 30) -> dict[str, Any]:
    since = time.time() - minutes * 60
    rows = rt().db.query("SELECT ts, outcome, loss_usd, cost_usd, steps, release, model FROM conversations "
                         "WHERE replay = 0 AND ts >= ? ORDER BY ts", [since])
    buckets: dict[int, dict[str, Any]] = {}
    for row in rows:
        b = int(row["ts"] // bucket_s * bucket_s)
        d = buckets.setdefault(b, {"t": b, "n": 0, "loss": 0.0, "cost": 0.0, "failed": 0, "wrong_refund": 0,
                                   "escalated": 0, "correct": 0, "steps": 0})
        d["n"] += 1
        d["loss"] += row["loss_usd"] or 0
        d["cost"] += row["cost_usd"] or 0
        d["steps"] += row["steps"] or 0
        if row["outcome"] in ("failed", "wrong_refund", "escalated", "correct"):
            d[row["outcome"]] += 1
    return {"bucket_s": bucket_s, "series": [buckets[k] for k in sorted(buckets)]}


@router.get("/api/conversations")
def conversations(limit: int = 40) -> list[dict[str, Any]]:
    return rt().db.query(
        "SELECT id, ts, release, model, brain, kind, customer_message AS message, reply, error, outcome, loss_usd, "
        "cost_usd, steps, tool_errors, trace_id, latency_ms FROM conversations WHERE replay = 0 "
        "ORDER BY ts DESC LIMIT ?", [limit])


@router.get("/api/conversations/{cid}")
def conversation(cid: str) -> dict[str, Any]:
    row = rt().db.one("SELECT * FROM conversations WHERE id = ?", [cid])
    if not row:
        raise HTTPException(404)
    row["transcript"] = loads(row.pop("transcript_json"), {})
    return row


@router.get("/api/incidents")
def incidents() -> list[dict[str, Any]]:
    return [_incident_row(r) for r in rt().db.query("SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50")]


@router.get("/api/incidents/{iid}")
def incident(iid: str) -> dict[str, Any]:
    db = rt().db
    row = db.one("SELECT * FROM incidents WHERE id = ?", [iid])
    if not row:
        raise HTTPException(404)
    out = _incident_row(row)
    out["signals"] = loads(row["signals_json"], {})
    out["diagnosis"] = loads(row["diagnosis_json"], None)
    out["verification"] = loads(row["verification_json"], None)
    out["events"] = [{**e, "detail": loads(e.pop("detail_json"), None)}
                     for e in db.query("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY ts", [iid])]
    out["actions"] = [{**a, "params": loads(a.pop("params_json"), {}), "undo": loads(a.pop("undo_json"), None)}
                      for a in db.query("SELECT * FROM actions WHERE incident_id = ? ORDER BY ts", [iid])]
    out["postmortem"] = reporter.postmortem(db, iid)
    return out


@router.get("/api/incidents/{iid}/events")
def incident_events(iid: str, after: int = 0) -> list[dict[str, Any]]:
    return [{**e, "detail": loads(e.pop("detail_json"), None)} for e in rt().db.query(
        "SELECT * FROM incident_events WHERE incident_id = ? AND id > ? ORDER BY id", [iid, after])]


@router.get("/api/releases")
def list_releases() -> list[dict[str, Any]]:
    out = []
    for rel in releases.list_releases():
        try:
            p = provenance.for_release(rel.id)
            prov = {k: v for k, v in p.as_dict().items() if k != "diff_excerpt"}
        except Exception:
            prov = None
        out.append({"id": rel.id, "title": rel.title, "description": rel.description, "model": rel.model,
                    "max_steps": rel.max_steps, "orders_api": rel.orders_api, "tools": rel.tools,
                    "flags": rel.flags, "provenance": prov})
    return out


@router.get("/api/deploys")
def list_deploys() -> list[dict[str, Any]]:
    return deploys.recent_deploys(rt().db, 20)


@router.get("/api/benchmark")
def benchmark() -> dict[str, Any]:
    root = REPO_DIR / "evidence" / "benchmark"
    runs = sorted([p for p in root.glob("*-live") if (p / "results.json").exists()], reverse=True) if root.exists() else []
    if not runs:
        runs = sorted([p for p in root.glob("*") if (p / "results.json").exists()], reverse=True) if root.exists() else []
    if not runs:
        return {"run": None, "results": []}
    run: Path = runs[0]
    return {"run": run.name, "results": json.loads((run / "results.json").read_text())}


@router.get("/api/economics")
def economics() -> dict[str, Any]:
    e = load_economics()
    return {"unit_economics": e.raw, "churn_cost": e.churn_cost, "policy": policy.load_policy()}


# -- demo controls ------------------------------------------------------------------------------------
class DeployIn(BaseModel):
    release: str
    actor: str = "developer"


class FaultIn(BaseModel):
    kind: str = "provider_outage"
    value: str | None = "claude-haiku"


class AttackIn(BaseModel):
    share: float = 0.5


class TrafficIn(BaseModel):
    running: bool = True
    per_minute: float | None = None


class ToggleIn(BaseModel):
    enabled: bool


@router.post("/api/demo/reset", dependencies=[Depends(require_user_for_writes)])
def demo_reset() -> dict[str, Any]:
    rt().reset()
    return {"ok": True}


@router.post("/api/demo/deploy", dependencies=[Depends(require_user_for_writes)])
def demo_deploy(body: DeployIn) -> dict[str, Any]:
    try:
        return rt().deploy(body.release, body.actor)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/api/demo/fault", dependencies=[Depends(require_user_for_writes)])
def demo_fault(body: FaultIn) -> dict[str, Any]:
    rt().set_fault(body.kind, body.value)
    return {"ok": True, "control": rt().db.control_snapshot()}


@router.post("/api/demo/attack", dependencies=[Depends(require_user_for_writes)])
def demo_attack(body: AttackIn) -> dict[str, Any]:
    rt().set_attack(body.share)
    return {"ok": True}


@router.post("/api/traffic", dependencies=[Depends(require_user_for_writes)])
def traffic(body: TrafficIn) -> dict[str, Any]:
    rt().set_traffic(body.running, body.per_minute)
    return {"running": rt().traffic.running, "per_minute": rt().traffic.per_minute}


@router.post("/api/nightshift", dependencies=[Depends(require_user_for_writes)])
def toggle_nightshift(body: ToggleIn) -> dict[str, Any]:
    rt().nightshift.enabled = body.enabled
    rt().bus.publish({"type": "nightshift", "enabled": body.enabled})
    return {"enabled": body.enabled}


@router.post("/api/actions/{action_id}/approve", dependencies=[Depends(require_user_for_writes)])
def approve_action(action_id: int) -> dict[str, Any]:
    res = approve(rt().db, action_id, actor="console")
    rt().bus.publish({"type": "action", "action_id": action_id, "result": res})
    return res


@router.post("/api/actions/{action_id}/undo", dependencies=[Depends(require_user_for_writes)])
def undo_action(action_id: int) -> dict[str, Any]:
    from nightshift.adapters import HarborAdapter

    note = ns_actions.undo(HarborAdapter(rt().db), action_id)
    rt().bus.publish({"type": "action", "action_id": action_id, "result": note})
    return {"result": note}


@router.get("/api/stream")
async def stream() -> StreamingResponse:
    bus = rt().bus
    q = bus.subscribe()

    async def gen():
        try:
            yield "retry: 2000\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                    if event.get("workspace_id"):
                        continue  # tenant events go to /api/app/stream
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
