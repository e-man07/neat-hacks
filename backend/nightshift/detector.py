"""Detection: sliding window over production conversations vs. a baseline.

Signals are the ones a real team has: the refund ledger reconciled against policy (wrong refunds),
conversations that ended without a reply (failures), tool errors in traces, and cost per
conversation. Ground-truth scenario labels are never used here.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any

from ops.db import OpsDB

WINDOW = 10            # most recent conversations considered
MIN_SAMPLES = 6        # don't judge on fewer
MAX_AGE_S = 15 * 60    # ignore stale conversations

DEFAULT_BASELINE = {"loss_per_conv": 0.0, "failed_rate": 0.0, "tool_error_rate": 0.0,
                    "cost_per_conv": 0.0055, "wrong_refund_rate": 0.0, "avg_steps": 2.6}


@dataclass
class WindowStats:
    n: int
    loss_per_conv: float
    wrong_refund_rate: float
    failed_rate: float
    tool_error_rate: float
    cost_per_conv: float
    avg_steps: float
    escalation_rate: float
    total_loss: float
    first_ts: float | None
    last_ts: float | None
    releases: list[str] = field(default_factory=list)
    models: list[str] = field(default_factory=list)
    conversation_ids: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Signal:
    name: str
    value: float
    baseline: float
    threshold: float
    description: str


def _stats(rows: list[dict[str, Any]]) -> WindowStats:
    n = len(rows)
    if n == 0:
        return WindowStats(0, 0, 0, 0, 0, 0, 0, 0, 0, None, None)
    f = lambda pred: sum(1 for r in rows if pred(r)) / n  # noqa: E731
    return WindowStats(
        n=n,
        loss_per_conv=sum(r["loss_usd"] or 0 for r in rows) / n,
        wrong_refund_rate=f(lambda r: r["outcome"] == "wrong_refund"),
        failed_rate=f(lambda r: r["outcome"] == "failed"),
        tool_error_rate=f(lambda r: (r["tool_errors"] or 0) > 0),
        cost_per_conv=sum(r["cost_usd"] or 0 for r in rows) / n,
        avg_steps=sum(r["steps"] or 0 for r in rows) / n,
        escalation_rate=f(lambda r: r["outcome"] == "escalated"),
        total_loss=sum(r["loss_usd"] or 0 for r in rows),
        first_ts=min(r["ts"] for r in rows),
        last_ts=max(r["ts"] for r in rows),
        releases=sorted({r["release"] for r in rows}),
        models=sorted({r["model"] for r in rows}),
        conversation_ids=[r["id"] for r in rows],
    )


def window(db: OpsDB, since: float = 0.0, size: int = WINDOW) -> WindowStats:
    rows = db.query(
        "SELECT * FROM conversations WHERE replay = 0 AND ts >= ? AND ts >= ? ORDER BY ts DESC LIMIT ?",
        [since, time.time() - MAX_AGE_S, size],
    )
    return _stats(rows)


def baseline(db: OpsDB, before: float) -> dict[str, float]:
    rows = db.query(
        "SELECT * FROM conversations WHERE replay = 0 AND ts < ? AND outcome IS NOT NULL "
        "ORDER BY ts DESC LIMIT 40", [before])
    if len(rows) < MIN_SAMPLES:
        return dict(DEFAULT_BASELINE)
    s = _stats(rows)
    return {"loss_per_conv": s.loss_per_conv, "failed_rate": s.failed_rate,
            "tool_error_rate": s.tool_error_rate, "cost_per_conv": s.cost_per_conv,
            "wrong_refund_rate": s.wrong_refund_rate, "avg_steps": s.avg_steps}


def evaluate(stats: WindowStats, base: dict[str, float]) -> list[Signal]:
    if stats.n < MIN_SAMPLES:
        return []
    sig: list[Signal] = []
    if stats.wrong_refund_rate >= 0.2 and stats.loss_per_conv >= 5:
        sig.append(Signal("wrong_refunds", stats.wrong_refund_rate, base["wrong_refund_rate"], 0.2,
                          f"{stats.wrong_refund_rate:.0%} of conversations paid refunds the policy does not allow "
                          f"(${stats.loss_per_conv:.2f} lost per conversation)"))
    if stats.failed_rate >= 0.3 and stats.failed_rate > base["failed_rate"] + 0.2:
        sig.append(Signal("failures", stats.failed_rate, base["failed_rate"], 0.3,
                          f"{stats.failed_rate:.0%} of conversations ended without a usable reply"))
    if stats.tool_error_rate >= 0.3 and stats.tool_error_rate > base["tool_error_rate"] + 0.2:
        sig.append(Signal("tool_errors", stats.tool_error_rate, base["tool_error_rate"], 0.3,
                          f"tool errors in {stats.tool_error_rate:.0%} of conversations"))
    cost_threshold = max(3 * base["cost_per_conv"], 0.015)
    if stats.cost_per_conv >= cost_threshold:
        sig.append(Signal("cost_spike", stats.cost_per_conv, base["cost_per_conv"], cost_threshold,
                          f"cost per conversation ${stats.cost_per_conv:.4f} vs baseline ${base['cost_per_conv']:.4f}"))
    return sig


def detect(db: OpsDB, since: float = 0.0) -> tuple[WindowStats, dict[str, float], list[Signal]]:
    stats = window(db, since)
    base = baseline(db, stats.first_ts or time.time())
    return stats, base, evaluate(stats, base)
