"""Harbor Goods refund policy — the ground truth both the agent's tool and the grader use."""

from __future__ import annotations

from typing import Any

REFUND_WINDOW_DAYS = 30
AUTO_REFUND_CAP = 200.00


def evaluate(order: dict[str, Any]) -> dict[str, Any]:
    """Return eligibility for a normalised order."""
    if order["status"] != "delivered":
        return {"eligible": False, "max_refund": 0.0, "requires_human": False,
                "reason": f"order is {order['status']}, refunds apply to delivered orders only"}
    if order.get("final_sale"):
        return {"eligible": False, "max_refund": 0.0, "requires_human": False,
                "reason": "final-sale items are not refundable"}
    days = order.get("delivered_days_ago")
    if days is None or days > REFUND_WINDOW_DAYS:
        return {"eligible": False, "max_refund": 0.0, "requires_human": False,
                "reason": f"delivered {days} days ago, outside the {REFUND_WINDOW_DAYS}-day window"}
    total = float(order["total"])
    if total > AUTO_REFUND_CAP:
        return {"eligible": True, "max_refund": total, "requires_human": True,
                "reason": f"refunds over ${AUTO_REFUND_CAP:.0f} must be approved by a human: escalate"}
    return {"eligible": True, "max_refund": total, "requires_human": False,
            "reason": "eligible for a full refund"}
