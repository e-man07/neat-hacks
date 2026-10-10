"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Controls from "@/components/console/Controls";
import IncidentPanel from "@/components/console/IncidentPanel";
import TrafficFeed from "@/components/console/TrafficFeed";
import ThemeToggle from "@/components/ThemeToggle";
import NightSky from "@/components/NightSky";
import Phone, { type PhoneNote } from "@/components/Phone";
import { Counter, Label, Moon, Pill, Sparkline } from "@/components/ui";
import {
  API,
  clockTime,
  get,
  money,
  usePoll,
  useStream,
  type Conversation,
  type IncidentDetail,
  type IncidentRow,
  type Release,
  type State,
} from "@/lib/api";

type Metrics = { bucket_s: number; series: { t: number; n: number; loss: number; cost: number; failed: number; wrong_refund: number; escalated: number; correct: number }[] };

export default function ConsolePage() {
  const [state, stateErr, reloadState] = usePoll<State>("/api/state", 2000);
  const [metrics] = usePoll<Metrics>("/api/metrics?minutes=20&bucket_s=20", 4000);
  const [releases] = usePoll<Release[]>("/api/releases", 60000);
  const [incidents, , reloadIncidents] = usePoll<IncidentRow[]>("/api/incidents", 3000);
  const [feed, setFeed] = useState<Conversation[]>([]);
  const [inc, setInc] = useState<IncidentDetail | null>(null);

  useEffect(() => {
    get<Conversation[]>("/api/conversations?limit=40").then(setFeed).catch(() => {});
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
      reloadIncidents();
    }
  });

  const series = metrics?.series ?? [];
  const lossSeries = series.map((s) => s.loss);
  const okSeries = series.map((s) => (s.n ? s.correct / s.n : 1));
  const status = state?.open_incident?.status;
  const alert = status && ["OPEN", "INVESTIGATING", "AWAITING_HUMAN", "ESCALATED"].includes(status);
  const mitigating = status && ["MITIGATING", "MONITORING"].includes(status);

  const offset = state?.local_offset_s ?? 0;
  const notes: PhoneNote[] = useMemo(() => {
    if (!inc) return [];
    return inc.events
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
  }, [inc, offset]);

  const recent = feed.slice(0, 20);
  const recentLoss = recent.reduce((a, c) => a + (c.loss_usd || 0), 0);

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <Moon /> night shift
        </Link>
        <span className="font-mono text-[12px] text-white/40">console</span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-light tabular-nums text-white">{state?.local_time ?? "--:--:--"}</span>
          {state?.local_time_simulated && <span className="font-mono text-[10px] text-white/35">simulated local time</span>}
        </div>
        {alert ? (
          <Pill color="var(--alert)" pulse>
            incident · {state?.open_incident?.severity ?? "…"}
          </Pill>
        ) : mitigating ? (
          <Pill color="var(--amber)">mitigated · watching</Pill>
        ) : (
          <Pill color="var(--ok)">all clear</Pill>
        )}
        <div className="font-mono text-[11.5px] text-white/50">
          release <span className="text-white">{state?.release ?? "—"}</span> · model{" "}
          <span className="text-white">{state?.model ?? "—"}</span>
          {state?.flags && state.flags.auto_refund_enabled === false && <span className="text-amber"> · auto-refunds off</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-white/40 lg:ml-auto">
          <span>{state?.brain === "sim" ? "SIM brain (offline)" : "LIVE models"}</span>
          {state?.budget?.available && (
            <span>
              gateway {money(state.budget.spend, 2)} / {money(state.budget.max_budget)}
            </span>
          )}
          <span className={connected ? "text-ok" : "text-alert"}>{connected ? "● stream" : "○ offline"}</span>
          <ThemeToggle />
        </div>
      </header>

      {stateErr && (
        <div className="border-b border-alert/30 bg-alert/10 px-6 py-2 text-[12.5px] text-alert">
          Can’t reach the Night Shift API at {API}. Start it with <code className="font-mono">uv run uvicorn api.server:app</code> in /backend.
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-px bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_340px]">
        {/* Left: money + feed */}
        <section className="flex min-h-[520px] min-w-0 flex-col bg-bg">
          <div className="relative overflow-hidden border-b border-line px-4 py-5">
            <NightSky alert={alert ? 1 : 0} className="opacity-40" />
            <div className="relative">
              <Label>lost in the last {recent.length || 0} conversations</Label>
              <div className={`mt-1 text-[44px] font-light tabular-nums tracking-tight ${recentLoss > 0 ? "text-alert" : "text-white"}`}>
                <Counter value={recentLoss} format={(v) => money(v, 2)} />
              </div>
              <div className="mt-1 font-mono text-[11px] text-white/40">
                all time {money(state?.totals?.loss ?? 0, 0)} lost · {state?.totals?.n ?? 0} conversations · LLM {money(state?.totals?.cost ?? 0, 2)}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-white/35">
                  <span>loss per 20s</span>
                  <span>last 20 min</span>
                </div>
                <Sparkline values={lossSeries} color="var(--alert)" height={50} />
                <div className="mt-2 mb-1 font-mono text-[10px] text-white/35">resolved correctly</div>
                <Sparkline values={okSeries} color="var(--ok)" height={30} fill={false} />
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <TrafficFeed items={feed} offset={offset} />
          </div>
        </section>

        {/* Center: incident */}
        <section className="min-h-[520px] min-w-0 bg-bg">
          <IncidentPanel
            inc={inc}
            offset={offset}
            onChange={() => {
              loadIncident();
              reloadState();
            }}
          />
        </section>

        {/* Right: phone + controls */}
        <aside className="min-w-0 bg-bg">
          <div className="border-b border-line py-5">
            <Phone notes={notes} clock={state?.local_time ?? "03:07"} />
          </div>
          <Controls state={state} releases={releases ?? []} onChange={reloadState} />
        </aside>
      </div>
    </main>
  );
}
