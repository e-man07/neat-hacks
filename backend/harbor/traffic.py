"""Background customer traffic: a steady stream of conversations against the live config."""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from harbor.agent import ConversationResult, run_conversation
from harbor.scenarios import TrafficMix
from ops.db import OpsDB

log = logging.getLogger(__name__)


class TrafficRunner:
    def __init__(self, db: OpsDB, per_minute: float = 12.0, concurrency: int = 3,
                 brain: str | None = None, on_result: Callable[[ConversationResult], None] | None = None,
                 seed: int = 3):
        self.db = db
        self.per_minute = per_minute
        self.brain = brain
        self.mix = TrafficMix(seed)
        self.on_result = on_result
        self._pool = ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="harbor")
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._inflight = 0
        self._lock = threading.Lock()
        self.max_inflight = concurrency * 2

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def set_attack_share(self, share: float) -> None:
        self.mix.attack_share = max(0.0, min(1.0, share))

    def _one(self) -> None:
        try:
            result = run_conversation(self.mix.next(), db=self.db, brain=self.brain)
            if self.on_result:
                self.on_result(result)
        except Exception as exc:  # pragma: no cover - logged, traffic keeps flowing
            log.exception("conversation crashed: %s", exc)
        finally:
            with self._lock:
                self._inflight -= 1

    def _loop(self) -> None:
        while not self._stop.is_set():
            interval = 60.0 / max(self.per_minute, 0.1)
            with self._lock:
                busy = self._inflight >= self.max_inflight
                if not busy:
                    self._inflight += 1
            if not busy:
                self._pool.submit(self._one)
            self._stop.wait(interval)

    def start(self) -> None:
        if self.running:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="traffic", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self._thread = None

    def burst(self, n: int) -> list[ConversationResult]:
        """Run n conversations synchronously (benchmarks, tests)."""
        futures = [self._pool.submit(run_conversation, self.mix.next(), self.db, self.brain) for _ in range(n)]
        return [f.result() for f in futures]
