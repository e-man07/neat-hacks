"""Endpoints the SDK calls from inside a customer's agent (agent token auth)."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.deps import platform, sdk_agent
from nightshift import sources

router = APIRouter(prefix="/v1")


def _touch(agent: dict[str, Any]) -> None:
    store = platform().store
    values: dict[str, Any] = {"last_seen_at": time.time()}
    if agent["status"] == "pending" and agent.get("has_neatlogs_key") and agent.get("root_span_name"):
        values["status"] = "live"
    store.update_agent(agent["id"], **values)


@router.get("/control")
def control(agent: dict[str, Any] = Depends(sdk_agent)) -> dict[str, Any]:
    _touch(agent)
    return platform().store.agent_db(agent["id"]).control_snapshot()


class DeployIn(BaseModel):
    release: str
    commit: str | None = None
    actor: str = "ci"
    default_model: str | None = None


@router.post("/deploys")
def deploy(body: DeployIn, agent: dict[str, Any] = Depends(sdk_agent)) -> dict[str, Any]:
    if not body.release.strip():
        raise HTTPException(422, "release is required")
    p = platform()
    adapter = p.adapter_for(agent)
    db = adapter.db
    if body.default_model:
        db.set_control("default_model", body.default_model, body.actor)
    from harbor.deploy import record_deploy

    row = record_deploy(db, body.release.strip(), actor=body.actor, commit_sha=body.commit)
    p.publish(agent, {"type": "deploy", "deploy": row})
    return row


class EventIn(BaseModel):
    outcome: str
    trace_id: str | None = None
    value_usd: float = 0.0
    release: str | None = None
    model: str | None = None
    note: str | None = None
    # run details, so the run counts even if its trace never reaches neatlogs
    input: str | None = None
    output: str | None = None
    steps: int | None = None
    tool_errors: int | None = None
    tokens: int | None = None
    latency_ms: float | None = None
    cost_usd: float | None = None


@router.post("/events")
def event(body: EventIn, agent: dict[str, Any] = Depends(sdk_agent)) -> dict[str, Any]:
    if body.outcome not in ("ok", "failed", "escalated", "negative"):
        raise HTTPException(422, "outcome must be ok, failed, escalated or negative")
    econ = agent.get("economics") or {}
    sources.apply_event(platform().store.agent_db(agent["id"]), body.model_dump(),
                        float(econ.get("cost_per_failed_run_usd", 5.0)))
    return {"ok": True}


@router.get("/replays/next")
def next_replay(agent: dict[str, Any] = Depends(sdk_agent)) -> dict[str, Any]:
    _touch(agent)
    return platform().store.claim_replay_job(agent["id"]) or {}


class ReplayResults(BaseModel):
    results: list[dict[str, Any]]


@router.post("/replays/{job_id}/results")
def replay_results(job_id: str, body: ReplayResults, agent: dict[str, Any] = Depends(sdk_agent)) -> dict[str, Any]:
    job = platform().store.replay_job(job_id)
    if not job or job["agent_id"] != agent["id"]:
        raise HTTPException(404)
    platform().store.finish_replay_job(job_id, body.results)
    return {"ok": True}
