"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SlackMark } from "@/components/Marks";
import type { HeroIncident as Incident } from "./data";
import "./landing.css";

/** One loop of the recorded incident, in 200 ms ticks. */
const LOOP = 80;
const TICK_MS = 200;
const BARS = 46;
const P = { deploy: 12, detect: 22, cause: 29, price: 35, rollback: 41, verify: 48, slack: 55 } as const;
/** First paint is mid-story (cause found), so the server-rendered frame already tells it. */
const START = LOOP * 4 + P.cause + 1;

/** Deterministic noise so the server and client render the same first frame. */
function noise(i: number, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type BarTone = "ok" | "bad" | "fixed";

function bar(idx: number): { h: number; tone: BarTone } {
  const p = ((idx % LOOP) + LOOP) % LOOP;
  const h = 34 + noise(idx) * 46 + (p >= P.deploy && p < P.rollback ? 10 : 0);
  if (p >= P.deploy && p < P.rollback) return { h, tone: noise(idx, 1) < 0.55 ? "bad" : "ok" };
  if (p >= P.rollback && p < LOOP - 6) return { h, tone: "fixed" };
  return { h, tone: "ok" };
}

const TONE: Record<BarTone, string> = { ok: "rgba(17,17,17,0.18)", bad: "var(--alert)", fixed: "var(--ok)" };

/** The hero: a live, looping replay of a real benchmark incident on the Harbor agent. */
export default function HeroIncident({ inc }: { inc: Incident }) {
  const [t, setT] = useState(START);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(LOOP * 4 + P.slack + 4);
      return;
    }
    const id = setInterval(() => setT((x) => x + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const p = t % LOOP;
  const bad = p >= P.deploy && p < P.rollback;
  const status =
    p < P.deploy
      ? { label: "healthy", tone: "var(--ok)" }
      : p < P.detect
        ? { label: "200 OK · wrong answers", tone: "var(--alert)" }
        : p < P.rollback
          ? { label: "Nightly investigating", tone: "var(--amber)" }
          : { label: "recovered", tone: "var(--ok)" };
  const deployAt = BARS - 1 - (p - P.deploy);
  const correct = p < P.deploy ? inc.correctBefore : bad ? inc.correctDuring : inc.correctAfter;

  const steps: { at: number; icon: ReactNode; label: string; body: ReactNode }[] = [
    { at: P.deploy, icon: <Dot c="var(--fg)" />, label: "03:07", body: <>Release {inc.release} ships. Every request still returns 200.</> },
    { at: P.detect, icon: <Dot c="var(--alert)" />, label: "detected", body: <>{inc.detect} <span className="text-faint">· neatlogs</span></> },
    {
      at: P.cause,
      icon: <Dot c="var(--amber)" />,
      label: "cause",
      body: (
        <>
          commit <Code>{inc.commit}</Code> ← Entire checkpoint ← prompt “{inc.prompt}”
        </>
      ),
    },
    { at: P.price, icon: <Dot c="var(--amber)" />, label: "priced", body: <>{inc.lossPerMin}/min · {inc.atRisk} at risk <span className="text-faint">· cfo.ai</span></> },
    { at: P.rollback, icon: <Dot c="var(--ok)" />, label: "contained", body: <>Rolled back {inc.release} → {inc.previous}, {inc.secondsToContain} s after detection</> },
    { at: P.verify, icon: <Dot c="var(--ok)" />, label: "verified", body: <>Replayed the failed runs: {inc.replay} pass</> },
  ];

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-12px_rgba(17,17,17,0.18)]">
        {/* window bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-muted">
            <span className="flex gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#e5e4df]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#e5e4df]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#e5e4df]" />
            </span>
            <span className="truncate">harbor · production</span>
          </div>
          <span
            className="lp-step inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11.5px]"
            style={{ color: status.tone, borderColor: "currentColor" }}
          >
            <span className="lp-ping h-1.5 w-1.5 rounded-full" style={{ background: status.tone }} />
            {status.label}
          </span>
        </div>

        {/* traffic */}
        <div className="px-4 pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-faint">Correct answers</div>
              <div className="mt-0.5 text-[26px] leading-none tracking-tight tabular-nums" style={{ color: bad ? "var(--alert)" : "var(--fg)" }}>
                {correct}%
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] uppercase tracking-wider text-faint">HTTP 200</div>
              <div className="mt-0.5 text-[26px] leading-none tracking-tight text-fg tabular-nums">100%</div>
            </div>
          </div>
          <div className="relative mt-3 flex h-[92px] items-end gap-[3px]" aria-hidden>
            {Array.from({ length: BARS }, (_, k) => {
              const b = bar(t - (BARS - 1 - k));
              return <span key={k} className="lp-bar flex-1 rounded-[2px]" style={{ height: `${b.h}%`, background: TONE[b.tone] }} />;
            })}
            {deployAt >= 0 && deployAt < BARS && (
              <span className="pointer-events-none absolute inset-y-0" style={{ left: `${(deployAt / BARS) * 100}%` }}>
                <span className="absolute inset-y-0 w-px border-l border-dashed border-fg/40" />
                <span className="absolute -top-1 left-1.5 whitespace-nowrap rounded bg-[#111] px-1.5 py-0.5 font-mono text-[10px]" style={{ color: "#fff" }}>
                  {inc.release} deployed
                </span>
              </span>
            )}
          </div>
        </div>

        {/* what Nightly did */}
        <ol className="mt-4 border-t border-line px-2 py-2">
          {steps.map((s) => {
            const on = p >= s.at;
            const now = on && (steps.find((x) => x.at > s.at)?.at ?? P.slack) > p;
            return (
              <li
                key={s.label}
                className="lp-step grid grid-cols-[18px_74px_1fr] items-center gap-2 rounded-lg px-2 py-[7px] text-[13px] leading-snug"
                style={{ opacity: on ? 1 : 0.32, background: now ? "var(--card-2)" : "transparent" }}
              >
                <span className="flex w-[18px] justify-center overflow-hidden">{on ? s.icon : <Dot c="var(--faint)" />}</span>
                <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{s.label}</span>
                <span className="line-clamp-1 min-w-0 text-fg-2">{s.body}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* the one Slack message */}
      {p >= P.slack && (
        <div
          key={Math.floor(t / LOOP)}
          className="lp-pop absolute -bottom-6 left-3 right-3 rounded-xl border border-line-strong bg-card p-3.5 shadow-[0_20px_50px_-10px_rgba(17,17,17,0.3)] sm:-right-6 sm:left-auto sm:w-[360px]"
          style={{ color: "#1d1c1d" }}
          role="status"
        >
          <div className="flex items-center gap-2 text-[12px] text-[#616061]">
            <SlackMark size={14} /> <b className="text-[#1d1c1d]">Nightly</b> · #incidents · 3:08 AM
          </div>
          <div className="mt-1.5 text-[14px] font-semibold leading-snug">✅ Handled — {inc.atRisk} prevented</div>
          <div className="mt-0.5 text-[12.5px] text-[#616061]">Fix PR waiting for your approval.</div>
          <div className="mt-2.5 flex gap-2">
            <span className="rounded-md bg-[#007a5a] px-2.5 py-1 text-[12px] font-bold" style={{ color: "#fff" }}>
              Approve fix
            </span>
            <span className="rounded-md border border-[#e01e5a] px-2.5 py-1 text-[12px] font-bold text-[#e01e5a]">Undo</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="h-2 w-2 rounded-full" style={{ background: c }} />;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-chip px-1 font-mono text-[11.5px] text-fg">{children}</code>;
}
