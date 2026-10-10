"""Minimal client for the neatlogs MCP server (Streamable HTTP, project API key as bearer).

The Public REST API needs a service-account token; the MCP server accepts the project key, so
Night Shift reads traces and manages detections through it.
"""

from __future__ import annotations

import itertools
import json
import logging
import threading
from typing import Any

import httpx

from ops.settings import settings

log = logging.getLogger(__name__)


class NeatlogsMCPError(RuntimeError):
    pass


class NeatlogsMCP:
    def __init__(self, url: str | None = None, api_key: str | None = None, timeout: float = 45.0):
        self.url = url or settings.neatlogs_mcp_url
        self.api_key = api_key if api_key is not None else settings.neatlogs_api_key
        self.timeout = timeout
        self._session_id: str | None = None
        self._ids = itertools.count(1)
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            h["Mcp-Session-Id"] = self._session_id
        return h

    @staticmethod
    def _parse(resp: httpx.Response) -> dict[str, Any] | None:
        text = resp.text
        if "text/event-stream" in resp.headers.get("content-type", ""):
            for line in text.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[5:].strip())
            return None
        return json.loads(text) if text.strip() else None

    def _post(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        resp = httpx.post(self.url, headers=self._headers(), json=payload, timeout=self.timeout)
        if resp.status_code >= 400:
            raise NeatlogsMCPError(f"MCP HTTP {resp.status_code}: {resp.text[:300]}")
        sid = resp.headers.get("mcp-session-id")
        if sid:
            self._session_id = sid
        return self._parse(resp)

    def _ensure_session(self) -> None:
        if self._session_id:
            return
        self._post({
            "jsonrpc": "2.0", "id": next(self._ids), "method": "initialize",
            "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                       "clientInfo": {"name": "nightshift", "version": "0.1"}},
        })
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def call(self, tool: str, arguments: dict[str, Any] | None = None) -> Any:
        if not self.available:
            raise NeatlogsMCPError("NEATLOGS_API_KEY not configured")
        with self._lock:
            for attempt in range(2):
                try:
                    self._ensure_session()
                    msg = self._post({"jsonrpc": "2.0", "id": next(self._ids), "method": "tools/call",
                                      "params": {"name": tool, "arguments": arguments or {}}})
                    break
                except NeatlogsMCPError:
                    if attempt:
                        raise
                    self._session_id = None  # session expired: re-initialise once
        if msg is None:
            raise NeatlogsMCPError(f"empty MCP response for {tool}")
        if "error" in msg:
            raise NeatlogsMCPError(f"{tool}: {msg['error']}")
        result = msg.get("result", {})
        texts = [c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"]
        joined = "\n".join(texts)
        if result.get("isError"):
            raise NeatlogsMCPError(f"{tool}: {joined[:500]}")
        try:
            return json.loads(joined)
        except json.JSONDecodeError:
            return joined

    # -- convenience wrappers ----------------------------------------------------------------
    def whoami(self) -> dict[str, Any]:
        return self.call("whoami")

    def search_traces(self, query: str, limit: int = 10, **filters: Any) -> dict[str, Any]:
        args = {"query": query, "limit": limit, **{k: v for k, v in filters.items() if v is not None}}
        return self.call("search_traces", args)

    def get_trace_context(self, trace_id: str, max_chars_per_field: int = 1200) -> dict[str, Any]:
        """Full trace context. (Selective fields/limits are disabled server-side, so clip here.)"""
        ctx = self.call("get_trace_context", {"trace_id": trace_id})
        if isinstance(ctx, dict):
            for span in ctx.get("spans") or []:
                for key in ("input_value", "output_value"):
                    val = span.get(key)
                    if isinstance(val, str) and len(val) > max_chars_per_field:
                        half = max_chars_per_field // 2
                        span[key] = val[:half] + " … " + val[-half:]
        return ctx

    def list_detections(self) -> Any:
        return self.call("list_detections")

    def list_detection_groups(self) -> Any:
        return self.call("list_detection_groups")

    def create_detection_group(self, name: str) -> Any:
        return self.call("create_detection_group", {"name": name})

    def preview_detection(self, config: dict[str, Any], timeframe_days: int = 1) -> Any:
        return self.call("preview_detection", {"type": "regex", "config": config, "timeframe_days": timeframe_days,
                                               "limit": 5})

    def create_detection(self, display_name: str, group_id: str, config: dict[str, Any],
                         description: str) -> Any:
        return self.call("create_detection", {"display_name": display_name, "group_id": group_id,
                                              "type": "regex", "config": config, "description": description})
