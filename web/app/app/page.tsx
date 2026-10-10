"use client";

import Link from "next/link";
import { AgentStatus, Empty, IncidentRow, PageHead, Stat } from "@/components/app/bits";
import { Card, Label, PrimaryLink } from "@/components/ui";
import { type InboxIncident, type OverviewAgent, fmtUsd, useApi, useStream } from "@/lib/app";

type Overview = { agents: OverviewAgent[]; open_incidents: InboxIncident[] };

export default function OverviewPage() {
  const { data, error, reload } = useApi<Overview>("/overview", 15000);
  const { data: incidents, reload: reloadInc } = useApi<InboxIncident[]>("/incidents", 15000);
  useStream((e) => {
    if (["incident_update", "incident", "deploy", "action"].some((t) => e.type.startsWith(t))) {
      reload();
      reloadInc();
    }
  });
  const agents = data?.agents ?? [];
  const prevented = agents.reduce((s, a) => s + (a.loss_prevented || 0), 0);
  const handled = agents.reduce((s, a) => s + (a.incidents_handled || 0), 0);
  const runs = agents.reduce((s, a) => s + (a.runs_24h || 0), 0);
  const open = data?.open_incidents ?? [];
  return (
    <>
      <PageHead
        title="Overview"
        sub="Every agent Night Shift is on call for, and what it handled while you weren't looking."
        actions={<PrimaryLink href="/app/agents/new">Connect an agent</PrimaryLink>}
      />
      {error && <p className="mb-4 text-sm text-alert">Couldn’t reach the Night Shift API: {error}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="agents on call" value={agents.length} />
        <Stat label="runs watched · 24h" value={runs.toLocaleString()} />
        <Stat label="incidents handled" value={handled} tone="var(--ok)" />
        <Stat label="loss prevented" value={fmtUsd(prevented, 0)} tone="var(--ok)" />
      </div>

      {open.length > 0 && (
        <Card className="mt-6 overflow-hidden border-alert/40">
          <div className="border-b border-line px-4 py-2.5">
            <Label>open now</Label>
          </div>
          {open.map((i) => (
            <IncidentRow key={i.id} inc={i} />
          ))}
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium text-fg-2">Agents</h2>
      {data && agents.length === 0 ? (
        <Empty>
          No agents yet. <Link href="/app/agents/new" className="underline">Connect your first agent</Link>. It takes about
          five minutes: one SDK import and your neatlogs key.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => (
            <Link key={a.id} href={`/app/agents/${a.id}`} className="rounded-xl border border-line bg-card p-4 transition hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">{a.name}</div>
                  <div className="truncate text-xs text-muted">{a.description || a.id}</div>
                </div>
                <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] text-faint">
                <div>
                  release
                  <div className="mt-0.5 text-sm text-fg-2">{a.release ?? "—"}</div>
                </div>
                <div>
                  runs 24h
                  <div className="mt-0.5 text-sm text-fg-2">{a.runs_24h}</div>
                </div>
                <div>
                  prevented
                  <div className="mt-0.5 text-sm text-ok">{fmtUsd(a.loss_prevented, 0)}</div>
                </div>
              </div>
              {a.open_incident && <div className="mt-3 truncate text-xs text-alert">● {a.open_incident.title ?? "incident open"}</div>}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium text-fg-2">Recent incidents</h2>
      {incidents && incidents.length === 0 ? (
        <Empty>Nothing yet. When an agent misbehaves, the investigation, the fix and the postmortem land here.</Empty>
      ) : (
        <Card className="overflow-hidden">
          {(incidents ?? []).slice(0, 8).map((i) => (
            <IncidentRow key={`${i.agent_id}-${i.id}`} inc={i} />
          ))}
        </Card>
      )}
    </>
  );
}
