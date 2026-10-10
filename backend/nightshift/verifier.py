"""Verification: prove the containment worked before calling the incident mitigated.

1. Replay: re-run the exact failing conversations (same customer messages) against the new
   effective config with side effects disabled, and grade them.
2. Live watch: after the action, new production conversations must look like the baseline.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from typing import Any

from harbor.agent import run_conversation
from harbor.scenarios import BY_ID
from nightshift.detector import WindowStats, _stats
from ops.db import OpsDB

PASSING = ("correct", "escalated")
LOOP_STEPS = 8  # a conversation this long is a symptom even when it ends well


@dataclass
class ReplayResult:
    n: int
    passed: int
    rate: float
    items: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def replay(db: OpsDB, conversation_ids: list[str], brain: str | None = None, limit: int = 8) -> ReplayResult:
    if not conversation_ids:
        return ReplayResult(0, 0, 1.0)
    marks = ",".join("?" for _ in conversation_ids)
    rows = db.query(
        f"SELECT id, scenario_id, outcome, trace_id FROM conversations WHERE id IN ({marks}) "
        f"AND (outcome != 'correct' OR tool_errors > 0 OR steps >= {LOOP_STEPS}) ORDER BY ts DESC LIMIT ?",
        [*conversation_ids, limit])
    jobs = [(r, BY_ID[r["scenario_id"]]) for r in rows if r["scenario_id"] in BY_ID]

    def one(job: tuple[dict[str, Any], Any]) -> dict[str, Any]:
        row, scenario = job
        res = run_conversation(scenario, db=db, brain=brain, dry_run=True, persist=True, tag="replay")
        return {"original_conversation": row["id"], "original_trace": row["trace_id"],
                "original_outcome": row["outcome"], "replay_outcome": res.grade.outcome,
                "replay_trace": res.trace_id, "scenario": scenario.id, "release": res.release,
                "model": res.model, "steps": res.steps,
                "passed": res.grade.outcome in PASSING and res.steps < LOOP_STEPS}

    with ThreadPoolExecutor(max_workers=4) as pool:
        items = list(pool.map(one, jobs))
    passed = sum(1 for i in items if i["passed"])
    return ReplayResult(len(items), passed, round(passed / len(items), 3) if items else 1.0, items)


def live_window(db: OpsDB, after_ts: float, size: int = 10) -> WindowStats:
    rows = db.query("SELECT * FROM conversations WHERE replay = 0 AND ts >= ? ORDER BY ts DESC LIMIT ?",
                    [after_ts, size])
    return _stats(rows)


def recovered(stats: WindowStats, base: dict[str, float]) -> tuple[bool, list[str]]:
    reasons = []
    ok = True
    if stats.loss_per_conv > max(base.get("loss_per_conv", 0) * 2, 0) + 2.0:
        ok = False
        reasons.append(f"loss/conv ${stats.loss_per_conv:.2f} still above baseline")
    if stats.failed_rate > max(base.get("failed_rate", 0) + 0.15, 0.2):
        ok = False
        reasons.append(f"failure rate {stats.failed_rate:.0%} still high")
    if stats.cost_per_conv > max(base.get("cost_per_conv", 0.0055) * 2.5, 0.012):
        ok = False
        reasons.append(f"cost/conv ${stats.cost_per_conv:.4f} still high")
    if ok:
        reasons.append("metrics back within baseline")
    return ok, reasons
