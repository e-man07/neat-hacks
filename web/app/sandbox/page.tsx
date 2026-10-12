"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, ChevronDown, Clock, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Controls from "@/components/console/Controls";
import IncidentPanel from "@/components/console/IncidentPanel";
import Nav from "@/components/Nav";
import { type PhoneNote } from "@/components/Phone";
import ChatFeed from "@/components/sandbox/ChatFeed";
import NowPanel, { type StoryData } from "@/components/sandbox/NowPanel";
import Stepper, { STEPS } from "@/components/sandbox/Stepper";
import { duration } from "@/components/sandbox/text";
import {
  API,
  clockTime,
  get,
  money,
  post,
  usePoll,
  useStream,
  type Conversation,
  type IncidentDetail,
  type IncidentRow,
  type Release,
  type State,
} from "@/lib/api";

const BAD_RELEASE = "r46";
/** Minimum time each step stays on screen, so a fast run still reads as a story. */
const DWELL_MS = 4500;
const OPEN = ["OPEN", "INVESTIGATING", "MITIGATING", "MONITORING", "AWAITING_HUMAN", "ESCALATED"];

/** Highest story step the real incident has reached (0..5), and whether the story is over. */
function progress(inc: IncidentDetail | null, nowS: number): { reached: number; finished: boolean } {
  if (!inc) return { reached: 0, finished: false };
  const kinds = new Set(inc.events.map((e) => e.kind));
  const st = inc.status;
  let reached = 1; // an incident exists: Nightly noticed
  if (inc.diagnosis || kinds.has("diagnosis")) reached = 2;
  if (inc.impact || kinds.has("impact")) reached = 3;
  if (kinds.has("decide") || kinds.has("act") || kinds.has("defer") || inc.mitigated_at || !["OPEN", "INVESTIGATING"].includes(st)) reached = 4;
  if (kinds.has("verify") || kinds.has("page") || st === "RESOLVED" || inc.resolved_at) reached = 5;
  const lastTs = Math.max(inc.opened_at, ...inc.events.map((e) => e.ts));
  const finished =
    reached === 5 && (kinds.has("page") || st === "RESOLVED" || !!inc.resolved_at || nowS - lastTs > 45);
  // Never get stuck: a quiet incident past containment is treated as finished.
  if (reached === 4 && nowS - lastTs > 60) return { reached: 5, finished: true };
  return { reached, finished };
}

export default function SandboxPage() {
  const reduce = useReducedMotion();
  const [state, stateErr, reloadState] = usePoll<State>("/api/state", 2000);
  const [releases] = usePoll<Release[]>("/api/releases", 60000);
  const [incidents, , reloadIncidents] = usePoll<IncidentRow[]>("/api/incidents", 3000);
  const [feed, setFeed] = useState<Conversation[]>([]);
  const [inc, setInc] = useState<IncidentDetail | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  const [shown, setShown] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const lastAdvance = useRef(0);

  useEffect(() => {
    get<Conversation[]>("/api/conversations?limit=40").then(setFeed).catch(() => {});
    const t = setInterval(() => setNowS(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, []);

  const currentId = state?.open_incident?.id ?? incidents?.[0]?.id ?? null;
  const loadIncident = useCallback(() => {
    if (!currentId) {
      setInc(null);
      return;
    }
    get<IncidentDetail>(`/api/incidents/${currentId}`).then(setInc).catch(() => {});
  }, [currentId]);
  useEffect(() => {
    loadIncident();
    const t = setInterval(loadIncident, 2000);
    return () => clearInterval(t);
  }, [loadIncident]);

  const connected = useStream((e) => {
    if (e.type === "conversation") {
      setFeed((f) => [e.conversation as Conversation, ...f].slice(0, 60));
    } else if (e.type === "incident_event" || e.type === "incident_update") {
      loadIncident();
      reloadIncidents();
    } else if (e.type === "reset") {
      setFeed([]);
      setInc(null);
      setStartedAt(null);
      reloadIncidents();
    }
  });

  // The incident this story is about: one opened since this run started, or one still open on load.
  const cur = useMemo(() => {
    if (!inc) return null;
    if (startedAt) return inc.opened_at >= startedAt - 30 ? inc : null;
    return OPEN.includes(inc.status) ? inc : null;
  }, [inc, startedAt]);

  const active = startedAt !== null || cur !== null;
  const { reached, finished } = progress(cur, nowS);

  // Reveal steps one at a time, at most one per DWELL_MS, following the real event stream.
  const runKey = `${startedAt ?? ""}:${cur?.id ?? ""}`;
  const prevKey = useRef(runKey);
  useEffect(() => {
    if (prevKey.current !== runKey) {
      const sameRun = prevKey.current.split(":")[0] === runKey.split(":")[0] && startedAt !== null;
      prevKey.current = runKey;
      if (!sameRun) {
        setShown(0);
        setPinned(null);
        setShowFull(false);
        lastAdvance.current = Date.now();
        return;
      }
    }
    if (shown < reached && Date.now() - lastAdvance.current >= DWELL_MS) {
      setShown((s) => Math.min(reached, s + 1));
      lastAdvance.current = Date.now();
    }
  }, [runKey, reached, shown, nowS, startedAt]);

  const done = active && finished && shown >= 5;
  const live = active && !done;
  const viewing = pinned ?? shown;

  // Chats since the bad change shipped, and the money they lost.
  const shipTs = startedAt ?? (cur ? cur.opened_at - 60 : null);
  const since = useMemo(() => (shipTs ? feed.filter((c) => c.ts >= shipTs - 2) : []), [feed, shipTs]);
  const lost = since.reduce((a, c) => a + (c.loss_usd || 0), 0);
  const contained = !!cur?.mitigated_at || !!cur?.events.some((e) => e.kind === "act");

  const offset = state?.local_offset_s ?? 0;
  const notes: PhoneNote[] = useMemo(() => {
    if (!cur) return [];
    return cur.events
      .filter((e) => e.kind === "page" && e.detail && (e.detail as Record<string, unknown>).body)
      .reverse()
      .map((e) => {
        const d = e.detail as Record<string, string>;
        return {
          title: d.title,
          body: d.body,
          time: clockTime(e.ts, offset, false),
          tone: d.title.startsWith("✅") ? "ok" : d.title.startsWith("🌙") ? "low" : "alert",
        } as PhoneNote;
      });
  }, [cur, offset]);

  const story: StoryData = {
    inc: cur,
    release: releases?.find((r) => r.id === BAD_RELEASE) ?? null,
    since,
    lost,
    notes,
    clock: state?.local_time ?? "03:07",
  };

  const start = async () => {
    setBusy(true);
    try {
      await post("/api/traffic", { running: true, per_minute: 24 });
      await post("/api/demo/deploy", { release: BAD_RELEASE });
      setStartedAt(Date.now() / 1000);
    } catch {
      /* post() already explains sign-in */
    } finally {
      setBusy(false);
      reloadState();
      reloadIncidents();
    }
  };

  // Summary numbers for a finished run (this one, or the last one on record).
  const summaryOf = (i: IncidentDetail | null, from: number | null) => {
    if (!i) return null;
    const page = i.events.find((e) => e.kind === "page");
    const end = page?.ts ?? i.mitigated_at ?? i.resolved_at ?? null;
    const begin = from ?? i.opened_at;
    const im = i.impact;
    return {
      took: end ? duration(end - begin) : null,
      prevented: im && i.mitigated_at ? Math.max(0, im.projected_loss_if_waiting - im.observed_loss) : null,
      pending: i.actions.filter((a) => a.status === "proposed").length,
      contained: !!i.mitigated_at,
    };
  };
  const last = !active && inc && incidents?.[0]?.id === inc.id ? inc : null;
  const sum = summaryOf(done ? cur : last, done ? startedAt : null);

  const fade = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: undefined }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } };

  const elapsed = startedAt ? duration(nowS - startedAt) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-bg pb-16">
      <Nav />
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        {stateErr && (
          <div className="mt-4 rounded-xl border border-alert/30 bg-alert/[0.06] px-4 py-2.5 text-[13px] text-alert">
            Can’t reach the Nightly API at {API}. Start it with <code className="font-mono">uv run uvicorn api.server:app</code> in /backend.
          </div>
        )}

        {/* Headline + the one button */}
        <section className="flex flex-col gap-5 pt-8 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-12">
          <div className="min-w-0">
            <h1 className="text-[30px] leading-[1.1] font-semibold tracking-tight text-fg sm:text-[40px]">Watch Nightly handle a 3 AM incident</h1>
            <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-muted">
              Harbor is a live refund-support bot. We’ll ship a bad change to it, then watch Nightly catch it, explain it, fix it and prove the fix. No sign-up.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={start}
              disabled={busy || (active && !done)}
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-5 py-3 text-[15px] font-medium text-[var(--bg)] shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {done ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}
              {busy ? "Starting…" : done ? "Run it again" : active ? "Running…" : "Start the incident"}
            </button>
            <span className="inline-flex items-center gap-1 text-[13px] text-muted">
              <Clock size={14} /> {active && !done && elapsed ? elapsed : "~2 min"}
            </span>
          </div>
        </section>

        {/* Progress */}
        <section className="rounded-2xl border border-line bg-card px-3 py-4 sm:px-6 sm:py-5">
          <Stepper
            reached={active ? shown : -1}
            viewing={viewing}
            live={live}
            onSelect={(i) => setPinned(i === shown ? null : i)}
          />
        </section>

        {/* Now + chats */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-2xl border border-line bg-card p-5 sm:p-7">
            {active ? (
              <>
                <motion.div key={viewing} initial={fade.initial} animate={fade.animate} transition={fade.transition}>
                  <NowPanel step={viewing} live={live && viewing === shown} d={story} />
                </motion.div>
                {pinned !== null && pinned !== shown && (
                  <button
                    type="button"
                    onClick={() => setPinned(null)}
                    className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg underline-offset-4 hover:underline"
                  >
                    Back to {done ? "the end" : "what’s happening now"} <ArrowRight size={14} />
                  </button>
                )}
              </>
            ) : (
              <Idle last={last} sum={sum} onStart={start} busy={busy} />
            )}
          </div>
          <ChatFeed
            items={feed.slice(0, 25)}
            lost={active ? lost : 0}
            lostLabel={!active ? "Lost to bad answers" : contained && shown >= 4 ? "Lost before the rollback" : "Lost so far"}
            running={!!state?.traffic.running}
          />
        </section>

        {/* Done summary */}
        <AnimatePresence>
          {done && sum && (
            <motion.section {...fade} className="mt-4 rounded-2xl border border-ok/30 bg-ok/[0.05] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[16px] text-fg sm:text-[18px]">
                <CheckCircle2 className="shrink-0 text-ok" size={22} />
                {sum.took && (
                  <span>
                    Handled in <strong className="font-semibold">{sum.took}</strong>
                  </span>
                )}
                {sum.prevented != null && (
                  <span>
                    · <strong className="font-semibold">{money(sum.prevented)}</strong> prevented
                  </span>
                )}
                {sum.pending > 0 && <span className="text-muted">· the permanent fix awaits your approval</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowFull((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-card px-4 py-2 text-[14px] font-medium text-fg transition hover:bg-card-2"
                >
                  {showFull ? "Hide the full incident" : "See the full incident"} <ChevronDown size={15} className={showFull ? "rotate-180" : ""} />
                </button>
                {cur && (
                  <Link href={`/incidents/${cur.id}`} className="inline-flex items-center gap-1 px-2 py-2 text-[14px] text-muted hover:text-fg">
                    Open the postmortem <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        {done && showFull && cur && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
            <IncidentPanel inc={cur} offset={offset} onChange={loadIncident} />
          </section>
        )}

        {/* Advanced */}
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            aria-expanded={advanced}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition hover:text-fg"
          >
            Advanced controls <ChevronDown size={15} className={`transition-transform ${advanced ? "rotate-180" : ""}`} />
          </button>
          {advanced && (
            <div className="mt-3 rounded-2xl border border-line bg-card">
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-4 py-3 font-mono text-[11.5px] text-muted">
                <span>
                  on-call clock <span className="text-fg">{state?.local_time ?? "--:--:--"}</span>
                  {state?.local_time_simulated ? " (simulated)" : ""}
                </span>
                <span>
                  release <span className="text-fg">{state?.release ?? "—"}</span> “{state?.release_title ?? ""}”
                </span>
                <span>
                  model <span className="text-fg">{state?.model ?? "—"}</span>
                </span>
                <span>{state?.brain === "sim" ? "simulated brain (offline)" : "live models"}</span>
                {state?.budget?.available && (
                  <span>
                    gateway {money(state.budget.spend, 2)} / {money(state.budget.max_budget)}
                  </span>
                )}
                <span>
                  all time {money(state?.totals?.loss ?? 0, 0)} lost · {state?.totals?.n ?? 0} chats · model cost {money(state?.totals?.cost ?? 0, 2)}
                </span>
                {state?.flags && state.flags.auto_refund_enabled === false && <span className="text-amber">auto-refunds off</span>}
                <span className={connected ? "text-ok" : "text-alert"}>{connected ? "● stream connected" : "○ stream offline"}</span>
              </div>
              <Controls
                state={state}
                releases={releases ?? []}
                onChange={() => {
                  reloadState();
                  reloadIncidents();
                }}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Idle({
  last,
  sum,
  onStart,
  busy,
}: {
  last: IncidentDetail | null;
  sum: { took: string | null; prevented: number | null; pending: number; contained: boolean } | null;
  onStart: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[12px] font-medium tracking-wide text-muted uppercase">What you’ll see</div>
        <ol className="mt-3 space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3 text-[14.5px] text-fg-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] text-muted">{i + 1}</span>
              <span className="flex-1">{s.caption}</span>
            </li>
          ))}
        </ol>
      </div>
      {last && sum && (
        <div className="rounded-xl border border-line bg-card-2 p-4">
          <div className="text-[12px] font-medium tracking-wide text-muted uppercase">Last run</div>
          <div className="mt-1 text-[15px] font-medium text-fg">{last.title ?? last.id}</div>
          <div className="mt-1 text-[13.5px] text-muted">
            {sum.contained ? "Contained automatically" : last.status.toLowerCase().replace("_", " ")}
            {sum.prevented != null ? ` · ${money(sum.prevented)} prevented` : ""}
            {sum.pending > 0 ? " · fix awaits approval" : ""}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-fg px-3.5 py-2 text-[13.5px] font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Run it again
            </button>
            <Link href={`/incidents/${last.id}`} className="inline-flex items-center gap-1 px-1 py-2 text-[13.5px] text-muted hover:text-fg">
              See the full incident <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
