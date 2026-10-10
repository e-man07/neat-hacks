"""Product API for signed-in users: workspace, agents, onboarding, incidents, policies, integrations."""

from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import Any

import yaml
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.deps import current_user, owned_agent, platform, workspace
from nightshift import detector, reporter
from nightshift.neatlogs_mcp import NeatlogsMCP, NeatlogsMCPError
from ops import security
from ops.db import loads
from product import repos, slack

router = APIRouter(prefix="/api/app")


def _incident_row(r: dict[str, Any], agent: dict[str, Any] | None = None) -> dict[str, Any]:
    out = {"id": r["id"], "status": r["status"], "type": r["type"], "severity": r["severity"], "title": r["title"],
           "summary": r["summary"], "opened_at": r["opened_at"], "mitigated_at": r["mitigated_at"],
           "resolved_at": r["resolved_at"], "impact": loads(r["impact_json"], None)}
    if agent:
        out["agent_id"] = agent["id"]
        out["agent_name"] = agent["name"]
    return out


# -- me / overview --------------------------------------------------------------------------------------
@router.get("/me")
def me(user: security.Principal = Depends(current_user), ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    store = platform().store
    return {"user": store.user(user.user_id), "workspace": ws, "integrations": store.integrations_summary(ws["id"]),
            "slack_available": slack.configured(), "dev_mode": security.dev_mode()}


@router.get("/overview")
def overview(ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    store = platform().store
    agents = []
    open_incidents = []
    for a in store.agents_for(ws["id"]):
        db = store.agent_db(a["id"])
        totals = db.one("SELECT COUNT(*) n, COALESCE(SUM(loss_usd),0) loss, COALESCE(SUM(cost_usd),0) cost "
                        "FROM conversations WHERE replay = 0 AND ts > ?", [time.time() - 86400]) or {}
        inc = db.one("SELECT * FROM incidents WHERE status NOT IN ('RESOLVED','DEFERRED') ORDER BY opened_at DESC LIMIT 1")
        resolved = db.one("SELECT COUNT(*) n FROM incidents WHERE status IN ('RESOLVED','MONITORING')") or {}
        prevented = sum((loads(r["impact_json"], {}) or {}).get("projected_loss_if_waiting", 0)
                        for r in db.query("SELECT impact_json FROM incidents WHERE status IN ('RESOLVED','MONITORING')"))
        agents.append({**a, "runs_24h": totals.get("n", 0), "loss_24h": totals.get("loss", 0),
                       "llm_cost_24h": totals.get("cost", 0), "release": db.get_control("active_release"),
                       "open_incident": _incident_row(inc, a) if inc else None,
                       "incidents_handled": resolved.get("n", 0), "loss_prevented": round(prevented, 2)})
        if inc:
            open_incidents.append(_incident_row(inc, a))
    return {"workspace": ws, "agents": agents, "open_incidents": open_incidents}


# -- agents ---------------------------------------------------------------------------------------------
class AgentIn(BaseModel):
    name: str
    description: str = ""
    repo: str | None = None


class AgentPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    repo: str | None = None
    workflow_name: str | None = None
    root_span_name: str | None = None
    neatlogs_key: str | None = None
    status: str | None = None
    economics: dict[str, Any] | None = None
    default_model: str | None = None
    fallback_model: str | None = None


@router.get("/agents")
def list_agents(ws: dict[str, Any] = Depends(workspace)) -> list[dict[str, Any]]:
    return platform().store.agents_for(ws["id"])


@router.post("/agents")
def create_agent(body: AgentIn, ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    if not body.name.strip():
        raise HTTPException(422, "name is required")
    agent, token = platform().store.create_agent(ws["id"], body.name.strip(), body.description.strip(),
                                                 repo=(body.repo or "").strip() or None)
    return {"agent": agent, "token": token}


@router.get("/agents/{agent_id}")
def get_agent(agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    db = platform().store.agent_db(agent["id"])
    return {**agent, "control": db.control_snapshot(), "policy_version": platform().store.policy(agent["id"])["version"]}


@router.patch("/agents/{agent_id}")
def patch_agent(body: AgentPatch, agent: dict[str, Any] = Depends(owned_agent),
                user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    store = platform().store
    values = {k: v for k, v in body.model_dump().items() if v is not None and k not in ("default_model", "fallback_model")}
    if "status" in values and values["status"] not in ("live", "paused", "pending"):
        raise HTTPException(422, "status must be live, paused or pending")
    if "repo" in values:
        values["repo"] = values["repo"].strip() or None
        if values["repo"] and not repos.REPO_RE.match(values["repo"]):
            raise HTTPException(422, "repo must look like owner/name")
    updated = store.update_agent(agent["id"], **values)
    db = store.agent_db(agent["id"])
    for key in ("default_model", "fallback_model"):
        value = getattr(body, key)
        if value:
            db.set_control(key, value, f"user:{user.login}")
    if values.get("repo"):
        token = store.github_token(user.user_id)
        threading.Thread(target=_clone, args=(agent["id"], values["repo"], token), daemon=True).start()
    return updated or {}


def _clone(agent_id: str, repo: str, token: str | None) -> None:
    try:
        path = repos.ensure_clone(repo, token)
        platform().store.update_agent(agent_id, repo_dir=str(path))
    except Exception as exc:
        platform().store.update_agent(agent_id, repo_dir=None)
        print(f"clone failed for {repo}: {exc}")


@router.delete("/agents/{agent_id}")
def delete_agent(agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    platform().store.delete_agent(agent["id"])
    return {"deleted": agent["id"]}


@router.post("/agents/{agent_id}/token")
def rotate_token(agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    return {"token": platform().store.rotate_agent_token(agent["id"])}


class VerifyIn(BaseModel):
    neatlogs_key: str | None = None


@router.post("/agents/{agent_id}/neatlogs/verify")
def verify_neatlogs(body: VerifyIn, agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    """Check the neatlogs project key and discover the agent's traces (root span + workflow)."""
    store = platform().store
    key = (body.neatlogs_key or "").strip() or store.agent_secret(agent["id"]) or ""
    if not key:
        raise HTTPException(422, "paste the neatlogs project API key")
    mcp = NeatlogsMCP(api_key=key)
    try:
        who = mcp.whoami()
    except NeatlogsMCPError as exc:
        raise HTTPException(400, f"neatlogs rejected the key: {str(exc)[:200]}") from exc
    store.update_agent(agent["id"], neatlogs_key=key, neatlogs_project_id=who.get("project_id"),
                       neatlogs_project_name=who.get("project_name"))
    latest: dict[str, Any] = {}
    try:
        since = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 7 * 86400))
        ctx = mcp.call("get_trace_context", {"created_after": since})
        if isinstance(ctx, dict):
            roots = [s for s in ctx.get("spans") or [] if s.get("is_root")]
            latest = {"trace_id": ctx.get("trace_id"), "workflow": ctx.get("workflow"),
                      "root_span_name": (roots[0].get("name") if roots else ctx.get("name")),
                      "created_at": ctx.get("created_at")}
    except NeatlogsMCPError:
        latest = {}
    return {"project": who, "latest_trace": latest}


@router.get("/agents/{agent_id}/state")
def agent_state(agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    p = platform()
    db = p.store.agent_db(agent["id"])
    ns = p.nightshift_for(agent)
    stats, base, signals = detector.detect(db, since=ns.quiet_since())
    open_inc = ns.open_incident()
    totals = db.one("SELECT COUNT(*) n, COALESCE(SUM(loss_usd),0) loss, COALESCE(SUM(cost_usd),0) cost "
                    "FROM conversations WHERE replay = 0") or {}
    return {"agent": agent, "control": db.control_snapshot(), "window": stats.as_dict(), "baseline": base,
            "signals": [s.__dict__ for s in signals], "open_incident": _incident_row(open_inc, agent) if open_inc else None,
            "totals": totals, "last_seen_at": agent.get("last_seen_at")}


@router.get("/agents/{agent_id}/traces")
def agent_traces(limit: int = 50, agent: dict[str, Any] = Depends(owned_agent)) -> list[dict[str, Any]]:
    return platform().store.agent_db(agent["id"]).query(
        "SELECT id, ts, release, model, customer_message AS message, reply, error, outcome, loss_usd, cost_usd, "
        "steps, tool_errors, tokens, trace_id, latency_ms FROM conversations WHERE replay = 0 ORDER BY ts DESC LIMIT ?",
        [min(limit, 200)])


@router.get("/agents/{agent_id}/metrics")
def agent_metrics(minutes: int = 120, bucket_s: int = 300, agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    rows = platform().store.agent_db(agent["id"]).query(
        "SELECT ts, outcome, loss_usd, cost_usd FROM conversations WHERE replay = 0 AND ts >= ? ORDER BY ts",
        [time.time() - minutes * 60])
    buckets: dict[int, dict[str, Any]] = {}
    for r in rows:
        b = int(r["ts"] // bucket_s * bucket_s)
        d = buckets.setdefault(b, {"t": b, "n": 0, "failed": 0, "loss": 0.0, "cost": 0.0})
        d["n"] += 1
        d["failed"] += 1 if r["outcome"] not in ("correct",) else 0
        d["loss"] += r["loss_usd"] or 0
        d["cost"] += r["cost_usd"] or 0
    return {"bucket_s": bucket_s, "series": [buckets[k] for k in sorted(buckets)]}


@router.get("/agents/{agent_id}/deploys")
def agent_deploys(agent: dict[str, Any] = Depends(owned_agent)) -> list[dict[str, Any]]:
    return platform().store.agent_db(agent["id"]).query("SELECT * FROM deploys ORDER BY ts DESC LIMIT 30")


class ControlIn(BaseModel):
    key: str
    value: str | None = None


ALLOWED_CONTROL = ("active_release", "force_model", "max_steps_cap", "default_model", "fallback_model")


@router.put("/agents/{agent_id}/control")
def set_control(body: ControlIn, agent: dict[str, Any] = Depends(owned_agent),
                user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    if not (body.key in ALLOWED_CONTROL or body.key.startswith("flag:")):
        raise HTTPException(422, f"key must be one of {', '.join(ALLOWED_CONTROL)} or flag:<name>")
    db = platform().store.agent_db(agent["id"])
    if body.key == "active_release" and body.value:
        platform().adapter_for(agent).deploy(body.value, actor=f"user:{user.login}")
    else:
        db.set_control(body.key, body.value, f"user:{user.login}")
    return db.control_snapshot()


# -- incidents --------------------------------------------------------------------------------------------
@router.get("/incidents")
def all_incidents(ws: dict[str, Any] = Depends(workspace)) -> list[dict[str, Any]]:
    store = platform().store
    out = []
    for a in store.agents_for(ws["id"]):
        for r in store.agent_db(a["id"]).query("SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50"):
            out.append(_incident_row(r, a))
    return sorted(out, key=lambda r: r["opened_at"], reverse=True)


@router.get("/agents/{agent_id}/incidents/{iid}")
def incident(iid: str, agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    db = platform().store.agent_db(agent["id"])
    row = db.one("SELECT * FROM incidents WHERE id = ?", [iid])
    if not row:
        raise HTTPException(404)
    out = _incident_row(row, agent)
    out["signals"] = loads(row["signals_json"], {})
    out["diagnosis"] = loads(row["diagnosis_json"], None)
    out["verification"] = loads(row["verification_json"], None)
    out["events"] = [{**e, "detail": loads(e.pop("detail_json"), None)}
                     for e in db.query("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY ts", [iid])]
    out["actions"] = [{**a, "params": loads(a.pop("params_json"), {}), "undo": loads(a.pop("undo_json"), None)}
                      for a in db.query("SELECT * FROM actions WHERE incident_id = ? ORDER BY ts", [iid])]
    out["postmortem"] = reporter.postmortem(db, iid)
    return out


@router.post("/agents/{agent_id}/actions/{action_id}/approve")
def approve_action(action_id: int, agent: dict[str, Any] = Depends(owned_agent),
                   user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    res = platform().approve(agent, action_id, user.user_id, actor=user.login)
    if res.get("error"):
        raise HTTPException(400, res["error"])
    return res


@router.post("/agents/{agent_id}/actions/{action_id}/undo")
def undo_action(action_id: int, agent: dict[str, Any] = Depends(owned_agent),
                user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    return {"result": platform().undo(agent, action_id, actor=user.login)}


# -- policy -------------------------------------------------------------------------------------------------
class PolicyIn(BaseModel):
    yaml: str


@router.get("/agents/{agent_id}/policy")
def get_policy(agent: dict[str, Any] = Depends(owned_agent)) -> dict[str, Any]:
    store = platform().store
    return {**store.policy(agent["id"]), "history": store.policy_history(agent["id"])}


@router.put("/agents/{agent_id}/policy")
def put_policy(body: PolicyIn, agent: dict[str, Any] = Depends(owned_agent),
               user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    try:
        return platform().store.set_policy(agent["id"], body.yaml, created_by=user.login)
    except (ValueError, yaml.YAMLError) as exc:
        raise HTTPException(422, f"invalid policy: {exc}") from exc


# -- integrations ------------------------------------------------------------------------------------------
class IntegrationIn(BaseModel):
    config: dict[str, Any]


@router.get("/integrations")
def integrations(ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    return {"connected": platform().store.integrations_summary(ws["id"]), "slack_available": slack.configured()}


@router.get("/integrations/slack/install")
def slack_install(ws: dict[str, Any] = Depends(workspace), user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    if not slack.configured():
        raise HTTPException(400, "Slack app is not configured on this server")
    return {"url": slack.install_url(ws["id"], user.user_id)}


@router.put("/integrations/{kind}")
def put_integration(kind: str, body: IntegrationIn, ws: dict[str, Any] = Depends(workspace),
                    user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    if kind == "webhook":
        url = str(body.config.get("url", ""))
        if not url.startswith("https://"):
            raise HTTPException(422, "webhook url must be https")
        cfg = {"url": url, "url_host": url.split("/")[2]}
    elif kind == "ntfy":
        topic = str(body.config.get("topic", "")).strip()
        if len(topic) < 8:
            raise HTTPException(422, "pick an unguessable ntfy topic (8+ characters)")
        cfg = {"topic": topic}
    else:
        raise HTTPException(422, "kind must be webhook or ntfy (Slack connects with Add to Slack)")
    platform().store.set_integration(ws["id"], kind, cfg, created_by=user.login)
    return platform().store.integrations_summary(ws["id"])


@router.delete("/integrations/{kind}")
def delete_integration(kind: str, ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    platform().store.remove_integration(ws["id"], kind)
    return platform().store.integrations_summary(ws["id"])


@router.post("/integrations/test")
def test_page(ws: dict[str, Any] = Depends(workspace), user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    """Send a test page through every connected channel."""
    from nightshift import notifier
    from product.paging import make_pager

    store = platform().store
    fake_agent = {"id": "test", "name": "Night Shift", "workspace_id": ws["id"]}
    pager = make_pager(store, ws["id"], fake_agent)

    class _Probe:
        db = store.agent_db("__test__")

    return pager(_Probe(), "TEST", notifier.Page(title="🌙 Night Shift test page",
                                                 body=f"Paging works. Sent by {user.login}.", priority="low"))


# -- live stream ----------------------------------------------------------------------------------------------
@router.get("/stream")
async def stream(ws: dict[str, Any] = Depends(workspace)) -> StreamingResponse:
    bus = platform().bus
    q = bus.subscribe()

    async def gen():
        try:
            yield "retry: 2000\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                    if event.get("workspace_id") != ws["id"]:
                        continue
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
