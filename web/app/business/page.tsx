"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { Card, Label } from "@/components/ui";
import { API, money } from "@/lib/api";

type Plan = {
  status: string;
  cfo_share_url: string | null;
  cfo_support_url?: string | null;
  scenarios?: { name: string; breakeven: string; lowest_cash: string; cash_m24: string }[];
  pricing: { tier: string; price: string; includes: string[] }[];
  unit_costs: { item: string; value: string; source: string }[];
  forecast: { month: string; customers: number; mrr: number; costs: number; cash: number }[];
  assumptions: string[];
  runway_months: number | null;
};

type Econ = { unit_economics: Record<string, unknown>; churn_cost: number; policy: Record<string, unknown> };

export default function BusinessPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [econ, setEcon] = useState<Econ | null>(null);
  useEffect(() => {
    fetch("/business.json").then((r) => (r.ok ? r.json() : null)).then(setPlan).catch(() => {});
    fetch(`${API}/api/economics`).then((r) => (r.ok ? r.json() : null)).then(setEcon).catch(() => {});
  }, []);
  const ue = econ?.unit_economics as Record<string, unknown> | undefined;

  return (
    <PageShell title="The business" sub="What an incident costs, and what Nightly costs.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <Label>pricing an incident (Harbor Goods model)</Label>
          <p className="mt-3 text-[14px] leading-relaxed text-white/65">
            Nightly decides whether to act alone by comparing the loss rate at production volume with how long a human
            would take to respond. These inputs live in the cfo.ai model and are mirrored into{" "}
            <code className="font-mono text-[12px] text-white">business/unit_economics.yaml</code>.
          </p>
          {ue ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-white/45">conversations / hour (night)</dt>
              <dd className="text-white">{String((ue.conversations_per_hour as Record<string, number>)?.night)}</dd>
              <dt className="text-white/45">conversations / hour (day)</dt>
              <dd className="text-white">{String((ue.conversations_per_hour as Record<string, number>)?.day)}</dd>
              <dt className="text-white/45">customer lifetime value</dt>
              <dd className="text-white">{money(ue.customer_lifetime_value as number)}</dd>
              <dt className="text-white/45">churn after a failed conversation</dt>
              <dd className="text-white">{Math.round((ue.churn_probability_after_failed_support as number) * 100)}% → {money(econ?.churn_cost, 2)}</dd>
              <dt className="text-white/45">human ticket</dt>
              <dd className="text-white">{money(ue.human_ticket_cost as number, 2)}</dd>
              <dt className="text-white/45">response time at night</dt>
              <dd className="text-white">{String(((ue.oncall as Record<string, Record<string, number>>)?.response_minutes)?.night)} min</dd>
            </dl>
          ) : (
            <p className="mt-4 text-[12.5px] text-white/40">Start the API to load the live unit economics.</p>
          )}
          <p className="mt-4 font-mono text-[11px] text-white/35">{String(ue?.source ?? "")}</p>
        </Card>

        <Card className="p-6">
          <Label>nightly pricing</Label>
          <div className="mt-4 space-y-3">
            {(plan?.pricing ?? []).map((p) => (
              <div key={p.tier} className="rounded-lg border border-line p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] text-white">{p.tier}</span>
                  <span className="font-mono text-[13px] text-white/80">{p.price}</span>
                </div>
                <ul className="mt-1 text-[12.5px] text-white/55">
                  {p.includes.map((i) => (
                    <li key={i}>· {i}</li>
                  ))}
                </ul>
              </div>
            ))}
            {!plan && <p className="text-[12.5px] text-white/40">Plan loading…</p>}
          </div>
        </Card>
      </div>

      {plan && (
        <>
          <Card className="mt-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>unit costs (measured)</Label>
              <span className="font-mono text-[11px] text-white/40">{plan.status}</span>
            </div>
            <table className="mt-3 w-full text-[13px]">
              <tbody>
                {plan.unit_costs.map((u) => (
                  <tr key={u.item} className="border-t border-line">
                    <td className="py-2 text-white/70">{u.item}</td>
                    <td className="py-2 font-mono text-white">{u.value}</td>
                    <td className="py-2 font-mono text-[11px] text-white/35">{u.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="mt-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>24-month forecast · runway {plan.runway_months ?? "—"} months</Label>
              {plan.cfo_share_url ? (
                <span className="flex gap-4">
                  <a href={plan.cfo_share_url} className="text-[12px] text-info underline underline-offset-2">
                    business plan in cfo.ai
                  </a>
                  {plan.cfo_support_url && (
                    <a href={plan.cfo_support_url} className="text-[12px] text-info underline underline-offset-2">
                      customer unit economics in cfo.ai
                    </a>
                  )}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-amber">cfo.ai share link pending</span>
              )}
            </div>
            {plan.scenarios && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {plan.scenarios.map((sc) => (
                  <div key={sc.name} className="rounded-lg border border-line p-3">
                    <div className="text-[12px] text-white/60">{sc.name}</div>
                    <div className="mt-1 font-mono text-[12px] text-white/85">
                      break-even {sc.breakeven} · low {sc.lowest_cash} · M24 {sc.cash_m24}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead className="font-mono text-[10.5px] uppercase text-white/40">
                  <tr>
                    <th className="py-1.5 text-left font-normal">month</th>
                    <th className="py-1.5 text-right font-normal">customers</th>
                    <th className="py-1.5 text-right font-normal">MRR</th>
                    <th className="py-1.5 text-right font-normal">costs</th>
                    <th className="py-1.5 text-right font-normal">cash</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.forecast.map((f) => (
                    <tr key={f.month} className="border-t border-line">
                      <td className="py-1.5 text-white/70">{f.month}</td>
                      <td className="py-1.5 text-right font-mono text-white/80">{f.customers}</td>
                      <td className="py-1.5 text-right font-mono text-white/80">{money(f.mrr)}</td>
                      <td className="py-1.5 text-right font-mono text-white/80">{money(f.costs)}</td>
                      <td className={`py-1.5 text-right font-mono ${f.cash < 0 ? "text-alert" : "text-white"}`}>{money(f.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-1 text-[12.5px] text-white/50">
              {plan.assumptions.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </PageShell>
  );
}
