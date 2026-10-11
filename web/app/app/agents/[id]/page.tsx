"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AgentStatus, Empty, Field, IncidentRow, PageHead, Stat, inputCls } from "@/components/app/bits";
import { Button, Card, Label, Pill, Sparkline } from "@/components/ui";
import {
  type Agent,
  type InboxIncident,
  type Trace,
  ago,
  api,
  fmtUsd,
  useApi,
  useStream,
} from "@/lib/app";

type State = {
  agent: Agent;
  control: Record<string, string>;
  window: Record<string, number>;
  baseline: Record<string, number>;
  signals: { name: string; detail: string }[];
  open_incident: InboxIncident | null;
  totals: { n: number; loss: number; cost: number };
};
type Deploy = { id: number; ts: number; release: string; previous_release: string | null; actor: string; commit_sha: string | null };
type Metrics = { series: { t: number; n: number; failed: number; loss: number; cost: number }[] };
type Policy = { version: number; yaml: string; history: { version: number; created_at: number; created_by: string | null }[] };

const TABS = ["Overview", "Traces", "Policy", "Settings"] as const;

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const { data: s, error, reload } = useApi<State>(`/agents/${id}/state`, 8000);
  useStream((e) => e.agent_id === id && reload());
  if (error) return <p className="text-sm text-alert">Couldn’t load this agent: {error}</p>;
  if (!s) return <p className="text-sm text-muted">Loading…</p>;
  const a = s.agent;
  return (
    <>
      <PageHead
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.name} <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
          </span>
        }
        sub={a.description || a.id}
      />
      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${t === tab ? "border-white text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && <OverviewTab id={id} s={s} onChange={reload} />}
      {tab === "Traces" && <TracesTab id={id} />}
      {tab === "Policy" && <PolicyTab id={id} />}
      {tab === "Settings" && <SettingsTab agent={a} onChange={reload} />}
    </>
  );
}

function OverviewTab({ id, s, onChange }: { id: string; s: State; onChange: () => void }) {
  const { data: metrics } = useApi<Metrics>(`/agents/${id}/metrics?minutes=180&bucket_s=300`, 30000);
  const { data: deploys } = useApi<Deploy[]>(`/agents/${id}/deploys`, 30000);
  const { data: incidents } = useApi<InboxIncident[]>(`/incidents`, 15000);
  const mine = (incidents ?? []).filter((i) => i.agent_id === id);
  const w = s.window;
  const flags = Object.entries(s.control).filter(([k]) => k.startsWith("flag:"));
  const setControl = async (key: string, value: string | null) => {
    await api(`/agents/${id}/control`, { method: "PUT", json: { key, value } }).catch((e) => alert(e.message));
    onChange();
  };
  return (
    <div className="space-y-6">
      {s.open_incident && (
        <Card className="overflow-hidden border-alert/40">
          <IncidentRow inc={s.open_incident} />
        </Card>
      )}
      {s.agent.status !== "live" && (
        <Empty>
          This agent hasn&apos;t called Nightly yet. Set <code>NIGHTLY_AGENT_TOKEN</code> and start it. See the{" "}
          <Link href="/docs" className="underline">
            SDK quickstart
          </Link>
          .
        </Empty>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="runs watched" value={s.totals.n.toLocaleString()} />
        <Stat label="bad-run rate (last 10)" value={`${Math.round(((w.failed_rate ?? 0) + (w.escalation_rate ?? 0)) * 100)}%`} />
        <Stat label="tool-error rate" value={`${Math.round((w.tool_error_rate ?? 0) * 100)}%`} />
        <Stat label="llm cost / run" value={fmtUsd(w.cost_per_conv, 4)} />
      </div>
      {s.signals.length > 0 && (
        <div className="space-y-1">
          {s.signals.map((g) => (
            <div key={g.name} className="text-sm text-alert">
              ● {g.detail}
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4">
          <Label>bad runs per 5 min · last 3h</Label>
          <div className="mt-3">
            {metrics && metrics.series.length > 1 ? (
              <Sparkline values={metrics.series.map((b) => b.failed)} height={90} />
            ) : (
              <div className="py-8 text-center text-xs text-faint">Not enough data yet.</div>
            )}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
            <span>runs: {metrics?.series.reduce((x, b) => x + b.n, 0) ?? 0}</span>
            <span>loss: {fmtUsd(metrics?.series.reduce((x, b) => x + b.loss, 0) ?? 0)}</span>
          </div>
        </Card>
        <Card className="p-4">
          <Label>live control plane</Label>
          <p className="mt-1 text-xs text-faint">What your agent reads through the SDK. Nightly changes these during incidents.</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="release" v={s.control.active_release} />
            <Row k="model" v={s.control.force_model ? `${s.control.force_model} (failover)` : s.control.default_model} />
            <Row k="step cap" v={s.control.max_steps_cap} />
            {flags.map(([k, v]) => (
              <Row key={k} k={k.slice(5)} v={v} />
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.control.force_model && <Button onClick={() => setControl("force_model", null)}>Clear model failover</Button>}
            {s.control.max_steps_cap && <Button onClick={() => setControl("max_steps_cap", null)}>Remove step cap</Button>}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <Label>deploys</Label>
          </div>
          {(deploys ?? []).length === 0 && <div className="p-4 text-xs text-faint">No deploys reported. Call ns.report_deploy() from CI.</div>}
          {(deploys ?? []).slice(0, 8).map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span className="font-mono text-fg">{d.release}</span>
              <span className="font-mono text-[11px] text-faint">{d.commit_sha ? d.commit_sha.slice(0, 8) : ""}</span>
              <span className="ml-auto text-xs text-muted">
                {d.actor === "nightshift" ? <span className="text-info">Nightly</span> : d.actor} · {ago(d.ts)}
              </span>
              {d.release !== s.control.active_release && (
                <Button onClick={() => confirm(`Deploy ${d.release}?`) && setControl("active_release", d.release)}>Deploy</Button>
              )}
            </div>
          ))}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <Label>incidents</Label>
          </div>
          {mine.length === 0 ? (
            <div className="p-4 text-xs text-faint">None yet.</div>
          ) : (
            mine.slice(0, 6).map((i) => <IncidentRow key={i.id} inc={i} />)
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="truncate font-mono text-fg">{v ?? "—"}</dd>
    </div>
  );
}

const OUTCOME: Record<string, string> = { correct: "var(--ok)", failed: "var(--alert)", escalated: "var(--amber)" };

function TracesTab({ id }: { id: string }) {
  const { data } = useApi<Trace[]>(`/agents/${id}/traces?limit=100`, 8000);
  if (data && data.length === 0) return <Empty>No runs yet.</Empty>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-faint">
          <tr>
            <th className="px-4 py-2 font-normal">when</th>
            <th className="px-4 py-2 font-normal">input</th>
            <th className="px-4 py-2 font-normal">outcome</th>
            <th className="px-4 py-2 font-normal">release</th>
            <th className="px-4 py-2 font-normal">steps</th>
            <th className="px-4 py-2 font-normal">tool err</th>
            <th className="px-4 py-2 font-normal">trace</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-4 py-2 text-muted">{ago(t.ts)}</td>
              <td className="max-w-[340px] truncate px-4 py-2 text-fg-2" title={t.reply ?? ""}>
                {t.message}
              </td>
              <td className="px-4 py-2">
                <Pill color={OUTCOME[t.outcome] ?? "var(--muted)"}>{t.outcome}</Pill>
              </td>
              <td className="px-4 py-2 font-mono text-fg-2">{t.release}</td>
              <td className="px-4 py-2 tabular-nums">{t.steps}</td>
              <td className={`px-4 py-2 tabular-nums ${t.tool_errors ? "text-alert" : "text-faint"}`}>{t.tool_errors}</td>
              <td className="px-4 py-2 font-mono text-[11px] text-faint">{t.trace_id ? t.trace_id.slice(0, 10) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  if (!data) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Label>on-call policy · v{data.version}</Label>
          <Button
            tone="primary"
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
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="mt-3 h-[460px] w-full resize-y rounded-md border border-line bg-[var(--code-bg)] p-3 font-mono text-[12.5px] leading-relaxed text-fg outline-none focus:border-white/30"
        />
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-ok" : "text-alert"}`}>{msg.text}</p>}
      </Card>
      <div className="space-y-4">
        <Card className="p-4 text-sm text-fg-2">
          <Label>how it works</Label>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-[13px] text-muted">
            <li>
              Actions under <code>auto</code> run without waking anyone, only when confidence and projected loss clear the gates. Each must be
              reversible in one step; the API rejects a policy that isn&apos;t.
            </li>
            <li>
              Everything in <code>needs_approval</code> (code fixes, refunds, deleting data, contacting customers) waits for a human, in Slack or
              here.
            </li>
            <li>Every auto action is verified by replaying the failing runs. If verification fails, it&apos;s undone.</li>
          </ul>
        </Card>
        <Card className="p-4">
          <Label>versions</Label>
          <div className="mt-2 space-y-1 font-mono text-[12px] text-muted">
            {data.history.map((h) => (
              <div key={h.version}>
                v{h.version} · {h.created_by ?? "default"} · {ago(h.created_at)}
              </div>
            ))}
          </div>
        </Card>
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="neatlogs root span" hint="The span that wraps one run.">
          <input className={inputCls} value={rootSpan} onChange={(e) => setRootSpan(e.target.value)} />
        </Field>
        <Field label="neatlogs workflow">
          <input className={inputCls} value={workflow} onChange={(e) => setWorkflow(e.target.value)} />
        </Field>
        <Field label="GitHub repo" hint={agent.repo_dir ? "Cloned for provenance." : "owner/name"}>
          <input className={inputCls} value={repo} onChange={(e) => setRepo(e.target.value)} />
        </Field>
        <Button
          tone="primary"
          onClick={() => save({ name, description, root_span_name: rootSpan, workflow_name: workflow, ...(repo !== (agent.repo ?? "") ? { repo } : {}) })}
        >
          Save
        </Button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </Card>
      <div className="space-y-6">
        <Card className="space-y-3 p-5">
          <Label>unit economics</Label>
          <textarea
            value={econ}
            onChange={(e) => setEcon(e.target.value)}
            spellCheck={false}
            className="h-48 w-full rounded-md border border-line bg-[var(--code-bg)] p-3 font-mono text-[12px] text-fg outline-none"
          />
          <Button
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
        </Card>
        <Card className="space-y-3 p-5">
          <Label>credentials</Label>
          <Field label="neatlogs project key" hint={agent.has_neatlogs_key ? `Connected${agent.neatlogs_project_name ? ` to ${agent.neatlogs_project_name}` : ""}. Paste a new key to replace it.` : "Not connected."}>
            <input className={inputCls} type="password" value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
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
              onClick={() =>
                confirm("Rotate the agent token? The old one stops working immediately.") &&
                api<{ token: string }>(`/agents/${agent.id}/token`, { method: "POST" }).then((r) => setToken(r.token))
              }
            >
              Rotate agent token ({agent.token_prefix}…)
            </Button>
          </div>
          {token && <code className="block break-all rounded-md bg-[var(--code-bg)] p-2 font-mono text-xs">{token}</code>}
        </Card>
        <Card className="p-5">
          <Label>danger zone</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => save({ status: agent.status === "paused" ? "live" : "paused" })}>
              {agent.status === "paused" ? "Resume on-call" : "Pause on-call"}
            </Button>
            <Button
              tone="danger"
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
    </div>
  );
}
