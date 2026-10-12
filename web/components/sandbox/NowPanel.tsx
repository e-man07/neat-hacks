"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, GitCommitHorizontal, RotateCcw, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import Phone, { type PhoneNote } from "@/components/Phone";
import { money, type Conversation, type IncidentDetail, type Release } from "@/lib/api";
import { OUTCOME } from "./ChatFeed";
import { STEPS } from "./Stepper";
import { Markdown, plain } from "./text";

export type StoryData = {
  inc: IncidentDetail | null;
  release: Release | null; // the bad release (r46)
  since: Conversation[]; // chats since the bad change shipped, newest first
  lost: number;
  notes: PhoneNote[];
  clock: string;
};

function Big({ children, tone = "fg" }: { children: ReactNode; tone?: "fg" | "alert" | "ok" | "amber" }) {
  const c = { fg: "text-fg", alert: "text-alert", ok: "text-ok", amber: "text-amber" }[tone];
  return <div className={`text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px] ${c}`}>{children}</div>;
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13.5px] text-muted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber" />
      {children}
    </div>
  );
}

function Shipped({ d }: { d: StoryData }) {
  const ok = d.since.length;
  const wrong = d.since.filter((c) => c.outcome === "wrong_refund").length;
  const p = d.release?.provenance;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-card-2 p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <GitCommitHorizontal size={14} /> New version live · written by {p?.agent ?? "a coding agent"}
        </div>
        <div className="mt-1 text-[17px] font-medium text-fg">“{d.release?.title ?? "One-step refunds"}”</div>
        <div className="mt-1 text-[13.5px] leading-relaxed text-muted">
          Makes refunds faster: one step instead of three. Written from a one-paragraph request.
        </div>
      </div>
      <div>
        <Big tone="ok">Every request still returns 200.</Big>
        <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-fg-2">
          No errors, no crashes. A normal dashboard stays green. But the bot has quietly stopped checking the refund policy.
        </p>
      </div>
      <div className="flex flex-wrap gap-6 text-[13px] text-muted">
        <span>
          <span className="font-mono text-[18px] text-fg tabular-nums">{ok}</span> chats since the change
        </span>
        <span>
          <span className="font-mono text-[18px] text-alert tabular-nums">{wrong}</span> wrong refunds
        </span>
      </div>
    </div>
  );
}

function Noticed({ d }: { d: StoryData }) {
  const detect = d.inc?.events.find((e) => e.kind === "detect");
  const sig = (detect?.detail as { signals?: { description: string }[] } | null)?.signals?.[0];
  const wrong = d.since.filter((c) => OUTCOME[c.outcome]?.bad).slice(0, 3);
  return (
    <div className="space-y-5">
      <div>
        <Big tone="alert">{money(d.lost, 2)} lost so far</Big>
        <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed text-fg-2">
          {sig ? `Nightly read the bot’s traces: ${sig.description.replace(/\s*\(.*\)$/, "")}.` : "Nightly reads every chat’s trace and outcome, not just the status code."}
        </p>
      </div>
      <div className="space-y-2">
        {wrong.map((c) => (
          <div key={c.id} className="rounded-xl border border-alert/25 bg-alert/[0.04] px-3.5 py-2.5">
            <div className="flex items-start gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-fg">Customer: “{plain(c.message)}”</span>
              <span className="shrink-0 font-mono text-[12px] text-alert">−{money(c.loss_usd, 2)}</span>
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-muted">Bot: {plain(c.reply)}</div>
          </div>
        ))}
        {!wrong.length && <Waiting>Watching for bad outcomes…</Waiting>}
      </div>
    </div>
  );
}

function Cause({ d }: { d: StoryData }) {
  const [open, setOpen] = useState(false);
  const diag = d.inc?.diagnosis;
  const p = diag?.provenance;
  const prompt = diag?.coding_prompt || p?.coding_prompts?.[0];
  if (!diag) return <Waiting>Following the traces back to the change…</Waiting>;
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed text-fg-2">{plain(diag.root_cause)}</p>
      {prompt && (
        <div className="rounded-xl border border-line bg-card-2 p-4">
          <div className="text-[12px] font-medium tracking-wide text-muted uppercase">The prompt behind the change</div>
          <blockquote className={`mt-2 text-[15px] leading-relaxed text-fg ${open ? "" : "line-clamp-4"}`}>“{prompt}”</blockquote>
          {p && (
            <div className="mt-2 text-[12px] text-muted">
              Asked of {p.agent ?? "a coding agent"} · saved as a checkpoint in Entire
            </div>
          )}
        </div>
      )}
      {p?.coding_agent_note && (
        <div className="rounded-xl border border-amber/35 bg-amber/[0.06] p-4">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber" />
            <span className="flex-1 text-[14.5px] font-medium text-fg">The coding agent warned about this. Nobody read it.</span>
            <ChevronDown size={16} className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <Markdown text={p.coding_agent_note} className="mt-3 pl-6 text-[13px] leading-relaxed text-fg-2" />}
          {!open && <div className="mt-1 pl-6 text-[12.5px] text-muted">Show what it said</div>}
        </div>
      )}
    </div>
  );
}

function Priced({ d }: { d: StoryData }) {
  const im = d.inc?.impact;
  if (!im) return <Waiting>Pricing the damage…</Waiting>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[22px] font-semibold tracking-tight sm:text-[28px]">
        <span className="text-alert">{money(im.loss_per_minute, 0)}/min</span>
        <span className="text-faint">×</span>
        <span className="text-fg">{Math.round(im.human_response_minutes)} min</span>
        <span className="text-faint">=</span>
        <span className="text-fg">{money(im.projected_loss_if_waiting)}</span>
      </div>
      <p className="max-w-[58ch] text-[14.5px] leading-relaxed text-fg-2">
        It’s {im.local_time} where the on-call engineer lives, so a human would take about {Math.round(im.human_response_minutes / 60)} hours to answer.
        Waiting would put <strong className="font-semibold text-fg">{money(im.projected_loss_if_waiting)}</strong> at risk.
      </p>
      <div className="text-[12.5px] text-muted">
        {money(im.excess_loss_per_conversation, 2)} lost per bad chat × {im.conversations_per_minute} chats a minute, from the company’s unit economics in cfo.ai.
      </div>
    </div>
  );
}

function Contained({ d }: { d: StoryData }) {
  const inc = d.inc;
  const act = inc?.events.find((e) => e.kind === "act");
  const decide = inc?.events.find((e) => e.kind === "decide")?.detail as { mode?: string; reasons?: string[] } | undefined;
  const target = (act?.detail as { params?: { target?: string } } | null)?.params?.target;
  const summary = (act?.detail as { summary?: string } | null)?.summary;
  if (!act && !decide) return <Waiting>Checking what it’s allowed to do on its own…</Waiting>;
  if (!act) {
    return (
      <div className="space-y-3">
        <Big tone="amber">Nightly asked a human first.</Big>
        <ul className="space-y-1.5 text-[14px] text-fg-2">
          {(decide?.reasons ?? []).map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
      </div>
    );
  }
  const conf = inc?.diagnosis?.confidence;
  const chips = [
    "Undo is one click",
    conf != null ? `${Math.round(conf * 100)}% sure of the cause` : "Confident in the cause",
    inc?.impact ? `Waiting would cost ${money(inc.impact.projected_loss_if_waiting)}` : "Waiting costs more",
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <RotateCcw size={26} className="mt-1 shrink-0 text-ok" />
        <div>
          <Big>{summary ? summary.charAt(0).toUpperCase() + summary.slice(1) : "Rolled back"}, automatically.</Big>
          <p className="mt-1.5 text-[14.5px] text-fg-2">
            {target ? `${target} is the last version that worked. ` : ""}No one had to wake up for this part.
          </p>
        </div>
      </div>
      <div>
        <div className="text-[12px] font-medium tracking-wide text-muted uppercase">Why the rules allowed it</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/[0.06] px-3 py-1 text-[13px] text-fg">
              <ShieldCheck size={14} className="text-ok" /> {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Proved({ d }: { d: StoryData }) {
  const replay = d.inc?.verification?.replay;
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-4">
        {replay ? (
          <>
            <Big tone="ok">
              {replay.passed}/{replay.n} replays passed.
            </Big>
            <p className="max-w-[48ch] text-[14.5px] leading-relaxed text-fg-2">
              Nightly re-ran the exact chats that went wrong on the rolled-back version. Every one now gets the right answer.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: replay.n }, (_, i) => (
                <CheckCircle2 key={i} size={20} className={i < replay.passed ? "text-ok" : "text-alert"} />
              ))}
            </div>
          </>
        ) : (
          <Waiting>Replaying the failed chats on the fixed version…</Waiting>
        )}
        {d.inc?.status === "RESOLVED" && <div className="text-[13px] text-ok">Live chats are back to normal.</div>}
        {d.notes.length > 0 && (
          <p className="text-[14px] leading-relaxed text-fg-2">
            Then it sent <strong className="font-semibold text-fg">one</strong> message to the on-call engineer: what broke, what it did, and an Undo button.
          </p>
        )}
      </div>
      <div className="origin-top scale-[0.82] justify-self-center md:-mb-20">
        <Phone notes={d.notes} clock={d.clock} />
      </div>
    </div>
  );
}

const BODY = [Shipped, Noticed, Cause, Priced, Contained, Proved];

/** The single large "now" panel: only the evidence for one step. */
export default function NowPanel({ step, live, d }: { step: number; live: boolean; d: StoryData }) {
  const Body = BODY[step];
  const s = STEPS[step];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${live ? "bg-fg text-[var(--bg)]" : "bg-card-2 text-muted"}`}>
          {live ? "Now" : `Step ${step + 1}`}
        </span>
        <span className="text-[15px] font-medium text-fg">{s.caption}</span>
        {s.tag && <span className="ml-auto inline-flex items-center rounded-md border border-line px-2 py-1">{s.tag}</span>}
      </div>
      <Body d={d} />
    </div>
  );
}
