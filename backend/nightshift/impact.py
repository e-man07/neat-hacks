"""Price an incident: what it costs per minute and what waiting for a human would cost."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from nightshift.detector import WindowStats
from ops import clock
from ops.economics import load_economics


@dataclass
class Impact:
    loss_per_conversation: float
    baseline_loss_per_conversation: float
    excess_loss_per_conversation: float
    extra_llm_cost_per_conversation: float
    conversations_per_minute: float
    loss_per_minute: float
    human_response_minutes: float
    projected_loss_if_waiting: float
    observed_loss: float
    local_time: str
    local_time_simulated: bool
    economics_source: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def assess(stats: WindowStats, base: dict[str, float]) -> Impact:
    econ = load_economics()
    now = clock.local_now()
    excess = max(stats.loss_per_conv - base.get("loss_per_conv", 0.0), 0.0)
    extra_llm = max(stats.cost_per_conv - base.get("cost_per_conv", 0.0), 0.0)
    cpm = econ.conversations_per_minute(now)
    per_min = (excess + extra_llm) * cpm
    wait = econ.human_response_minutes(now)
    return Impact(
        loss_per_conversation=round(stats.loss_per_conv, 4),
        baseline_loss_per_conversation=round(base.get("loss_per_conv", 0.0), 4),
        excess_loss_per_conversation=round(excess, 4),
        extra_llm_cost_per_conversation=round(extra_llm, 5),
        conversations_per_minute=round(cpm, 2),
        loss_per_minute=round(per_min, 2),
        human_response_minutes=wait,
        projected_loss_if_waiting=round(per_min * wait, 2),
        observed_loss=round(stats.total_loss, 2),
        local_time=now.strftime("%H:%M"),
        local_time_simulated=clock.is_simulated(),
        economics_source=econ.source,
    )
