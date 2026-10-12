"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  BellRing,
  Bot,
  CheckCheck,
  CircleCheck,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  GitCommitHorizontal,
  Lightbulb,
  MessageSquareQuote,
  Radar,
  Scale,
  Search,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  Undo2,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { IncidentStatus, Section, Severity, Tone } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type IncidentDetail, clockTime, money, short } from "@/lib/api";
import { ago } from "@/lib/app";
import { cn } from "@/lib/utils";

const KIND: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  detect: { label: "Detect", icon: Radar, cls: "bg-alert/10 text-alert border-alert/20" },
  detection: { label: "neatlogs", icon: Eye, cls: "bg-secondary text-muted-foreground" },
  investigate: { label: "Investigate", icon: Search, cls: "bg-info/10 text-info border-info/20" },
  step: { label: "Tool", icon: Wrench, cls: "bg-secondary text-muted-foreground" },
  diagnosis: { label: "Diagnosis", icon: Stethoscope, cls: "bg-violet/10 text-violet border-violet/20" },
  impact: { label: "Price", icon: DollarSign, cls: "bg-amber/10 text-amber border-amber/25" },
  decide: { label: "Policy", icon: Scale, cls: "bg-info/10 text-info border-info/20" },
  propose: { label: "Propose", icon: Lightbulb, cls: "bg-amber/10 text-amber border-amber/25" },
  act: { label: "Act", icon: Zap, cls: "bg-ok/10 text-ok border-ok/20" },
  verify: { label: "Verify", icon: CheckCheck, cls: "bg-ok/10 text-ok border-ok/20" },
  regression: { label: "Test", icon: FlaskConical, cls: "bg-secondary text-muted-foreground" },
  page: { label: "Page", icon: BellRing, cls: "bg-amber/10 text-amber border-amber/25" },
  defer: { label: "Defer", icon: Clock, cls: "bg-secondary text-muted-foreground" },
  resolved: { label: "Resolved", icon: CircleCheck, cls: "bg-ok/10 text-ok border-ok/20" },
  undo: { label: "Undo", icon: Undo2, cls: "bg-alert/10 text-alert border-alert/20" },
};

export default function IncidentView({
  inc,
  agentId,
  agentName,
  onChange,
  onApprove,
  onUndo,
}: {
  inc: IncidentDetail;
  agentId: string;
  agentName: string;
  onChange: () => void;
  onApprove: (actionId: number) => Promise<unknown>;
  onUndo: (actionId: number) => Promise<unknown>;
}) {
  const d = inc.diagnosis;
  const p = d?.provenance;
  const steps = inc.events.filter((e) => !(e.kind === "step" && e.title.startsWith("think")));
  const thoughts = inc.events.filter((e) => e.kind === "step" && e.title.startsWith("think"));
  const proposals = inc.actions.filter((a) => a.status === "proposed");
  const undoable = inc.actions.filter((a) => a.status === "applied" && a.mode === "auto");
  const replay = inc.verification?.replay;
  const decision = inc.events.find((e) => e.kind === "decide")?.detail as { mode: string; reasons: string[] } | undefined;
  const prompt = d?.coding_prompt || p?.coding_prompts?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <IncidentStatus status={inc.status} />
            {inc.severity && <Severity severity={inc.severity} />}
            {inc.type && <Tone color="grey">{inc.type.replaceAll("_", " ")}</Tone>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{inc.title ?? "Investigating…"}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <Link href={`/app/agents/${agentId}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
              <Bot className="size-3.5" /> {agentName}
            </Link>
            <span>·</span>
            <span className="font-mono text-xs">{inc.id}</span>
            <span>·</span>
            <span>opened {ago(inc.opened_at)}</span>
            {inc.resolved_at && (
              <>
                <span>·</span>
                <span className="text-ok">resolved in {Math.max(1, Math.round((inc.resolved_at - inc.opened_at) / 60))} min</span>
              </>
            )}
          </div>
          {inc.summary && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/80">{inc.summary}</p>}
        </div>
      </div>

      {/* Needs a human */}
      {(proposals.length > 0 || undoable.length > 0) && (
        <div className="space-y-3">
          {proposals.map((a) => (
            <Card key={a.id} className="flex-row items-start gap-4 border-amber/30 bg-amber/[0.06] px-5 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber/15 text-amber">
                <TriangleAlert className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">Needs your approval · {a.kind.replaceAll("_", " ")}</div>
                <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
                  {String((a.params as Record<string, unknown>).summary ?? JSON.stringify(a.params))}
                </p>
              </div>
              <Button
                onClick={() =>
                  onApprove(a.id)
                    .catch((e) => alert((e as Error).message))
                    .then(onChange)
                }
              >
                <CircleCheck /> Approve
              </Button>
            </Card>
          ))}
          {undoable.map((a) => (
            <Card key={a.id} className="flex-row items-center gap-4 px-5 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok">
                <Zap className="size-4" />
              </span>
              <div className="min-w-0 flex-1 text-sm text-foreground/80">
                Nightly applied <span className="font-mono font-medium text-foreground">{a.kind.replaceAll("_", " ")}</span> on its own. It
                can be undone in one step.
              </div>
              <Button variant="outline" className="border-alert/30 text-alert hover:bg-alert/10 hover:text-alert" onClick={() => onUndo(a.id).then(onChange)}>
                <Undo2 /> Undo
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Impact KPIs */}
          {(inc.impact || replay) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Loss rate" icon={DollarSign} value={inc.impact ? `${money(inc.impact.loss_per_minute, 2)}/min` : "—"} cls="text-amber" />
              <Stat
                label="If it waited"
                icon={Clock}
                value={inc.impact ? money(inc.impact.projected_loss_if_waiting) : "—"}
                hint={inc.impact ? `${inc.impact.human_response_minutes} min to a human` : undefined}
              />
              <Stat label="Replay" icon={ShieldCheck} value={replay ? `${replay.passed}/${replay.n} pass` : "—"} cls="text-ok">
                {replay && <Progress value={(replay.passed / Math.max(replay.n, 1)) * 100} className="mt-2 h-1.5 bg-secondary [&>div]:bg-ok" />}
              </Stat>
            </div>
          )}

          {/* Timeline */}
          <Section title="Timeline" icon={Clock} description={`${steps.length} events`}>
            <ol className="relative">
              {steps.map((e, i) => {
                const k = KIND[e.kind] ?? { label: e.kind, icon: FileText, cls: "bg-secondary text-muted-foreground" };
                const isStep = e.kind === "step";
                const last = i === steps.length - 1;
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {!last && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />}
                    <span className={cn("z-10 grid size-8 shrink-0 place-items-center rounded-full border", k.cls, isStep && "scale-75")}>
                      <k.icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{k.label}</span>
                        <span className="font-mono text-[11px] text-muted-foreground/70">{clockTime(e.ts)}</span>
                      </div>
                      <div className={cn("mt-0.5 text-sm break-words", isStep ? "font-mono text-xs text-muted-foreground" : "text-foreground")}>
                        {e.title}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {thoughts.length > 0 && (
              <details className="mt-4 rounded-lg border bg-secondary/40 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Investigator reasoning ({thoughts.length})</summary>
                <div className="mt-3 space-y-3">
                  {thoughts.map((t) => (
                    <p key={t.id} className="text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {t.title.replace(/^think:\s*/, "")}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </Section>

          {/* Postmortem */}
          <Section title="Postmortem" description="Written by Nightly" icon={FileText}>
            {inc.postmortem ? (
              <div className="prose-ns [&>*:first-child]:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{inc.postmortem}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">The postmortem is written once the incident resolves.</p>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Provenance */}
          {p && (
            <Section title="Provenance" description="Root cause → commit → Entire checkpoint → prompt" icon={GitCommitHorizontal} className="border-violet/25">
              <ol className="space-y-1">
                <ChainStep icon={TriangleAlert} label="Release">
                  <span className="font-mono">{p.release}</span>
                </ChainStep>
                <ChainArrow />
                <ChainStep icon={GitCommitHorizontal} label="Commit">
                  <span className="font-mono">{short(p.commit, 8)}</span>
                  {p.commit_subject && <span className="text-muted-foreground"> “{p.commit_subject}”</span>}
                </ChainStep>
                <ChainArrow />
                <ChainStep icon={Bot} label="Entire checkpoint">
                  <span className="font-mono">{p.checkpoint_id ?? "—"}</span>
                  {p.agent && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.agent} {p.model ?? ""}
                    </span>
                  )}
                </ChainStep>
                {prompt && (
                  <>
                    <ChainArrow />
                    <ChainStep icon={MessageSquareQuote} label="Prompt">
                      <details className="group">
                        <summary className="cursor-pointer list-none group-open:hidden">
                          <span className="line-clamp-3">“{prompt}”</span>
                          <span className="text-xs text-info">show full prompt</span>
                        </summary>
                        <p>“{prompt}”</p>
                      </details>
                    </ChainStep>
                  </>
                )}
              </ol>
              {p.coding_agent_note && (
                <details className="mt-4 rounded-lg border border-amber/25 bg-amber/[0.06] px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-amber">The coding agent warned about this. Nobody read it.</summary>
                  <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/75">{p.coding_agent_note}</p>
                </details>
              )}
              {p.graph_changes && (
                <details className="mt-3 rounded-lg border px-3 py-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">What changed, per entire-graph</summary>
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{p.graph_changes}</pre>
                </details>
              )}
              {p.entire_url && (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <a href={p.entire_url} target="_blank" rel="noreferrer">
                    Open checkpoint on entire.io <ExternalLink />
                  </a>
                </Button>
              )}
            </Section>
          )}

          {/* Decision */}
          {decision?.reasons?.length ? (
            <Section
              title={`Why Nightly ${decision.mode === "auto" ? "acted on its own" : decision.mode === "defer" ? "waited for the morning" : "asked a human"}`}
              description={d ? `confidence ${Math.round(d.confidence * 100)}% · ${(d.evidence_trace_ids ?? []).length} traces cited` : undefined}
              icon={Scale}
            >
              <ul className="space-y-2 text-sm">
                {decision.reasons.map((r, i) => {
                  const last = i === decision.reasons.length - 1 && decision.mode !== "auto";
                  return (
                    <li key={i} className="flex gap-2.5">
                      {last ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" /> : <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />}
                      <span className="text-foreground/80">{r}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          {/* Diagnosis */}
          {d && (
            <Section title="Diagnosis" icon={Stethoscope}>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Root cause</dt>
                  <dd className="mt-0.5 text-foreground/85">{d.root_cause}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Action</dt>
                  <dd className="font-mono text-xs">{d.action.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd className="tabular-nums">{Math.round(d.confidence * 100)}%</dd>
                  </div>
                  <Progress value={d.confidence * 100} className="mt-1.5 h-1.5 bg-secondary" />
                </div>
                {d.permanent_fix && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Permanent fix</dt>
                    <dd className="mt-0.5 text-foreground/85">{d.permanent_fix}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}

          {/* How it was priced */}
          {inc.impact && (
            <Section title="How Nightly priced it" icon={DollarSign} description={inc.impact.economics_source || undefined}>
              <div className="space-y-2 text-sm">
                <Line k="Lost per bad run" v={money(inc.impact.excess_loss_per_conversation + (inc.impact.extra_llm_cost_per_conversation ?? 0), 2)} />
                <Line k={`Runs/min at ${inc.impact.local_time}`} v={`× ${inc.impact.conversations_per_minute}`} />
                <Line k="Loss rate" v={<span className="text-amber">{money(inc.impact.loss_per_minute, 2)}/min</span>} />
                <Line k="Until a human would answer" v={`× ${inc.impact.human_response_minutes} min`} />
                <div className="border-t pt-2">
                  <Line k={<span className="font-medium text-foreground">At risk</span>} v={<span className="font-semibold">{money(inc.impact.projected_loss_if_waiting)}</span>} />
                </div>
                {inc.impact.observed_loss > 0 && (
                  <Line k="Already lost before Nightly acted" v={<span className="text-alert">{money(inc.impact.observed_loss, 2)}</span>} />
                )}
              </div>
            </Section>
          )}

          {/* Verification */}
          {inc.verification && (replay || inc.verification.live_reasons?.length) ? (
            <Section title="Verification" icon={ShieldCheck}>
              {replay && (
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Replayed failing runs</span>
                    <span className="font-medium text-ok tabular-nums">
                      {replay.passed}/{replay.n} pass
                    </span>
                  </div>
                  <Progress value={(replay.passed / Math.max(replay.n, 1)) * 100} className="mt-2 h-1.5 bg-secondary [&>div]:bg-ok" />
                </div>
              )}
              {inc.verification.live_ok != null && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {inc.verification.live_ok ? <CircleCheck className="size-4 text-ok" /> : <TriangleAlert className="size-4 text-amber" />}
                  <span className="text-foreground/80">Live traffic {inc.verification.live_ok ? "healthy after the fix" : "not yet healthy"}</span>
                </div>
              )}
              {inc.verification.live_reasons?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                  {inc.verification.live_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  hint,
  cls,
  children,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  cls?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 px-4 py-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <Icon className="size-3.5" />
      </div>
      <div className={cn("mt-1 text-xl font-semibold tracking-tight tabular-nums", cls ?? "text-foreground")}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </Card>
  );
}

function ChainStep({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border bg-background px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-violet" />
      <div className="min-w-0 text-sm break-words">
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
        <div className="mt-0.5 text-foreground">{children}</div>
      </div>
    </li>
  );
}

function ChainArrow() {
  return (
    <li aria-hidden className="flex justify-center">
      <ArrowDown className="size-3.5 text-muted-foreground/60" />
    </li>
  );
}

function Line({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-[13px] tabular-nums">{v}</span>
    </div>
  );
}
