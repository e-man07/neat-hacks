"use client";

import Link from "next/link";
import { clockTime, money, post, short, type IncidentDetail } from "@/lib/api";
import { Button, Label, Pill } from "../ui";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "var(--alert)",
  INVESTIGATING: "var(--alert)",
  MITIGATING: "var(--amber)",
  MONITORING: "var(--amber)",
  RESOLVED: "var(--ok)",
  AWAITING_HUMAN: "var(--alert)",
  ESCALATED: "var(--alert)",
  DEFERRED: "var(--amber)",
};

const KIND: Record<string, [string, string]> = {
  detect: ["DETECT", "var(--alert)"],
  investigate: ["INVESTIGATE", "var(--info)"],
  step: ["", "var(--faint)"],
  diagnosis: ["DIAGNOSIS", "var(--violet)"],
  impact: ["PRICE", "var(--amber)"],
  decide: ["POLICY", "var(--info)"],
  propose: ["PROPOSE", "var(--faint)"],
  act: ["ACT", "var(--ok)"],
  verify: ["VERIFY", "var(--ok)"],
  regression: ["TEST", "var(--faint)"],
  detection: ["NEATLOGS", "var(--faint)"],
  page: ["PAGE", "var(--amber)"],
  defer: ["DEFER", "var(--amber)"],
  resolved: ["RESOLVED", "var(--ok)"],
  undo: ["UNDO", "var(--alert)"],
};

export default function IncidentPanel({
  inc,
  onChange,
  offset = 0,
  onApprove = (id) => post(`/api/actions/${id}/approve`),
  onUndo,
}: {
  inc: IncidentDetail | null;
  onChange: () => void;
  offset?: number;
  onApprove?: (actionId: number) => Promise<unknown>;
  onUndo?: (actionId: number) => Promise<unknown>;
}) {
  if (!inc) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <div className="text-[15px] text-white/80">All quiet.</div>
          <div className="mt-1 text-[13px] text-white/40">Night Shift is watching every conversation. Ship a bad release to wake it up.</div>
        </div>
      </div>
    );
  }
  const d = inc.diagnosis;
  const p = d?.provenance;
  const steps = inc.events.filter((e) => !(e.kind === "step" && e.title.startsWith("think")));
  const thoughts = inc.events.filter((e) => e.kind === "step" && e.title.startsWith("think"));
  const proposals = inc.actions.filter((a) => a.status === "proposed");
  const replay = inc.verification?.replay;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Pill color={STATUS_COLOR[inc.status] ?? "var(--muted)"} pulse={["OPEN", "INVESTIGATING", "AWAITING_HUMAN"].includes(inc.status)}>
          {inc.status.replace("_", " ")}
        </Pill>
        {inc.severity && <Pill color="var(--alert)">{inc.severity}</Pill>}
        <Link href={`/incidents/${inc.id}`} className="font-mono text-[11px] text-white/40 hover:text-white">
          {inc.id} ↗
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="text-[17px] font-medium tracking-tight text-white">{inc.title}</div>
        {inc.summary && <p className="mt-1 text-[13px] leading-relaxed text-white/60">{inc.summary}</p>}

        {/* Provenance */}
        {p && (
          <div className="mt-4 rounded-lg border border-violet/30 bg-violet/[0.06] p-3">
            <Label>root cause → commit → Entire checkpoint → prompt</Label>
            <div className="mt-2 font-mono text-[11.5px] text-white/70">
              {p.release} · {short(p.commit, 8)} “{p.commit_subject}” · {p.checkpoint_id}
              {p.agent ? ` · ${p.agent} ${p.model ?? ""}` : ""}
            </div>
            {(d?.coding_prompt || p.coding_prompts?.[0]) && (
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-[13px] leading-relaxed text-white/85 group-open:hidden">
                  <span className="line-clamp-3">“{d?.coding_prompt || p.coding_prompts[0]}”</span>
                  <span className="text-[11px] text-white/40">show full prompt</span>
                </summary>
                <p className="text-[13px] leading-relaxed text-white/85">“{d?.coding_prompt || p.coding_prompts[0]}”</p>
              </details>
            )}
            {p.coding_agent_note && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] text-amber">The coding agent warned about this. Nobody read it.</summary>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">{p.coding_agent_note}</p>
              </details>
            )}
            {p.graph_changes && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] text-white/50">What changed, per entire-graph</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/55">
                  {p.graph_changes}
                </pre>
              </details>
            )}
            {p.entire_url && (
              <a href={p.entire_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-info underline underline-offset-2">
                open checkpoint on entire.io
              </a>
            )}
          </div>
        )}

        {/* Impact + verification */}
        {(inc.impact || replay) && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-line p-2.5">
              <Label>loss rate</Label>
              <div className="mt-1 text-[18px] text-amber">{inc.impact ? `${money(inc.impact.loss_per_minute, 2)}/min` : "—"}</div>
            </div>
            <div className="rounded-lg border border-line p-2.5">
              <Label>if we waited</Label>
              <div className="mt-1 text-[18px] text-white">
                {inc.impact ? money(inc.impact.projected_loss_if_waiting) : "—"}
              </div>
              <div className="text-[10.5px] text-white/35">{inc.impact ? `${inc.impact.human_response_minutes} min to a human` : ""}</div>
            </div>
            <div className="rounded-lg border border-line p-2.5">
              <Label>replay</Label>
              <div className="mt-1 text-[18px] text-ok">{replay ? `${replay.passed}/${replay.n} pass` : "—"}</div>
            </div>
          </div>
        )}

        {/* Proposals */}
        {proposals.length > 0 && (
          <div className="mt-3 space-y-2">
            {proposals.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-amber/30 bg-amber/[0.05] p-3">
                <div className="min-w-0 flex-1">
                  <Label>needs your approval · {a.kind.replaceAll("_", " ")}</Label>
                  <p className="mt-1 line-clamp-3 text-[12.5px] text-white/75">
                    {String((a.params as Record<string, unknown>).summary ?? JSON.stringify(a.params))}
                  </p>
                </div>
                <Button
                  tone="primary"
                  onClick={() =>
                    onApprove(a.id)
                      .catch((e) => alert((e as Error).message))
                      .then(onChange)
                  }
                >
                  Approve
                </Button>
              </div>
            ))}
          </div>
        )}

        {onUndo &&
          inc.actions
            .filter((a) => a.status === "applied" && a.mode === "auto")
            .map((a) => (
              <div key={a.id} className="mt-3 flex items-center gap-3 rounded-lg border border-line p-3">
                <div className="min-w-0 flex-1 text-[12.5px] text-white/75">
                  Night Shift applied <span className="font-mono">{a.kind.replaceAll("_", " ")}</span> on its own. It can be undone in one step.
                </div>
                <Button tone="danger" onClick={() => onUndo(a.id).then(onChange)}>
                  Undo
                </Button>
              </div>
            ))}

        {/* Timeline */}
        <div className="mt-4">
          <Label>timeline</Label>
          <div className="mt-2 space-y-1.5 font-mono text-[11.5px]">
            {steps.map((e) => {
              const [tag, color] = KIND[e.kind] ?? [e.kind.toUpperCase(), "var(--faint)"];
              const isStep = e.kind === "step";
              return (
                <div key={e.id} className="slide-in flex gap-2">
                  <span className="shrink-0 text-white/30">{clockTime(e.ts, offset)}</span>
                  <span className="w-[78px] shrink-0" style={{ color }}>{isStep ? "  ↳ tool" : tag}</span>
                  <span className={isStep ? "text-white/45" : "text-white/85"}>{e.title}</span>
                </div>
              );
            })}
          </div>
          {thoughts.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[11px] text-white/40">investigator reasoning ({thoughts.length})</summary>
              <div className="mt-2 space-y-2">
                {thoughts.map((t) => (
                  <p key={t.id} className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/55">
                    {t.title.replace(/^think:\s*/, "")}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
