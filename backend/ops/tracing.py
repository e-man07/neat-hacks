"""neatlogs tracing helpers.

One `neatlogs.init()` per process. Harbor and Night Shift each open their own WORKFLOW root with a
per-root workflow name, as the neatlogs "multiple workflows in one codebase" guide describes.
When no neatlogs key is configured, spans are still created locally but nothing is exported.
"""

from __future__ import annotations

import contextlib
import logging
import threading
from typing import Any, Iterator

import neatlogs

from ops.settings import settings

log = logging.getLogger(__name__)

_init_lock = threading.Lock()
_initialized = False


def init_tracing(tags: list[str] | None = None) -> bool:
    """Initialise neatlogs once. Returns True when traces are exported."""
    global _initialized
    with _init_lock:
        if _initialized:
            return settings.neatlogs_available
        neatlogs.init(
            api_key=settings.neatlogs_api_key or None,
            workflow_name="nightshift-system",
            tags=tags or ["app:nightshift"],
            disable_export=not settings.neatlogs_available,
            register_shutdown_handlers=True,
        )
        _initialized = True
        return settings.neatlogs_available


def _trace_id_of(span: Any) -> str | None:
    try:
        ctx = span.get_span_context()
        if ctx and ctx.trace_id:
            return format(ctx.trace_id, "032x")
    except Exception:  # pragma: no cover - defensive
        return None
    return None


@contextlib.contextmanager
def workflow(name: str, workflow_name: str, **attributes: Any) -> Iterator[tuple[Any, str | None]]:
    """Open a WORKFLOW root span. Yields (span, trace_id)."""
    init_tracing()
    with neatlogs.trace(name, kind="WORKFLOW") as span:
        try:
            span.set_attribute("neatlogs.workflow_name", workflow_name)
            for key, value in attributes.items():
                if value is not None:
                    span.set_attribute(key, value if isinstance(value, (str, int, float, bool)) else str(value))
        except Exception:  # pragma: no cover - span may be a no-op
            pass
        yield span, _trace_id_of(span)


@contextlib.contextmanager
def child(name: str, kind: str = "CHAIN", **attributes: Any) -> Iterator[Any]:
    """Open a child span inside the current trace."""
    init_tracing()
    with neatlogs.trace(name, kind=kind) as span:
        try:
            for key, value in attributes.items():
                if value is not None:
                    span.set_attribute(key, value if isinstance(value, (str, int, float, bool)) else str(value))
        except Exception:  # pragma: no cover
            pass
        yield span


def set_attrs(span: Any, **attributes: Any) -> None:
    for key, value in attributes.items():
        if value is None:
            continue
        try:
            span.set_attribute(key, value if isinstance(value, (str, int, float, bool)) else str(value))
        except Exception:  # pragma: no cover
            pass


def flush() -> None:
    if _initialized:
        try:
            neatlogs.flush()
        except Exception as exc:  # pragma: no cover
            log.warning("neatlogs flush failed: %s", exc)
