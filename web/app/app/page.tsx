"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Bot, ShieldCheck, Siren, Wallet } from "lucide-react";
import { AgentStatus, Empty, IncidentTable, Kpi, PageHead, Section, TableSkeleton, ViewAll } from "@/components/app/bits";
import { MiniSpark, RunsChart } from "@/components/app/charts";
import { useSeries } from "@/components/app/useSeries";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const series = useSeries(agents.map((a) => a.id));
  const prevented = agents.reduce((s, a) => s + (a.loss_prevented || 0), 0);
  const handled = agents.reduce((s, a) => s + (a.incidents_handled || 0), 0);
  const runs = agents.reduce((s, a) => s + (a.runs_24h || 0), 0);
  const loss24 = agents.reduce((s, a) => s + (a.loss_24h || 0), 0);
  const open = data?.open_incidents ?? [];
  const runsH = series?.reduce((s, b) => s + b.n, 0) ?? 0;
  const badH = series?.reduce((s, b) => s + b.failed, 0) ?? 0;
  const hasSeries = (series?.length ?? 0) > 1 && runsH > 0;

  return (
    <>
      <PageHead title="Overview" sub="Every agent Nightly is on call for, and what it handled while you weren't looking." />
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-alert/25 bg-alert/10 px-3 py-2 text-sm text-alert">
          <AlertTriangle className="size-4" /> Couldn’t reach the Nightly API: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-3 p-5">
              <Skeleton className="h-4 w-24 bg-secondary" />
              <Skeleton className="h-8 w-16 bg-secondary" />
            </Card>
          ))
        ) : (
          <>
            <Kpi label="Agents on call" value={agents.length} icon={Bot} hint={`${agents.filter((a) => a.status === "live").length} live`} />
            <Kpi label="Runs watched · 24h" value={runs.toLocaleString()} icon={Activity} hint={hasSeries ? `${runsH} in the last hour` : "Runs reported by the SDK"}>
              {hasSeries && <MiniSpark values={series!.map((b) => b.n)} />}
            </Kpi>
            <Kpi
              label="Incidents handled"
              value={handled}
              icon={ShieldCheck}
              tone={handled ? "ok" : undefined}
              hint={open.length ? <span className="text-alert">{open.length} open now</span> : "Nothing open"}
            />
            <Kpi label="Loss prevented" value={fmtUsd(prevented, 0)} icon={Wallet} tone="ok" hint={`${fmtUsd(loss24, 0)} lost to bad runs · 24h`} />
          </>
        )}
      </div>

      {open.length > 0 && (
        <Section
          className="mt-6 border-alert/30"
          icon={Siren}
          title={<span className="text-alert">Open now</span>}
          description="Nightly is working these. Anything that needs you has an Approve button."
          flush
        >
          <IncidentTable rows={open} />
        </Section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Section
          title="Runs · last hour"
          description={hasSeries ? `${runsH.toLocaleString()} runs, ${badH} bad (${Math.round((badH / Math.max(runsH, 1)) * 100)}%)` : "Good and bad runs across every agent, per 2 minutes"}
          icon={Activity}
        >
          {series === null && data === null ? (
            <Skeleton className="h-[240px] w-full bg-secondary" />
          ) : hasSeries ? (
            <RunsChart data={series!} />
          ) : (
            <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">No runs in the last hour.</div>
          )}
        </Section>

        <Section title="Agents" icon={Bot} action={<ViewAll href="/app/agents" />} flush>
          {!data ? (
            <TableSkeleton rows={3} />
          ) : agents.length === 0 ? (
            <Empty
              icon={Bot}
              title="No agents yet"
              action={{ href: "/app/agents/new", label: "Connect your first agent" }}
              className="m-4 border-0"
            >
              About five minutes: one SDK import and your neatlogs key.
            </Empty>
          ) : (
            <ul className="divide-y">
              {agents.map((a) => (
                <li key={a.id}>
                  <Link href={`/app/agents/${a.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/60">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
                      <Bot className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.release ?? "no release"} · {a.runs_24h.toLocaleString()} runs · {fmtUsd(a.loss_prevented, 0)} prevented
                      </div>
                      {a.open_incident && (
                        <div className="mt-0.5 truncate text-xs text-alert">● {a.open_incident.title ?? "incident open"}</div>
                      )}
                    </div>
                    <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section className="mt-6" title="Recent incidents" icon={Siren} action={<ViewAll href="/app/incidents" />} flush>
        {!incidents ? (
          <TableSkeleton />
        ) : incidents.length === 0 ? (
          <Empty icon={ShieldCheck} title="All quiet" className="m-4 border-0">
            When an agent misbehaves, the investigation, the fix and the postmortem land here.
          </Empty>
        ) : (
          <IncidentTable rows={incidents.slice(0, 8)} />
        )}
      </Section>
    </>
  );
}
