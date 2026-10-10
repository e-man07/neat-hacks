"""The live runtime behind the console: one ops store, Harbor traffic, Night Shift's loop, and an
event bus that fans out to Server-Sent-Events clients."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any

import httpx

from harbor import deploy as deploys
from harbor import releases
from harbor.agent import ConversationResult
from harbor.traffic import TrafficRunner
from nightshift.runner import NightShift
from ops import clock
from ops.db import OpsDB
from ops.settings import settings

log = logging.getLogger(__name__)


class EventBus:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        with self._lock:
            self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            self._subs.discard(q)

    def publish(self, event: dict[str, Any]) -> None:
        if self._loop is None:
            return
        event = {"ts": time.time(), **event}
        with self._lock:
            subs = list(self._subs)
        for q in subs:
            self._loop.call_soon_threadsafe(_offer, q, event)


def _offer(q: asyncio.Queue, event: dict[str, Any]) -> None:
    if q.full():
        try:
            q.get_nowait()
        except asyncio.QueueEmpty:  # pragma: no cover
            pass
    q.put_nowait(event)


class Runtime:
    def __init__(self, db_path: str | None = None, brain: str | None = None):
        self.db = OpsDB(db_path or settings.db_path)
        self.brain = brain or settings.harbor_brain
        self.bus = EventBus()
        self.traffic = TrafficRunner(self.db, per_minute=10, concurrency=3, brain=self.brain,
                                     on_result=self._on_conversation)
        self.nightshift = NightShift(self.db, brain=self.brain, on_event=self.bus.publish)
        self._tick_stop = threading.Event()
        self._tick_thread: threading.Thread | None = None
        self._budget_cache: tuple[float, dict[str, Any]] = (0.0, {})
        if self.db.get_control("active_release") is None:
            deploys.deploy(self.db, releases.BASELINE_RELEASE, actor="release-bot")

    # -- lifecycle --------------------------------------------------------------------------------
    def start(self) -> None:
        self._tick_stop.clear()
        self._tick_thread = threading.Thread(target=self._tick_loop, name="nightshift", daemon=True)
        self._tick_thread.start()

    def stop(self) -> None:
        self._tick_stop.set()
        self.traffic.stop()

    def _tick_loop(self) -> None:
        while not self._tick_stop.wait(3.0):
            try:
                self.nightshift.tick()
            except Exception as exc:  # pragma: no cover - keep the on-call loop alive
                log.exception("night shift tick failed: %s", exc)
                self.bus.publish({"type": "error", "message": f"night shift tick failed: {exc}"})

    def _on_conversation(self, r: ConversationResult) -> None:
        self.bus.publish({"type": "conversation", "conversation": {
            "id": r.id, "ts": time.time(), "release": r.release, "model": r.model, "brain": r.brain,
            "kind": r.scenario.kind, "message": r.scenario.message, "reply": r.reply, "error": r.error,
            "outcome": r.grade.outcome, "loss_usd": r.grade.loss_usd, "cost_usd": round(r.cost_usd, 5),
            "steps": r.steps, "trace_id": r.trace_id, "latency_ms": r.latency_ms}})

    # -- demo controls ------------------------------------------------------------------------------
    def reset(self) -> None:
        self.traffic.stop()
        self.db.reset()
        self.traffic.set_attack_share(0.0)
        clock.reset()
        deploys.deploy(self.db, releases.BASELINE_RELEASE, actor="release-bot")
        self.bus.publish({"type": "reset"})

    def deploy(self, release_id: str, actor: str = "developer") -> dict[str, Any]:
        row = deploys.deploy(self.db, release_id, actor=actor)
        self.bus.publish({"type": "deploy", "deploy": row})
        return row

    def set_fault(self, kind: str, value: str | None) -> None:
        if kind == "provider_outage":
            self.db.set_control("fault:provider_outage", value, "chaos")
        self.bus.publish({"type": "control", "control": self.db.control_snapshot()})

    def set_attack(self, share: float) -> None:
        self.traffic.set_attack_share(share)
        self.bus.publish({"type": "attack", "share": share})

    def set_traffic(self, running: bool, per_minute: float | None = None) -> None:
        if per_minute:
            self.traffic.per_minute = per_minute
        if running:
            self.traffic.start()
        else:
            self.traffic.stop()
        self.bus.publish({"type": "traffic", "running": self.traffic.running, "per_minute": self.traffic.per_minute})

    # -- read models ------------------------------------------------------------------------------
    def budget(self) -> dict[str, Any]:
        ts, cached = self._budget_cache
        if time.time() - ts < 60 and cached:
            return cached
        info: dict[str, Any] = {"available": False}
        if settings.llm_available:
            try:
                r = httpx.get(f"{settings.litellm_base_url.removesuffix('/v1')}/key/info",
                              headers={"Authorization": f"Bearer {settings.litellm_api_key}"}, timeout=8)
                d = r.json().get("info", {})
                info = {"available": True, "spend": round(d.get("spend") or 0, 4),
                        "max_budget": d.get("max_budget"), "rpm_limit": d.get("rpm_limit")}
            except Exception as exc:  # pragma: no cover - network
                info = {"available": False, "error": str(exc)[:120]}
        self._budget_cache = (time.time(), info)
        return info
