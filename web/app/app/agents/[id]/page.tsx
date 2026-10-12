"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Coins,
  GitBranch,
  KeyRound,
  ListTree,
  Percent,
  Rocket,
  ScrollText,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Siren,
  Wrench,
} from "lucide-react";
import {
  AgentStatus,
  Empty,
  Field,
  IncidentTable,
  Kpi,
  Notice,
  PageHead,
  Section,
  TableSkeleton,
  Tone,
  textareaCls,
} from "@/components/app/bits";
import { type Bucket, RunsChart, fillBuckets } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Agent, type InboxIncident, type Trace, ago, api, fmtUsd, useApi, useStream } from "@/lib/app";

type State = {
  agent: Agent;
  control: Record<string, string>;
  window: Record<string, number>;
  baseline: Record<string, number>;
  signals: { name: string; detail?: string; description?: string; value?: number; baseline?: number }[];
  open_incident: InboxIncident | null;
  totals: { n: number; loss: number; cost: number };
};
type Deploy = { id: number; ts: number; release: string; previous_release: string | null; actor: string; commit_sha: string | null };
type Metrics = { series: Bucket[] };
type Policy = { version: number; yaml: string; history: { version: number; created_at: number; created_by: string | null }[] };

const TABS = [
  { v: "overview", label: "Overview", icon: Activity },
  { v: "deploys", label: "Deploys", icon: Rocket },
  { v: "traces", label: "Traces", icon: ListTree },
  { v: "policy", label: "Policy", icon: ScrollText },
  { v: "settings", label: "Settings", icon: Settings2 },
] as const;

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<string>("overview");
  const { data: s, error, reload } = useApi<State>(`/agents/${id}/state`, 8000);
  useStream((e) => e.agent_id === id && reload());
  if (error && !s)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-alert/25 bg-alert/10 px-3 py-2 text-sm text-alert">
        <AlertTriangle className="size-4" /> Couldn’t load this agent: {error}
      </div>
    );
  if (!s)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-secondary" />
        <Skeleton className="h-9 w-96 bg-secondary" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-secondary" />
          ))}
        </div>
        <Skeleton className="h-72 bg-secondary" />
      </div>
    );
  const a = s.agent;
  return (
    <>
      <PageHead
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg border bg-background text-muted-foreground">
              <Bot className="size-4.5" />
            </span>
            {a.name} <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
          </span>
        }
        sub={
          <>
            {a.description || a.id}
            {s.control.active_release && (
              <>
                {" "}
                · release <span className="font-mono text-foreground">{s.control.active_release}</span>
              </>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="mb-2">
            {TABS.map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="gap-1.5 px-3">
                <t.icon className="size-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab id={id} s={s} onChange={reload} />
        </TabsContent>
        <TabsContent value="deploys" className="mt-4">
          <DeploysTab id={id} s={s} onChange={reload} />
        </TabsContent>
        <TabsContent value="traces" className="mt-4">
          <TracesTab id={id} />
        </TabsContent>
        <TabsContent value="policy" className="mt-4">
          <PolicyTab id={id} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab agent={a} onChange={reload} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function useSetControl(id: string, onChange: () => void) {
  return async (key: string, value: string | null) => {
    await api(`/agents/${id}/control`, { method: "PUT", json: { key, value } }).catch((e) => alert(e.message));
    onChange();
  };
}

function OverviewTab({ id, s, onChange }: { id: string; s: State; onChange: () => void }) {
  const { data: metrics } = useApi<Metrics>(`/agents/${id}/metrics?minutes=60&bucket_s=120`, 30000);
  const { data: incidents } = useApi<InboxIncident[]>(`/incidents`, 15000);
  const mine = (incidents ?? []).filter((i) => i.agent_id === id);
  const w = s.window;
  const flags = Object.entries(s.control).filter(([k]) => k.startsWith("flag:"));
  const setControl = useSetControl(id, onChange);
  const series = metrics ? fillBuckets(metrics.series, 60, 120) : null;
  const runs = metrics?.series.reduce((x, b) => x + b.n, 0) ?? 0;
  const bad = metrics?.series.reduce((x, b) => x + b.failed, 0) ?? 0;
  const loss = metrics?.series.reduce((x, b) => x + b.loss, 0) ?? 0;
  const badRate = Math.round(((w.failed_rate ?? 0) + (w.escalation_rate ?? 0)) * 100);
  const toolRate = Math.round((w.tool_error_rate ?? 0) * 100);
  return (
    <div className="space-y-6">
      {s.open_incident && (
        <Section className="border-alert/30" title={<span className="text-alert">Open incident</span>} icon={Siren} flush>
          <IncidentTable rows={[s.open_incident]} showAgent={false} />
        </Section>
      )}
      {s.agent.status !== "live" && (
        <Card className="flex-row items-center gap-4 border-amber/30 bg-amber/[0.06] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber/15 text-amber">
            <KeyRound className="size-4" />
          </span>
          <p className="text-sm text-foreground/80">
            This agent hasn&apos;t called Nightly yet. Set <code className="rounded bg-secondary px-1 font-mono text-xs">NIGHTLY_AGENT_TOKEN</code> and
            start it. See the{" "}
            <Link href="/docs" className="font-medium text-foreground underline underline-offset-2">
              SDK quickstart
            </Link>
            .
          </p>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Runs watched" value={s.totals.n.toLocaleString()} icon={Activity} hint={`${fmtUsd(s.totals.loss)} lost to bad runs`} />
        <Kpi label="Bad-run rate" value={`${badRate}%`} icon={Percent} tone={badRate >= 20 ? "alert" : badRate >= 10 ? "amber" : undefined} hint="last 10 runs" />
        <Kpi label="Tool-error rate" value={`${toolRate}%`} icon={Wrench} tone={toolRate >= 20 ? "alert" : toolRate >= 10 ? "amber" : undefined} hint="last 10 runs" />
        <Kpi
          label="LLM cost / run"
          value={fmtUsd(w.cost_per_conv || (s.totals.n ? s.totals.cost / s.totals.n : 0), 4)}
          icon={Coins}
          hint={w.cost_per_conv ? `${fmtUsd(s.totals.cost)} total` : `average of ${s.totals.n} runs · ${fmtUsd(s.totals.cost)} total`}
        />
      </div>
      {s.signals.length > 0 && (
        <Card className="gap-2 border-alert/30 bg-alert/[0.05] px-5 py-4">
          {s.signals.map((g) => (
            <div key={g.name} className="flex items-center gap-2 text-sm text-alert">
              <ShieldAlert className="size-4 shrink-0" /> <span className="flex-1">{g.detail ?? g.description ?? g.name}</span>
              {g.baseline != null && g.baseline <= 1 && <span className="font-mono text-xs text-alert/70">baseline {Math.round(g.baseline * 100)}%</span>}
            </div>
          ))}
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Section
          title="Runs · last hour"
          icon={Activity}
          description={`${runs.toLocaleString()} runs · ${bad} bad · ${fmtUsd(loss)} lost · per 2 min`}
        >
          {!series ? (
            <Skeleton className="h-[240px] w-full bg-secondary" />
          ) : runs > 0 ? (
            <RunsChart data={series} />
          ) : (
            <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">Not enough data yet.</div>
          )}
        </Section>
        <Section title="Live control plane" icon={SlidersHorizontal} description="What your agent reads through the SDK. Nightly changes these during incidents.">
          <dl className="divide-y text-sm">
            <Row k="Release" v={s.control.active_release} />
            <Row
              k="Model"
              v={s.control.force_model ? `${s.control.force_model}` : s.control.default_model}
              badge={s.control.force_model ? <Tone color="amber">failover</Tone> : undefined}
            />
            <Row k="Step cap" v={s.control.max_steps_cap} />
            {flags.map(([k, v]) => (
              <Row key={k} k={k.slice(5)} v={v} badge={<Tone color={v === "true" ? "ok" : v === "false" ? "alert" : "grey"}>flag</Tone>} />
            ))}
          </dl>
          {(s.control.force_model || s.control.max_steps_cap) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.control.force_model && (
                <Button variant="outline" size="sm" onClick={() => setControl("force_model", null)}>
                  Clear model failover
                </Button>
              )}
              {s.control.max_steps_cap && (
                <Button variant="outline" size="sm" onClick={() => setControl("max_steps_cap", null)}>
                  Remove step cap
                </Button>
              )}
            </div>
          )}
        </Section>
      </div>
      <Section title="Incidents" icon={Siren} flush>
        {!incidents ? (
          <TableSkeleton rows={2} />
        ) : mine.length === 0 ? (
          <Empty icon={Siren} title="No incidents yet" className="m-4 border-0">
            Nightly opens one when this agent&apos;s runs start going wrong.
          </Empty>
        ) : (
          <IncidentTable rows={mine.slice(0, 6)} showAgent={false} />
        )}
      </Section>
    </div>
  );
}

function Row({ k, v, badge }: { k: string; v?: string | null; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {badge}
        <span className="truncate font-mono text-[13px] text-foreground">{v ?? "—"}</span>
      </dd>
    </div>
  );
}

function DeploysTab({ id, s, onChange }: { id: string; s: State; onChange: () => void }) {
  const { data: deploys } = useApi<Deploy[]>(`/agents/${id}/deploys`, 30000);
  const setControl = useSetControl(id, onChange);
  if (deploys && deploys.length === 0)
    return (
      <Empty icon={Rocket} title="No deploys reported">
        Call <code className="font-mono">ns.report_deploy()</code> from CI and every release shows up here, ready to roll back to.
      </Empty>
    );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {!deploys ? (
        <TableSkeleton />
      ) : (
        <Table className="min-w-[620px]">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="pl-5">Release</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Deployed by</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="pr-5 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deploys.map((d) => {
              const current = d.release === s.control.active_release;
              return (
                <TableRow key={d.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-3.5 text-muted-foreground" />
                      <span className="font-mono font-medium">{d.release}</span>
                      {current && <Tone color="ok">active</Tone>}
                    </div>
                    {d.previous_release && <div className="mt-0.5 pl-5.5 font-mono text-[11px] text-muted-foreground">from {d.previous_release}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.commit_sha ? d.commit_sha.slice(0, 8) : "—"}</TableCell>
                  <TableCell>{d.actor === "nightshift" ? <Tone color="info">Nightly</Tone> : <span className="text-muted-foreground">{d.actor}</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{ago(d.ts)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    {!current && (
                      <Button variant="outline" size="sm" className="h-7" onClick={() => confirm(`Deploy ${d.release}?`) && setControl("active_release", d.release)}>
                        <Rocket className="size-3" /> Deploy
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

const OUTCOME: Record<string, "ok" | "alert" | "amber"> = { correct: "ok", ok: "ok", failed: "alert", escalated: "amber" };

function TracesTab({ id }: { id: string }) {
  const { data } = useApi<Trace[]>(`/agents/${id}/traces?limit=100`, 8000);
  if (data && data.length === 0)
    return (
      <Empty icon={ListTree} title="No runs yet">
        Runs show up here as your agent reports them through the SDK or neatlogs.
      </Empty>
    );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {!data ? (
        <TableSkeleton rows={8} />
      ) : (
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="pl-5">When</TableHead>
              <TableHead>Input</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Release</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="text-right">Tool err</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead className="pr-5">Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="pl-5 whitespace-nowrap text-muted-foreground">{ago(t.ts)}</TableCell>
                <TableCell className="max-w-[320px] truncate" title={t.reply ?? ""}>
                  {t.message}
                </TableCell>
                <TableCell>
                  <Tone color={OUTCOME[t.outcome] ?? "grey"}>{t.outcome}</Tone>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.release}</TableCell>
                <TableCell className="text-right tabular-nums">{t.steps}</TableCell>
                <TableCell className={`text-right tabular-nums ${t.tool_errors ? "font-medium text-alert" : "text-muted-foreground"}`}>{t.tool_errors}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{t.latency_ms ? `${(t.latency_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                <TableCell className="pr-5 font-mono text-[11px] text-muted-foreground">{t.trace_id ? t.trace_id.slice(0, 10) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function PolicyTab({ id }: { id: string }) {
  const { data, reload } = useApi<Policy>(`/agents/${id}/policy`);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (data) setText(data.yaml);
  }, [data]);
  if (!data) return <Skeleton className="h-[520px] bg-secondary" />;
  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Section
        title={`On-call policy · v${data.version}`}
        icon={ScrollText}
        description="YAML. Saved versions apply from Nightly's next tick."
        action={
          <Button
            size="sm"
            disabled={text === data.yaml}
            onClick={async () => {
              try {
                const r = await api<{ version: number }>(`/agents/${id}/policy`, { method: "PUT", json: { yaml: text } });
                setMsg({ ok: true, text: `Saved as v${r.version}. Nightly uses it from the next tick.` });
                reload();
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              }
            }}
          >
            Save
          </Button>
        }
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className={`${textareaCls} h-[460px] resize-y`} />
        {msg && (
          <div className="mt-3">
            <Notice ok={msg.ok}>{msg.text}</Notice>
          </div>
        )}
      </Section>
      <div className="space-y-6">
        <Section title="How it works" icon={ShieldAlert}>
          <ul className="list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              Actions under <code className="font-mono text-foreground">auto</code> run without waking anyone, only when confidence and projected loss
              clear the gates. Each must be reversible in one step; the API rejects a policy that isn&apos;t.
            </li>
            <li>
              Everything in <code className="font-mono text-foreground">needs_approval</code> (code fixes, refunds, deleting data, contacting
              customers) waits for a human, in Slack or here.
            </li>
            <li>Every auto action is verified by replaying the failing runs. If verification fails, it&apos;s undone.</li>
          </ul>
        </Section>
        <Section title="Versions" icon={GitBranch} flush>
          <ul className="divide-y text-sm">
            {data.history.map((h) => (
              <li key={h.version} className="flex items-center justify-between px-5 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-medium">v{h.version}</span>
                  {h.version === data.version && <Tone color="ok">current</Tone>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {h.created_by ?? "default"} · {ago(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function SettingsTab({ agent, onChange }: { agent: Agent; onChange: () => void }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [rootSpan, setRootSpan] = useState(agent.root_span_name ?? "");
  const [workflow, setWorkflow] = useState(agent.workflow_name ?? "");
  const [repo, setRepo] = useState(agent.repo ?? "");
  const [econ, setEcon] = useState(JSON.stringify(agent.economics, null, 2));
  const [key, setKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (json: Record<string, unknown>) => {
    try {
      await api(`/agents/${agent.id}`, { method: "PATCH", json });
      setMsg("Saved.");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="space-y-6">
      {msg && <Notice ok={msg === "Saved." || msg.endsWith("saved.")}>{msg}</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="General" icon={Settings2} description="How Nightly finds and describes this agent.">
          <div className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="neatlogs root span" hint="The span that wraps one run.">
                <Input value={rootSpan} onChange={(e) => setRootSpan(e.target.value)} className="font-mono" />
              </Field>
              <Field label="neatlogs workflow">
                <Input value={workflow} onChange={(e) => setWorkflow(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <Field label="GitHub repo" hint={agent.repo_dir ? "Cloned for provenance." : "owner/name"}>
              <Input value={repo} onChange={(e) => setRepo(e.target.value)} className="font-mono" />
            </Field>
            <Button
              onClick={() => save({ name, description, root_span_name: rootSpan, workflow_name: workflow, ...(repo !== (agent.repo ?? "") ? { repo } : {}) })}
            >
              Save changes
            </Button>
          </div>
        </Section>
        <div className="space-y-6">
          <Section title="Unit economics" icon={Coins} description="What a bad run costs, so Nightly can price an incident.">
            <textarea value={econ} onChange={(e) => setEcon(e.target.value)} spellCheck={false} className={`${textareaCls} h-48`} />
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                try {
                  save({ economics: JSON.parse(econ) });
                } catch {
                  setMsg("Economics must be valid JSON.");
                }
              }}
            >
              Save economics
            </Button>
          </Section>
          <Section title="Credentials" icon={KeyRound}>
            <div className="space-y-3">
              <Field
                label="neatlogs project key"
                hint={
                  agent.has_neatlogs_key
                    ? `Connected${agent.neatlogs_project_name ? ` to ${agent.neatlogs_project_name}` : ""}. Paste a new key to replace it.`
                    : "Not connected."
                }
              >
                <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!key}
                  onClick={() =>
                    api(`/agents/${agent.id}/neatlogs/verify`, { method: "POST", json: { neatlogs_key: key } })
                      .then(() => {
                        setMsg("neatlogs key verified and saved.");
                        setKey("");
                        onChange();
                      })
                      .catch((e) => setMsg(e.message))
                  }
                >
                  Verify and save key
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    confirm("Rotate the agent token? The old one stops working immediately.") &&
                    api<{ token: string }>(`/agents/${agent.id}/token`, { method: "POST" }).then((r) => setToken(r.token))
                  }
                >
                  Rotate agent token <span className="font-mono text-xs text-muted-foreground">({agent.token_prefix}…)</span>
                </Button>
              </div>
              {token && <code className="block rounded-md border bg-[var(--code-bg)] p-2 font-mono text-xs break-all">{token}</code>}
            </div>
          </Section>
        </div>
      </div>
      <Card className="flex-row flex-wrap items-center justify-between gap-4 border-alert/25 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-foreground">Danger zone</div>
          <p className="text-sm text-muted-foreground">Pause on-call, or delete this agent and its incident history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save({ status: agent.status === "paused" ? "live" : "paused" })}>
            {agent.status === "paused" ? "Resume on-call" : "Pause on-call"}
          </Button>
          <Button
            variant="outline"
            className="border-alert/30 text-alert hover:bg-alert/10 hover:text-alert"
            onClick={() =>
              confirm(`Delete ${agent.name}? Its incident history is deleted too.`) &&
              api(`/agents/${agent.id}`, { method: "DELETE" }).then(() => (window.location.href = "/app/agents"))
            }
          >
            Delete agent
          </Button>
        </div>
      </Card>
    </div>
  );
}
