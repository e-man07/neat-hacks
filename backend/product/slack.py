"""Slack app: "Add to Slack" install (OAuth v2), incident messages with buttons, and the
interactivity endpoint that applies approvals from Slack.

Env: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, PUBLIC_API_URL.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
import urllib.parse
from typing import Any

import httpx

from ops import security

log = logging.getLogger(__name__)

SCOPES = "chat:write,chat:write.public,incoming-webhook,commands"


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def configured() -> bool:
    return bool(_env("SLACK_CLIENT_ID") and _env("SLACK_CLIENT_SECRET") and _env("SLACK_SIGNING_SECRET"))


def redirect_uri() -> str:
    return f"{_env('PUBLIC_API_URL').rstrip('/')}/slack/oauth/callback"


def install_url(workspace_id: str, user_id: str) -> str:
    state = security.sign_state({"ws": workspace_id, "uid": user_id})
    q = urllib.parse.urlencode({"client_id": _env("SLACK_CLIENT_ID"), "scope": SCOPES,
                                "redirect_uri": redirect_uri(), "state": state})
    return f"https://slack.com/oauth/v2/authorize?{q}"


def exchange_code(code: str) -> dict[str, Any]:
    r = httpx.post("https://slack.com/api/oauth.v2.access", data={
        "client_id": _env("SLACK_CLIENT_ID"), "client_secret": _env("SLACK_CLIENT_SECRET"),
        "code": code, "redirect_uri": redirect_uri()}, timeout=20)
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"slack oauth failed: {data.get('error')}")
    hook = data.get("incoming_webhook") or {}
    return {"bot_token": data.get("access_token"), "team_id": (data.get("team") or {}).get("id"),
            "team_name": (data.get("team") or {}).get("name"), "channel": hook.get("channel"),
            "channel_id": hook.get("channel_id"), "webhook_url": hook.get("url"),
            "installed_by": (data.get("authed_user") or {}).get("id")}


def verify_request(body: bytes, timestamp: str | None, signature: str | None) -> bool:
    secret = _env("SLACK_SIGNING_SECRET")
    if not (secret and timestamp and signature):
        return False
    if abs(time.time() - int(timestamp)) > 300:
        return False
    base = b"v0:" + timestamp.encode() + b":" + body
    expected = "v0=" + hmac.new(secret.encode(), base, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _api(token: str, method: str, payload: dict[str, Any]) -> dict[str, Any]:
    r = httpx.post(f"https://slack.com/api/{method}", json=payload,
                   headers={"Authorization": f"Bearer {token}"}, timeout=15)
    data = r.json()
    if not data.get("ok"):
        log.warning("slack %s failed: %s", method, data.get("error"))
    return data


def incident_blocks(title: str, body: str, agent_name: str, incident_id: str, agent_id: str,
                    web_url: str, proposal_id: int | None, undo_id: int | None, status: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        {"type": "header", "text": {"type": "plain_text", "text": title[:150]}},
        {"type": "section", "text": {"type": "mrkdwn", "text": body[:2900]}},
        {"type": "context", "elements": [{"type": "mrkdwn",
                                          "text": f"*{agent_name}* · `{incident_id}` · status *{status}*"}]},
    ]
    buttons: list[dict[str, Any]] = []
    if proposal_id:
        buttons.append({"type": "button", "style": "primary", "text": {"type": "plain_text", "text": "Approve fix"},
                        "action_id": "approve", "value": json.dumps({"a": agent_id, "x": proposal_id, "i": incident_id})})
    if undo_id:
        buttons.append({"type": "button", "style": "danger", "text": {"type": "plain_text", "text": "Undo containment"},
                        "action_id": "undo", "value": json.dumps({"a": agent_id, "x": undo_id, "i": incident_id}),
                        "confirm": {"title": {"type": "plain_text", "text": "Undo Nightly's action?"},
                                    "text": {"type": "mrkdwn", "text": "This puts the previous config back in production."},
                                    "confirm": {"type": "plain_text", "text": "Undo"},
                                    "deny": {"type": "plain_text", "text": "Cancel"}}})
    buttons.append({"type": "button", "text": {"type": "plain_text", "text": "Open in Nightly"},
                    "url": web_url, "action_id": "open"})
    blocks.append({"type": "actions", "elements": buttons})
    return blocks


def post_or_update(config: dict[str, Any], blocks: list[dict[str, Any]], text: str,
                   existing: dict[str, Any] | None) -> dict[str, Any] | None:
    token = config.get("bot_token")
    channel = (existing or {}).get("channel") or config.get("channel_id")
    if not (token and channel):
        return None
    if existing:
        data = _api(token, "chat.update", {"channel": channel, "ts": existing["ts"], "text": text, "blocks": blocks})
    else:
        data = _api(token, "chat.postMessage", {"channel": channel, "text": text, "blocks": blocks,
                                                "unfurl_links": False})
    if data.get("ok"):
        return {"channel": data.get("channel", channel), "ts": data.get("ts", (existing or {}).get("ts"))}
    return None


def post_thread_note(config: dict[str, Any], ref: dict[str, Any], text: str) -> None:
    token = config.get("bot_token")
    if token and ref:
        _api(token, "chat.postMessage", {"channel": ref["channel"], "thread_ts": ref["ts"], "text": text})
