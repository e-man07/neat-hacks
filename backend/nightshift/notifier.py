"""Paging: ntfy.sh push (no account needed) and optional Telegram. Always logged locally."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from ops.settings import settings

log = logging.getLogger(__name__)


@dataclass
class Page:
    title: str
    body: str
    priority: str = "high"  # min | low | default | high | urgent
    tags: tuple[str, ...] = ("rotating_light",)
    click_url: str | None = None


def send(page: Page) -> dict[str, Any]:
    delivered: list[str] = []
    errors: list[str] = []
    if settings.ntfy_topic:
        try:
            headers = {"Title": page.title.encode("utf-8").decode("latin-1", "ignore"),
                       "Priority": page.priority, "Tags": ",".join(page.tags)}
            if page.click_url:
                headers["Click"] = page.click_url
            r = httpx.post(f"https://ntfy.sh/{settings.ntfy_topic}", content=page.body.encode("utf-8"),
                           headers=headers, timeout=10)
            r.raise_for_status()
            delivered.append("ntfy")
        except Exception as exc:  # pragma: no cover - network
            errors.append(f"ntfy: {exc}")
    if settings.telegram_bot_token and settings.telegram_chat_id:
        try:
            text = f"*{page.title}*\n{page.body}" + (f"\n{page.click_url}" if page.click_url else "")
            r = httpx.post(f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                           json={"chat_id": settings.telegram_chat_id, "text": text, "parse_mode": "Markdown"},
                           timeout=10)
            r.raise_for_status()
            delivered.append("telegram")
        except Exception as exc:  # pragma: no cover - network
            errors.append(f"telegram: {exc}")
    log.info("PAGE %s — %s", page.title, page.body)
    return {"delivered": delivered or ["console"], "errors": errors, "title": page.title, "body": page.body,
            "click_url": page.click_url}
