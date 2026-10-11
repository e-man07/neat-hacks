"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Code, Field, PageHead, inputCls } from "@/components/app/bits";
import { Button, Card, Label, Pill } from "@/components/ui";
import { API } from "@/lib/api";
import { type Agent, api } from "@/lib/app";

const STEPS = ["Name it", "Add the SDK", "Connect neatlogs", "What a bad run costs", "Go live"];

type Verify = {
  project: { project_name?: string; project_id?: string };
  latest_trace: { trace_id?: string; workflow?: string; root_span_name?: string; created_at?: string };
};

export default function NewAgent() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [token, setToken] = useState("");
  const [key, setKey] = useState("");
  const [verify, setVerify] = useState<Verify | null>(null);
  const [workflow, setWorkflow] = useState("");
  const [rootSpan, setRootSpan] = useState("");
  const [repo, setRepo] = useState("");
  const [runsDay, setRunsDay] = useState(120);
  const [runsNight, setRunsNight] = useState(30);
  const [costFailed, setCostFailed] = useState(5);
  const [nightMinutes, setNightMinutes] = useState(300);
  const [live, setLive] = useState<Agent | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 4 || !agent) return;
    const t = setInterval(async () => {
      const a = await api<Agent>(`/agents/${agent.id}`).catch(() => null);
      if (a && a.status === "live") setLive(a);
    }, 3000);
    return () => clearInterval(t);
  }, [step, agent]);

  return (
    <>
      <PageHead title="Connect an agent" sub="About five minutes. Nightly watches your traces and steers your agent through the SDK; your code stays yours." />
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] ${
              i === step ? "border-white/60 text-fg" : i < step ? "border-ok/40 text-ok" : "border-line text-faint"
            }`}
          >
            {i < step ? "✓ " : `${i + 1}. `}
            {s}
          </li>
        ))}
      </ol>
      {err && <p className="mb-4 rounded-md bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}

      <Card className="p-6">
        {step === 0 && (
          <div className="max-w-lg space-y-4">
            <Field label="Agent name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Support agent" autoFocus />
            </Field>
            <Field label="What does it do?" hint="Nightly's investigator reads this for context.">
              <input
                className={inputCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Answers billing questions and issues refunds"
              />
            </Field>
            <Button
              tone="primary"
              disabled={!name.trim() || busy}
              onClick={() =>
                run(async () => {
                  const r = await api<{ agent: Agent; token: string }>("/agents", { method: "POST", json: { name, description } });
                  setAgent(r.agent);
                  setToken(r.token);
                  setStep(1);
                })
              }
            >
              Create agent
            </Button>
          </div>
        )}

        {step === 1 && agent && (
          <div className="space-y-4">
            <div>
              <Label>agent token (shown once)</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-md border border-line bg-[var(--code-bg)] px-3 py-2 font-mono text-[12.5px] text-fg">{token}</code>
                <Button onClick={() => navigator.clipboard.writeText(token)}>Copy</Button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Install the SDK and read your release, model and kill switches from Nightly. Everything fails open: if Nightly
              is unreachable your agent keeps its defaults.
            </p>
            <Code>{`pip install nightly-sdk neatlogs

export NIGHTLY_API_URL=${API}
export NIGHTLY_AGENT_TOKEN=${token}`}</Code>
            <Code>{`import neatlogs
from nightly_sdk import Nightly

neatlogs.init(api_key=NEATLOGS_KEY, workflow_name="${slugify(agent.name)}")
ns = Nightly()

def handle(message):
    with neatlogs.trace("${slugify(agent.name).replaceAll("-", "_")}_run", kind="WORKFLOW"):
        cfg = load_release(ns.release("v1"))       # Nightly can roll this back
        model = ns.model(cfg.model)                 # ...or fail over the model
        steps = ns.max_steps(cfg.max_steps)         # ...or cap runaway loops
        if not ns.flag("refunds_enabled", True):    # ...or flip a kill switch
            cfg.tools.remove("refund")
        result = run_agent(message, cfg, model, steps)
    ns.record("ok" if result.ok else "failed", value_usd=result.money_lost,
              input=message, output=result.text, steps=result.steps, tool_errors=result.tool_errors)
    return result

ns.serve_replays(lambda message: {"ok": handle_dry_run(message).ok})   # how Nightly verifies a fix
# in CI, after each deploy:  ns.report_deploy("v2", commit=GIT_SHA)`}</Code>
            <Button tone="primary" onClick={() => setStep(2)}>
              Next: connect neatlogs
            </Button>
          </div>
        )}

        {step === 2 && agent && (
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-muted">
              Nightly reads your agent&apos;s traces from neatlogs. Use the project API key from neatlogs → Settings → API keys. It&apos;s
              encrypted at rest.
            </p>
            <Field label="neatlogs project API key">
              <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} placeholder="nl_…" type="password" />
            </Field>
            <Button
              tone="primary"
              disabled={!key.trim() || busy}
              onClick={() =>
                run(async () => {
                  const v = await api<Verify>(`/agents/${agent.id}/neatlogs/verify`, { method: "POST", json: { neatlogs_key: key } });
                  setVerify(v);
                  setWorkflow(v.latest_trace.workflow ?? slugify(agent.name));
                  setRootSpan(v.latest_trace.root_span_name ?? "");
                })
              }
            >
              {busy ? "Checking…" : "Verify key"}
            </Button>
            {verify && (
              <div className="space-y-4 rounded-lg border border-ok/30 bg-ok/[0.04] p-4">
                <div className="text-sm text-ok">
                  ✓ Connected to <b>{verify.project.project_name ?? "your project"}</b>
                  {verify.latest_trace.trace_id ? ", and found traces." : ". No traces yet; send one and they'll show up."}
                </div>
                <Field label="Root span name" hint="The name of the span that wraps one run of your agent. Nightly polls traces with this root.">
                  <input className={inputCls} value={rootSpan} onChange={(e) => setRootSpan(e.target.value)} placeholder="support_conversation" />
                </Field>
                <Field label="Workflow name (optional)">
                  <input className={inputCls} value={workflow} onChange={(e) => setWorkflow(e.target.value)} />
                </Field>
                <Button
                  tone="primary"
                  disabled={!rootSpan.trim() || busy}
                  onClick={() =>
                    run(async () => {
                      await api(`/agents/${agent.id}`, { method: "PATCH", json: { root_span_name: rootSpan.trim(), workflow_name: workflow.trim() } });
                      setStep(3);
                    })
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 3 && agent && (
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-muted">
              Nightly prices every incident so it knows when acting alone beats waiting for you. Rough numbers are fine; you can
              sync them from your cfo.ai model later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Runs per hour (day)">
                <input className={inputCls} type="number" value={runsDay} onChange={(e) => setRunsDay(+e.target.value)} />
              </Field>
              <Field label="Runs per hour (night)">
                <input className={inputCls} type="number" value={runsNight} onChange={(e) => setRunsNight(+e.target.value)} />
              </Field>
              <Field label="Cost of one bad run (USD)" hint="Refund, support ticket, churn risk…">
                <input className={inputCls} type="number" step="0.5" value={costFailed} onChange={(e) => setCostFailed(+e.target.value)} />
              </Field>
              <Field label="Minutes until a human responds at night">
                <input className={inputCls} type="number" value={nightMinutes} onChange={(e) => setNightMinutes(+e.target.value)} />
              </Field>
            </div>
            <Field label="GitHub repo (optional)" hint="owner/name. Lets Nightly trace a release to its commit and Entire checkpoint, and open fix PRs after you approve.">
              <input className={inputCls} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="acme/support-agent" />
            </Field>
            <Button
              tone="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api(`/agents/${agent.id}`, {
                    method: "PATCH",
                    json: {
                      ...(repo.trim() ? { repo: repo.trim() } : {}),
                      economics: {
                        runs_per_hour: { day: runsDay, night: runsNight },
                        cost_per_failed_run_usd: costFailed,
                        human_response_minutes: { business_hours: 15, evening: 45, night: nightMinutes },
                        source: "entered at onboarding",
                      },
                    },
                  });
                  setStep(4);
                })
              }
            >
              Save and go live
            </Button>
          </div>
        )}

        {step === 4 && agent && (
          <div className="space-y-4">
            {live ? (
              <>
                <Pill color="var(--ok)">live</Pill>
                <p className="text-sm text-fg-2">
                  {agent.name} just checked in. Nightly is on call. It will auto-contain incidents within the default policy
                  (rollback, model failover, kill switches, step caps) and page you for anything irreversible.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button tone="primary" onClick={() => router.push(`/app/agents/${agent.id}`)}>
                    Open {agent.name}
                  </Button>
                  <Link href="/app/integrations" className="rounded-md border border-line-strong px-3 py-1.5 text-xs text-fg">
                    Set up Slack paging
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Pill color="var(--amber)" pulse>
                  waiting for the first SDK call
                </Pill>
                <p className="text-sm text-muted">
                  Start your agent with the environment variables from step 2. This page updates when it calls Nightly.
                </p>
                <Link href={`/app/agents/${agent.id}`} className="text-sm underline">
                  Skip, open the agent page
                </Link>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-agent";
}
