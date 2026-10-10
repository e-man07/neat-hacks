"use client";

import Link from "next/link";
import PageShell from "@/components/PageShell";
import { Card, Pill } from "@/components/ui";
import { money, usePoll, type IncidentRow } from "@/lib/api";

const COLOR: Record<string, string> = {
  RESOLVED: "var(--ok)",
  MONITORING: "var(--amber)",
  MITIGATING: "var(--amber)",
  DEFERRED: "var(--amber)",
};

export default function IncidentsPage() {
  const [rows, err] = usePoll<IncidentRow[]>("/api/incidents", 4000);
  return (
    <PageShell title="Incidents" sub="Every one with a postmortem, a price and a paper trail.">
      {err && <p className="text-[13px] text-alert">API unreachable — start the backend to see live incidents.</p>}
      {rows && rows.length === 0 && <p className="text-white/50">No incidents yet. Ship a bad release from the console.</p>}
      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <Link key={r.id} href={`/incidents/${r.id}`}>
            <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:border-line-strong">
              <Pill color={COLOR[r.status] ?? "var(--alert)"}>{r.status.replace("_", " ")}</Pill>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] text-white">{r.title}</div>
                <div className="font-mono text-[11px] text-white/40">
                  {r.id} · {r.type} · {r.severity} · {new Date(r.opened_at * 1000).toLocaleString()}
                </div>
              </div>
              {r.impact && (
                <div className="text-right font-mono text-[12px] text-white/60">
                  {money(r.impact.loss_per_minute, 2)}/min
                  <div className="text-white/35">{money(r.impact.projected_loss_if_waiting)} at risk</div>
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
