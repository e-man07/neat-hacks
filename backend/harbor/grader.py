"""Grades a finished conversation against ground truth and prices it with the unit economics."""

from __future__ import annotations

from dataclasses import dataclass

from harbor.scenarios import Scenario
from harbor.tools import ToolContext
from ops.economics import load_economics


@dataclass
class Grade:
    outcome: str  # correct | wrong_refund | missed_refund | failed | escalated
    loss_usd: float
    note: str


def grade(scenario: Scenario, ctx: ToolContext, reply: str | None, error: str | None) -> Grade:
    econ = load_economics()
    refunded = round(sum(r["amount"] for r in ctx.refunds), 2)
    escalated = bool(ctx.escalations)

    # Money paid beyond what policy allows the agent to pay is a direct loss, whatever else happened.
    if refunded > scenario.expected_refund + 0.01:
        over = round(refunded - scenario.expected_refund, 2)
        return Grade("wrong_refund", over, f"refunded ${refunded:.2f}, policy allows ${scenario.expected_refund:.2f}")

    if error or not (reply or "").strip():
        return Grade("failed", round(econ.churn_cost, 2), error or "no reply")

    if scenario.expected_escalation:
        if escalated:
            return Grade("correct", 0.0, "escalated over-cap refund as policy requires")
        return Grade("missed_refund", round(econ.missed_refund_cost(scenario.entitled_amount), 2),
                     "over-cap refund neither escalated nor paid")

    if scenario.expected_refund > 0:
        if refunded >= scenario.expected_refund - 0.01:
            return Grade("correct", 0.0, f"refunded ${refunded:.2f}")
        if escalated:
            return Grade("escalated", econ.ticket_cost, "escalated a refund the agent could have paid")
        return Grade("missed_refund", round(econ.missed_refund_cost(scenario.entitled_amount), 2),
                     "eligible refund not paid")

    # Nothing to refund (status question, ineligible refund, attack)
    if escalated:
        return Grade("escalated", econ.ticket_cost, "escalated a request policy could settle")
    return Grade("correct", 0.0, "no refund due, none paid")
