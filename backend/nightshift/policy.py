"""Autonomy policy: may Night Shift take this action on its own, or must a human approve it?"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from functools import lru_cache
from typing import Any

import yaml

from ops.settings import REPO_DIR

POLICY_PATH = REPO_DIR / "policy" / "oncall-policy.yaml"


@lru_cache(maxsize=1)
def load_policy() -> dict[str, Any]:
    return yaml.safe_load(POLICY_PATH.read_text())


@dataclass
class Decision:
    action: str
    params: dict[str, Any]
    mode: str  # auto | needs_approval | defer
    reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def decide(action: str, params: dict[str, Any], incident_type: str, confidence: float,
           projected_loss: float, auto_actions_taken: int = 0) -> Decision:
    pol = load_policy()
    gates = pol["gates"]
    reasons: list[str] = []
    auto = pol.get("auto", {})

    if action not in auto:
        return Decision(action, params, "needs_approval", [f"'{action}' is not in the pre-approved auto list"])
    rule = auto[action]
    if not rule.get("reversible", False):
        return Decision(action, params, "needs_approval", [f"'{action}' is not reversible"])
    reasons.append(f"'{action}' is pre-approved and reversible in one step")

    if action == "failover_model" and params.get("model") not in rule.get("allowed_models", []):
        return Decision(action, params, "needs_approval", reasons + [f"model {params.get('model')} not allowed"])
    if action == "disable_flag" and params.get("flag") not in rule.get("allowed_flags", []):
        return Decision(action, params, "needs_approval", reasons + [f"flag {params.get('flag')} not allowed"])
    if action == "cap_steps" and int(params.get("steps", 0)) < rule.get("min_steps", 1):
        return Decision(action, params, "needs_approval", reasons + ["step cap below the allowed minimum"])

    if confidence < gates["min_confidence"]:
        return Decision(action, params, "needs_approval",
                        reasons + [f"confidence {confidence:.2f} < {gates['min_confidence']}"])
    reasons.append(f"confidence {confidence:.2f} ≥ {gates['min_confidence']}")

    safety = incident_type in gates.get("safety_incident_types", [])
    if not safety and projected_loss < gates["min_projected_loss_usd"]:
        return Decision(action, params, "defer",
                        reasons + [f"projected loss ${projected_loss:,.0f} below ${gates['min_projected_loss_usd']} — defer to the morning"])
    reasons.append("safety incident: always contain" if safety else
                   f"projected loss while waiting for a human ${projected_loss:,.0f} ≥ ${gates['min_projected_loss_usd']}")

    if auto_actions_taken >= gates["max_auto_actions_per_incident"]:
        return Decision(action, params, "needs_approval", reasons + ["auto-action budget for this incident used"])
    return Decision(action, params, "auto", reasons)
