"""Nightly business model (draft mirrored into cfo.ai).

Computes a 24-month plan — pricing, unit costs, revenue, costs, cash and runway — from the
assumptions below and the investigation costs measured in the latest live benchmark.
Writes business/PLAN.md and web/public/business.json.

    python business/model.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ASSUMPTIONS = {
    "starting_cash": 150_000,            # pre-seed / angel round assumed at month 1
    "founders": 2,
    "founder_monthly_cost": 4_500,       # fully loaded, India-based founding team
    "hire_month": 9,                     # first engineer
    "engineer_monthly_cost": 5_500,
    "base_infra_monthly": 400,           # hosting, CI, monitoring
    "infra_per_customer_monthly": 18,    # per-tenant workers + storage
    "marketing_monthly_from_m4": 1_500,
    "price_team": 399,                   # per month
    "price_scale": 1_990,
    "scale_share_of_paid": 0.15,
    "investigations_per_customer_month": 60,
    "replays_per_investigation": 6,
    "replay_cost": 0.006,                # one replayed conversation on Claude Haiku (measured)
    "new_paid_customers_by_month": [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    "monthly_logo_churn": 0.03,
    "payment_fees": 0.035,               # Dodo / card processing
}


def measured_investigation_cost() -> tuple[float, str]:
    root = ROOT / "evidence" / "benchmark"
    runs = sorted([p for p in root.glob("*-live") if (p / "results.json").exists()], reverse=True)
    if not runs:
        return 0.10, "assumed"
    results = json.loads((runs[0] / "results.json").read_text())
    costs = [r["nightshift_cost_usd"] for r in results if r.get("nightshift_cost_usd")]
    return (sum(costs) / len(costs) if costs else 0.10), f"mean of {len(costs)} live investigations in {runs[0].name}"


def build() -> dict:
    a = ASSUMPTIONS
    inv_cost, inv_src = measured_investigation_cost()
    per_customer_llm = a["investigations_per_customer_month"] * (inv_cost + a["replays_per_investigation"] * a["replay_cost"])
    arpa = (1 - a["scale_share_of_paid"]) * a["price_team"] + a["scale_share_of_paid"] * a["price_scale"]
    cogs_per_customer = per_customer_llm + a["infra_per_customer_monthly"] + arpa * a["payment_fees"]
    gross_margin = 1 - cogs_per_customer / arpa

    cash = a["starting_cash"]
    customers = 0.0
    rows = []
    runway = None
    for m in range(24):
        customers = customers * (1 - a["monthly_logo_churn"]) + a["new_paid_customers_by_month"][m]
        mrr = customers * arpa
        people = a["founders"] * a["founder_monthly_cost"] + (a["engineer_monthly_cost"] if m + 1 >= a["hire_month"] else 0)
        costs = (people + a["base_infra_monthly"] + customers * cogs_per_customer
                 + (a["marketing_monthly_from_m4"] if m + 1 >= 4 else 0))
        cash += mrr - costs
        rows.append({"month": f"M{m + 1:02d}", "customers": round(customers), "mrr": round(mrr),
                     "costs": round(costs), "net": round(mrr - costs), "cash": round(cash)})
        if cash < 0 and runway is None:
            runway = m + 1
    breakeven = next((r["month"] for r in rows if r["net"] >= 0), None)

    return {
        "status": "Draft computed locally from measured costs; cfo.ai model pending (see business/ARI_PROMPT.md)",
        "cfo_share_url": None,
        "pricing": [
            {"tier": "Hobby", "price": "$0", "includes": ["1 agent", "detection, investigations and postmortems", "paging only — no autonomous actions"]},
            {"tier": "Team", "price": f"${a['price_team']}/mo", "includes": ["up to 5 agents", "autonomous containment under your policy", f"{a['investigations_per_customer_month']} investigations / month included"]},
            {"tier": "Scale", "price": f"${a['price_scale']:,}/mo", "includes": ["up to 25 agents", "custom policies, SSO, audit export", "priority support"]},
        ],
        "unit_costs": [
            {"item": "LLM cost per investigation (Claude Sonnet)", "value": f"${inv_cost:.3f}", "source": inv_src},
            {"item": "replay verification per investigation", "value": f"${a['replays_per_investigation'] * a['replay_cost']:.3f}", "source": "6 replays × Haiku conversation cost (measured ~$0.006)"},
            {"item": "LLM cost per customer per month", "value": f"${per_customer_llm:.2f}", "source": f"{a['investigations_per_customer_month']} investigations/month"},
            {"item": "blended revenue per customer (ARPA)", "value": f"${arpa:,.0f}/mo", "source": f"{int(a['scale_share_of_paid'] * 100)}% on Scale"},
            {"item": "COGS per customer", "value": f"${cogs_per_customer:,.0f}/mo", "source": "LLM + infra + payment fees"},
            {"item": "gross margin", "value": f"{gross_margin:.0%}", "source": "ARPA vs COGS"},
        ],
        "forecast": rows,
        "assumptions": [f"{k.replace('_', ' ')}: {v}" for k, v in a.items() if k != "new_paid_customers_by_month"]
                       + ["new paid customers per month ramps from 0 to 22 over 24 months"],
        "runway_months": runway if runway else ">24",
        "breakeven_month": breakeven,
        "gross_margin": round(gross_margin, 3),
        "arpa": round(arpa, 2),
    }


def write(plan: dict) -> None:
    (ROOT / "web" / "public").mkdir(parents=True, exist_ok=True)
    (ROOT / "web" / "public" / "business.json").write_text(json.dumps(plan, indent=2))
    lines = ["# Nightly — business plan (draft)", "", f"_Status: {plan['status']}_", "",
             "## Pricing", "", "| Tier | Price | Includes |", "|---|---|---|"]
    for p in plan["pricing"]:
        lines.append(f"| {p['tier']} | {p['price']} | {'; '.join(p['includes'])} |")
    lines += ["", "## Unit costs (measured)", "", "| Item | Value | Source |", "|---|---|---|"]
    for u in plan["unit_costs"]:
        lines.append(f"| {u['item']} | {u['value']} | {u['source']} |")
    lines += ["", f"## 24-month forecast — break-even {plan['breakeven_month']}, runway {plan['runway_months']} months", "",
              "| Month | Customers | MRR | Costs | Net | Cash |", "|---|---|---|---|---|---|"]
    for r in plan["forecast"]:
        lines.append(f"| {r['month']} | {r['customers']} | ${r['mrr']:,} | ${r['costs']:,} | ${r['net']:,} | ${r['cash']:,} |")
    lines += ["", "## Assumptions", ""] + [f"- {x}" for x in plan["assumptions"]]
    (ROOT / "business" / "PLAN.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    p = build()
    write(p)
    print(json.dumps({k: p[k] for k in ("runway_months", "breakeven_month", "gross_margin", "arpa")}))
