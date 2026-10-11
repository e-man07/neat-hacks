"use client";

import { useEffect, useState } from "react";
import { money, post, type IncidentDetail, type State } from "@/lib/api";
import { Button } from "../ui";

const BAD_RELEASE = "r46";

type Step = { title: string; body: string; tool?: string; done: boolean };

/** One-click guided run of the 3 AM incident, with each step lighting up as Nightly works. */
export default function Guide({ state, inc, onChange }: { state: State | null; inc: IncidentDetail | null; onChange: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, []);

  // The incident this run is about: one opened since the run started (or in the last 15 minutes).
  const since = (startedAt ?? now - 15 * 60) - 30;
  const cur = inc && inc.opened_at >= since ? inc : null;
  const kinds = new Set(cur?.events.map((e) => e.kind) ?? []);
  const shipped = state?.release === BAD_RELEASE || !!cur;

  const steps: Step[] = [
    { title: "Customers are talking to the agent", body: "Harbor, a refunds support agent, answers real-looking tickets.", done: !!state?.traffic.running },
    {
      title: "A coding agent ships a bad release",
      body: "r46 “One-step refunds”, written by a Claude Code session. Every request still returns 200.",
      tool: "Entire",
      done: shipped,
    },
    { title: "Nightly notices", body: "Wrong refunds show up in the agent’s traces and outcomes.", tool: "neatlogs", done: kinds.has("detect") },
    {
      title: "It finds the cause",
      body: "Traces → deploy → commit → the Entire checkpoint and the prompt behind it.",
      tool: "Entire",
      done: !!cur?.diagnosis,
    },
    {
      title: "It prices the damage and contains it",
      body: "$/min from your unit economics; your policy allows a one-step rollback.",
      tool: "cfo.ai",
      done: kinds.has("act"),
    },
    {
      title: "It proves the fix and pages you once",
      body: "Replays the failed tickets through the agent, then one Slack message with Undo.",
      tool: "Slack",
      done: kinds.has("verify") && kinds.has("page"),
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  const allDone = next === -1;

  // Money lost from detection until containment, ticking live.
  const rate = cur?.impact?.loss_per_minute ?? 0;
  const end = cur?.mitigated_at ?? cur?.resolved_at ?? now;
  const lost = cur && rate ? (Math.max(0, end - cur.opened_at) / 60) * rate : 0;
  const contained = !!cur?.mitigated_at || kinds.has("act");

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
      onChange();
    }
  };

  return (
    <div className="border-b border-line px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-white">Watch Nightly handle a 3 AM incident</div>
          <div className="text-[12.5px] text-white/50">
            One click ships a bad release to a live agent. Takes about 2 minutes, with real models.
          </div>
        </div>
        {cur && rate > 0 && (
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              {contained ? "lost before Nightly contained it" : "money lost so far"}
            </div>
            <div className={`font-mono text-[22px] tabular-nums ${contained ? "text-amber" : "text-alert"}`}>{money(lost, 2)}</div>
            <div className="font-mono text-[10.5px] text-white/35">{money(rate, 2)}/min at risk</div>
          </div>
        )}
        <Button tone="primary" disabled={busy || (shipped && !allDone && !!startedAt)} onClick={start}>
          {busy ? "Starting…" : allDone ? "Run it again" : startedAt ? "Running…" : "Start the 3 AM incident"}
        </Button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((s, i) => {
          const active = i === next && (startedAt !== null || shipped);
          return (
            <li
              key={s.title}
              className={`rounded-lg border p-2.5 transition ${
                s.done ? "border-ok/40 bg-ok/[0.06]" : active ? "border-amber/50 bg-amber/[0.06]" : "border-line bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                <span className={s.done ? "text-ok" : active ? "text-amber" : "text-white/35"}>
                  {s.done ? "✓" : active ? "●" : i + 1}
                </span>
                {s.tool && <span className="text-white/40">{s.tool}</span>}
              </div>
              <div className={`mt-1 text-[12.5px] font-medium ${s.done || active ? "text-white" : "text-white/55"}`}>{s.title}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-white/45">{s.body}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
