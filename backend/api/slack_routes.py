"""Slack: install callback and interactivity (Approve / Undo buttons)."""

from __future__ import annotations

import json
import os
import threading
import urllib.parse
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from api.deps import platform
from ops import security
from product import slack

router = APIRouter(prefix="/slack")


def _web(path: str) -> str:
    return os.environ.get("PUBLIC_WEB_URL", "http://localhost:3000").rstrip("/") + path


@router.get("/oauth/callback")
def oauth_callback(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    if error:
        return RedirectResponse(_web(f"/app/integrations?slack=error&reason={urllib.parse.quote(error)}"))
    claims = security.verify_state(state)
    if not claims:
        raise HTTPException(400, "invalid or expired state")
    try:
        cfg = slack.exchange_code(code)
    except RuntimeError as exc:
        return RedirectResponse(_web(f"/app/integrations?slack=error&reason={urllib.parse.quote(str(exc))}"))
    platform().store.set_integration(claims["ws"], "slack", cfg, created_by=claims.get("uid"))
    return RedirectResponse(_web("/app/integrations?slack=connected"))


def _workspace_for_team(team_id: str) -> str | None:
    store = platform().store
    for row in store.db.query("SELECT workspace_id FROM integrations WHERE kind = 'slack'"):
        cfg = store.integration(row["workspace_id"], "slack") or {}
        if cfg.get("team_id") == team_id:
            return row["workspace_id"]
    return None


@router.post("/actions")
async def actions(request: Request) -> JSONResponse:
    body = await request.body()
    if not slack.verify_request(body, request.headers.get("x-slack-request-timestamp"),
                                request.headers.get("x-slack-signature")):
        raise HTTPException(401, "bad signature")
    form = urllib.parse.parse_qs(body.decode())
    payload = json.loads(form.get("payload", ["{}"])[0])
    action = (payload.get("actions") or [{}])[0]
    if action.get("action_id") not in ("approve", "undo"):
        return JSONResponse({})
    value = json.loads(action.get("value") or "{}")
    ws_id = _workspace_for_team((payload.get("team") or {}).get("id", ""))
    store = platform().store
    agent = store.agent(value.get("a", ""))
    if not ws_id or not agent or agent["workspace_id"] != ws_id:
        return JSONResponse({"response_type": "ephemeral", "text": "This incident isn't in your Nightly workspace."})
    who = (payload.get("user") or {}).get("username") or (payload.get("user") or {}).get("name") or "slack user"
    owner = store.owner_of(ws_id) or ""

    def work() -> None:
        if action["action_id"] == "approve":
            platform().approve(agent, int(value["x"]), owner, actor=f"{who} (Slack)")
        else:
            platform().undo(agent, int(value["x"]), actor=f"{who} (Slack)")

    threading.Thread(target=work, daemon=True).start()  # Slack needs an answer within 3 s
    return JSONResponse({})
