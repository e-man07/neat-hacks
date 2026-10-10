"""Unit economics (mirrored from the cfo.ai model) used to price conversations and incidents."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import yaml

from ops.settings import REPO_DIR

ECON_PATH = REPO_DIR / "business" / "unit_economics.yaml"


@dataclass(frozen=True)
class Economics:
    raw: dict[str, Any]

    @property
    def churn_cost(self) -> float:
        return self.raw["churn_probability_after_failed_support"] * self.raw["customer_lifetime_value"]

    @property
    def ticket_cost(self) -> float:
        return float(self.raw["human_ticket_cost"])

    def missed_refund_cost(self, amount: float) -> float:
        return self.churn_cost + self.raw["dispute_rate_on_missed_refund"] * (self.raw["chargeback_fee"] + amount)

    def conversations_per_minute(self, at: dt.datetime | None = None) -> float:
        hour = (at or dt.datetime.now()).hour
        per_hour = self.raw["conversations_per_hour"]["night" if hour < 8 else "day"]
        return per_hour / 60.0

    def human_response_minutes(self, at: dt.datetime | None = None) -> float:
        hour = (at or dt.datetime.now()).hour
        r = self.raw["oncall"]["response_minutes"]
        if 9 <= hour < 19:
            return float(r["business_hours"])
        if hour >= 19:
            return float(r["evening"])
        return float(r["night"])

    @property
    def source(self) -> str:
        return str(self.raw.get("source", "business/unit_economics.yaml"))


@lru_cache(maxsize=1)
def load_economics() -> Economics:
    return Economics(yaml.safe_load(ECON_PATH.read_text()))
