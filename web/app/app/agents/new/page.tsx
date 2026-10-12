"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ClipboardCopy, Loader2, PartyPopper } from "lucide-react";
import { Code, Field, Notice, PageHead, Tone } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { API } from "@/lib/api";
import { type Agent, api } from "@/lib/app";

const STEPS = ["Name it", "Add the SDK", "Connect neatlogs", "What a bad run costs", "Go live"];
const STEP_HINTS = ["Name and purpose", "Token and two lines of code", "Where Nightly reads traces", "So it can price incidents", "Wait for the first call"];

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
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0">
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex shrink-0 items-start gap-3 lg:pb-6 lg:last:pb-0">
              {i < STEPS.length - 1 && <span className={cn("absolute top-8 bottom-0 left-[13px] hidden w-px lg:block", i < step ? "bg-ok/40" : "bg-border")} />}
              <span
                className={cn(
                  "z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
                  i === step ? "border-foreground bg-foreground text-background" : i < step ? "border-ok/30 bg-ok/10 text-ok" : "bg-background text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="hidden pt-1 sm:block">
                <div className={cn("text-sm", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</div>
                <div className="hidden text-xs text-muted-foreground/80 lg:block">{STEP_HINTS[i]}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="min-w-0 space-y-4">
      {err && <Notice ok={false}>{err}</Notice>}

      <Card className="gap-5">
        <CardHeader className="border-b [.border-b]:pb-5">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">Step {step + 1} of {STEPS.length}</CardDescription>
          <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
        {step === 0 && (
          <div className="max-w-lg space-y-4">
            <Field label="Agent name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support agent" autoFocus />
            </Field>
            <Field label="What does it do?" hint="Nightly's investigator reads this for context.">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Answers billing questions and issues refunds"
              />
            </Field>
            <Button
              
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
              <div className="text-sm font-medium text-foreground">Agent token <span className="font-normal text-muted-foreground">(shown once)</span></div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 rounded-md border bg-[var(--code-bg)] px-3 py-2 font-mono text-[12.5px] break-all text-foreground">{token}</code>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(token)}>
                  <ClipboardCopy /> Copy
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
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
            <Button onClick={() => setStep(2)}>
              Next: connect neatlogs
            </Button>
          </div>
        )}

        {step === 2 && agent && (
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-muted-foreground">
              Nightly reads your agent&apos;s traces from neatlogs. Use the project API key from neatlogs → Settings → API keys. It&apos;s
              encrypted at rest.
            </p>
            <Field label="neatlogs project API key">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="nl_…" type="password" />
            </Field>
            <Button
              
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
                  <Check className="mr-1 inline size-4 align-[-3px]" /> Connected to <b>{verify.project.project_name ?? "your project"}</b>
                  {verify.latest_trace.trace_id ? ", and found traces." : ". No traces yet; send one and they'll show up."}
                </div>
                <Field label="Root span name" hint="The name of the span that wraps one run of your agent. Nightly polls traces with this root.">
                  <Input value={rootSpan} onChange={(e) => setRootSpan(e.target.value)} placeholder="support_conversation" />
                </Field>
                <Field label="Workflow name (optional)">
                  <Input value={workflow} onChange={(e) => setWorkflow(e.target.value)} />
                </Field>
                <Button
                  
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
            <p className="text-sm text-muted-foreground">
              Nightly prices every incident so it knows when acting alone beats waiting for you. Rough numbers are fine; you can
              sync them from your cfo.ai model later.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Runs per hour (day)">
                <Input type="number" value={runsDay} onChange={(e) => setRunsDay(+e.target.value)} />
              </Field>
              <Field label="Runs per hour (night)">
                <Input type="number" value={runsNight} onChange={(e) => setRunsNight(+e.target.value)} />
              </Field>
              <Field label="Cost of one bad run (USD)" hint="Refund, support ticket, churn risk…">
                <Input type="number" step="0.5" value={costFailed} onChange={(e) => setCostFailed(+e.target.value)} />
              </Field>
              <Field label="Minutes until a human responds at night">
                <Input type="number" value={nightMinutes} onChange={(e) => setNightMinutes(+e.target.value)} />
              </Field>
            </div>
            <Field label="GitHub repo (optional)" hint="owner/name. Lets Nightly trace a release to its commit and Entire checkpoint, and open fix PRs after you approve.">
              <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="acme/support-agent" />
            </Field>
            <Button
              
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
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-ok/10 text-ok">
                    <PartyPopper className="size-5" />
                  </span>
                  <Tone color="ok" pulse>live</Tone>
                </div>
                <p className="text-sm text-foreground/80">
                  {agent.name} just checked in. Nightly is on call. It will auto-contain incidents within the default policy
                  (rollback, model failover, kill switches, step caps) and page you for anything irreversible.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => router.push(`/app/agents/${agent.id}`)}>
                    Open {agent.name}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/app/integrations">Set up Slack paging</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-amber/10 text-amber">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                  <Tone color="amber" pulse>waiting for the first SDK call</Tone>
                </div>
                <p className="text-sm text-muted-foreground">
                  Start your agent with the environment variables from step 2. This page updates when it calls Nightly.
                </p>
                <Link href={`/app/agents/${agent.id}`} className="text-sm font-medium text-foreground underline underline-offset-4">
                  Skip, open the agent page
                </Link>
              </>
            )}
          </div>
        )}
        </CardContent>
      </Card>
        </div>
      </div>
    </>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-agent";
}
