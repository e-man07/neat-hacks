"""Workspace paging: Slack (with buttons), a generic webhook, and ntfy — whichever are connected."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from nightshift import notifier
from product import slack
from product.store import ProductStore

log = logging.getLogger(__name__)


def web_url(path: str) -> str:
    return os.environ.get("PUBLIC_WEB_URL", os.environ.get("PUBLIC_BASE_URL", "http://localhost:3000")).rstrip("/") + path


def incident_buttons(adapter: Any, incident_id: str) -> tuple[int | None, int | None, str]:
    db = adapter.db
    proposal = db.one("SELECT id FROM actions WHERE incident_id = ? AND status = 'proposed' "
                      "ORDER BY (kind = 'deploy_code_fix') DESC, ts DESC LIMIT 1", [incident_id])
    applied = db.one("SELECT id FROM actions WHERE incident_id = ? AND status = 'applied' AND mode = 'auto' "
                     "ORDER BY ts DESC LIMIT 1", [incident_id])
    inc = db.one("SELECT status FROM incidents WHERE id = ?", [incident_id]) or {}
    return (proposal or {}).get("id"), (applied or {}).get("id"), inc.get("status", "OPEN")


def make_pager(store: ProductStore, workspace_id: str, agent: dict[str, Any]):
    def pager(adapter: Any, incident_id: str, page: notifier.Page) -> dict[str, Any]:
        delivered: list[str] = []
        errors: list[str] = []
        url = web_url(f"/app/incidents/{agent['id']}/{incident_id}")
        cfg = store.integration(workspace_id, "slack")
        if cfg:
            try:
                proposal_id, undo_id, status = incident_buttons(adapter, incident_id)
                blocks = slack.incident_blocks(page.title, page.body, agent["name"], incident_id, agent["id"], url,
                                               proposal_id, undo_id, status)
                existing = store.slack_message(incident_id)
                ref = slack.post_or_update(cfg, blocks, f"{page.title} — {page.body}", existing)
                if ref:
                    store.set_slack_message(incident_id, ref["channel"], ref["ts"])
                    if existing:  # one message per incident, updated in place; news goes in the thread
                        slack.post_thread_note(cfg, ref, f"*{page.title}*\n{page.body}")
                    delivered.append(f"slack {cfg.get('channel') or ''}".strip())
            except Exception as exc:  # paging must never break the incident flow
                errors.append(f"slack: {exc}")
        hook = store.integration(workspace_id, "webhook")
        if hook and hook.get("url"):
            try:
                httpx.post(hook["url"], json={"title": page.title, "body": page.body, "priority": page.priority,
                                              "incident_id": incident_id, "agent_id": agent["id"], "url": url},
                           timeout=10).raise_for_status()
                delivered.append("webhook")
            except Exception as exc:
                errors.append(f"webhook: {exc}")
        ntfy = store.integration(workspace_id, "ntfy")
        if ntfy and ntfy.get("topic"):
            try:
                httpx.post(f"https://ntfy.sh/{ntfy['topic']}", content=page.body.encode(),
                           headers={"Title": page.title.encode("utf-8").decode("latin-1", "ignore"),
                                    "Priority": page.priority, "Click": url, "Tags": "crescent_moon"},
                           timeout=10).raise_for_status()
                delivered.append("ntfy")
            except Exception as exc:
                errors.append(f"ntfy: {exc}")
        return {"delivered": delivered or ["console"], "errors": errors, "title": page.title, "body": page.body,
                "click_url": url}

    return pager
