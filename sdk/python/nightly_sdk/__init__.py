"""Nightly SDK: read the control plane Nightly steers, report deploys and outcomes, and run
verification replays. Zero dependencies; fail-open by design."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Optional

__all__ = ["Nightly", "NightShift", "current_trace_id"]
__version__ = "0.1.0"

log = logging.getLogger("nightly_sdk")


def current_trace_id() -> Optional[str]:
    """The active OpenTelemetry/neatlogs trace id, if tracing is on (else None)."""
    try:
        from opentelemetry import trace  # type: ignore

        ctx = trace.get_current_span().get_span_context()
        return format(ctx.trace_id, "032x") if ctx and ctx.trace_id else None
    except Exception:
        return None


class Nightly:
    def __init__(self, api_url: Optional[str] = None, token: Optional[str] = None, refresh_s: float = 5.0,
                 timeout_s: float = 4.0):
        self.api_url = (api_url or os.environ.get("NIGHTLY_API_URL") or os.environ.get("NIGHTLY_API_URL", "")).rstrip("/")
        self.token = token or os.environ.get("NIGHTLY_AGENT_TOKEN") or os.environ.get("NIGHTLY_AGENT_TOKEN", "")
        self.refresh_s = refresh_s
        self.timeout_s = timeout_s
        self._config: dict[str, Any] = {}
        self._fetched_at = 0.0
        self._lock = threading.Lock()
        self._replay_thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    # -- transport --------------------------------------------------------------------------------
    @property
    def enabled(self) -> bool:
        return bool(self.api_url and self.token)

    def _request(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{self.api_url}{path}", data=data, method=method, headers={
            "Authorization": f"Bearer {self.token}", "Content-Type": "application/json",
            "User-Agent": f"nightly-sdk/{__version__}"})
        with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None

    # -- control plane ------------------------------------------------------------------------------
    def config(self, force: bool = False) -> dict[str, Any]:
        if not self.enabled:
            return {}
        with self._lock:
            if not force and time.time() - self._fetched_at < self.refresh_s:
                return self._config
            try:
                self._config = self._request("GET", "/v1/control") or {}
            except (urllib.error.URLError, OSError, ValueError) as exc:
                log.debug("nightly unreachable, using last known config: %s", exc)
            self._fetched_at = time.time()
            return self._config

    def release(self, default: str) -> str:
        return self.config().get("active_release") or default

    def model(self, default: str) -> str:
        c = self.config()
        return c.get("force_model") or default

    def flag(self, name: str, default: bool = True) -> bool:
        value = self.config().get(f"flag:{name}")
        if value is None:
            return default
        return str(value).lower() in ("1", "true", "on", "yes")

    def max_steps(self, default: int) -> int:
        cap = self.config().get("max_steps_cap")
        return min(default, int(cap)) if cap else default

    # -- reporting ----------------------------------------------------------------------------------
    def report_deploy(self, release: str, commit: Optional[str] = None, actor: str = "ci",
                      default_model: Optional[str] = None) -> bool:
        return self._post("/v1/deploys", {"release": release, "commit": commit, "actor": actor,
                                           "default_model": default_model})

    def record(self, outcome: str, trace_id: Optional[str] = None, value_usd: float = 0.0,
               release: Optional[str] = None, model: Optional[str] = None, note: Optional[str] = None,
               **run: Any) -> bool:
        """outcome: ok | failed | escalated | negative. value_usd: money lost on this run, if any.

        Optional run details (input, output, steps, tool_errors, tokens, latency_ms, cost_usd) let Night
        Shift count the run even when its trace is late or never exported."""
        allowed = {"input", "output", "steps", "tool_errors", "tokens", "latency_ms", "cost_usd"}
        body = {"outcome": outcome, "trace_id": trace_id or current_trace_id(), "value_usd": value_usd,
                "release": release, "model": model, "note": note}
        body.update({k: v for k, v in run.items() if k in allowed and v is not None})
        return self._post("/v1/events", body)

    def _post(self, path: str, body: dict) -> bool:
        if not self.enabled:
            return False
        try:
            self._request("POST", path, body)
            return True
        except (urllib.error.URLError, OSError, ValueError) as exc:
            log.debug("nightly post %s failed: %s", path, exc)
            return False

    # -- verification hook ------------------------------------------------------------------------------
    def serve_replays(self, handler: Callable[[str], dict[str, Any]], poll_s: float = 3.0) -> None:
        """Run Nightly's replay jobs through your agent in a background thread.

        handler(input_text) must run the agent on the current config without side effects and return
        {"ok": bool, "output": str, "trace_id": optional str}.
        """
        if not self.enabled or self._replay_thread:
            return

        def loop() -> None:
            while not self._stop.is_set():
                try:
                    job = self._request("GET", "/v1/replays/next")
                except (urllib.error.URLError, OSError, ValueError):
                    job = None
                if job and job.get("id"):
                    results = []
                    for item in job.get("inputs", []):
                        try:
                            self.config(force=True)
                            r = handler(item["input"]) or {}
                            results.append({"trace_id": item.get("trace_id"), "ok": bool(r.get("ok")),
                                            "output": str(r.get("output", ""))[:500],
                                            "replay_trace": r.get("trace_id")})
                        except Exception as exc:  # a crash is a failed replay, not a crash of the agent
                            results.append({"trace_id": item.get("trace_id"), "ok": False, "error": str(exc)[:300]})
                    self._post(f"/v1/replays/{job['id']}/results", {"results": results})
                    continue
                self._stop.wait(poll_s)

        self._replay_thread = threading.Thread(target=loop, name="nightly-replays", daemon=True)
        self._replay_thread.start()

    def close(self) -> None:
        self._stop.set()


# The product was called Nightly during development; keep the old name importable.
NightShift = Nightly
