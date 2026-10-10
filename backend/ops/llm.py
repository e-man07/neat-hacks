"""LLM access through the LiteLLM gateway (OpenAI-compatible), traced by neatlogs.

Also owns the price table (fetched from the gateway's /model/info, static fallback) and the
provider-outage fault switch used by incident I4.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx
import neatlogs
from openai import OpenAI

from ops.settings import settings
from ops.tracing import init_tracing

log = logging.getLogger(__name__)

# USD per token (input, output). Matches the gateway's /model/info on 2026-10-11.
STATIC_PRICES: dict[str, tuple[float, float]] = {
    "claude-haiku": (1.1e-06, 5.5e-06),
    "claude-sonnet-4.6": (3.3e-06, 1.65e-05),
    "claude-opus-4.6": (5.5e-06, 2.75e-05),
    "nova-micro": (3.5e-08, 1.4e-07),
    "nova-lite": (6e-08, 2.4e-07),
    "nova-pro": (8e-07, 3.2e-06),
    "nova-2-lite": (3.3e-07, 2.75e-06),
}

_prices: dict[str, tuple[float, float]] = dict(STATIC_PRICES)
_prices_loaded = False
_client: OpenAI | None = None
_client_lock = threading.Lock()


class ProviderOutage(RuntimeError):
    """Raised when the primary model is unavailable (real error or injected fault)."""


@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens


def load_prices() -> dict[str, tuple[float, float]]:
    global _prices_loaded
    if _prices_loaded or not settings.llm_available:
        return _prices
    try:
        resp = httpx.get(
            f"{settings.litellm_base_url}/model/info",
            headers={"Authorization": f"Bearer {settings.litellm_api_key}"},
            timeout=10,
        )
        resp.raise_for_status()
        for model in resp.json().get("data", []):
            info = model.get("model_info") or {}
            cin, cout = info.get("input_cost_per_token"), info.get("output_cost_per_token")
            if cin is not None and cout is not None:
                _prices[model["model_name"]] = (float(cin), float(cout))
    except Exception as exc:  # pragma: no cover - network
        log.warning("price table fetch failed, using static prices: %s", exc)
    _prices_loaded = True
    return _prices


def cost_usd(model: str, usage: Usage) -> float:
    cin, cout = load_prices().get(model, STATIC_PRICES.get("claude-haiku"))
    return usage.prompt_tokens * cin + usage.completion_tokens * cout


def client() -> OpenAI:
    """OpenAI client pointed at the gateway and wrapped by neatlogs for auto-tracing."""
    global _client
    with _client_lock:
        if _client is None:
            init_tracing()
            raw = OpenAI(
                base_url=settings.litellm_base_url,
                api_key=settings.litellm_api_key or "missing",
                timeout=60,
                max_retries=1,
            )
            _client = neatlogs.wrap(raw)
        return _client


def chat(
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 600,
    temperature: float = 0.2,
    outage_models: set[str] | None = None,
) -> tuple[Any, Usage]:
    """One chat completion. `outage_models` simulates a provider outage for those models."""
    if outage_models and model in outage_models:
        raise ProviderOutage(f"503 Service Unavailable from provider for model '{model}' (injected fault)")
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if tools:
        kwargs["tools"] = tools
    resp = None
    for attempt in range(4):
        try:
            resp = client().chat.completions.create(**kwargs)
            break
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            if status == 429 and attempt < 3:  # gateway rate limit (60 rpm): back off, not an outage
                time.sleep(4 * (attempt + 1))
                continue
            if status in (500, 502, 503, 504) or "unavailable" in str(exc).lower():
                raise ProviderOutage(f"{status or 'error'} from provider for model '{model}': {exc}") from exc
            raise
    usage = Usage(
        prompt_tokens=getattr(resp.usage, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(resp.usage, "completion_tokens", 0) or 0,
    )
    return resp.choices[0].message, usage
