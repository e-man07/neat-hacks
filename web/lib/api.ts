"use client";

import { useEffect, useRef, useState } from "react";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Conversation = {
  id: string;
  ts: number;
  release: string;
  model: string;
  kind: string;
  message: string;
  reply: string | null;
  error: string | null;
  outcome: string;
  loss_usd: number;
  cost_usd: number;
  steps: number;
  trace_id: string | null;
  latency_ms?: number;
};

export type Impact = {
  loss_per_minute: number;
  human_response_minutes: number;
  projected_loss_if_waiting: number;
  conversations_per_minute: number;
  local_time: string;
  local_time_simulated: boolean;
  observed_loss: number;
  economics_source: string;
  excess_loss_per_conversation: number;
  extra_llm_cost_per_conversation: number;
};

export type IncidentRow = {
  id: string;
  status: string;
  type: string | null;
  severity: string | null;
  title: string | null;
  summary: string | null;
  opened_at: number;
  mitigated_at: number | null;
  resolved_at: number | null;
  impact: Impact | null;
};

export type IncidentEvent = {
  id: number;
  incident_id: string;
  ts: number;
  kind: string;
  title: string;
  detail: Record<string, unknown> | null;
};

export type Provenance = {
  release: string;
  commit: string | null;
  commit_subject: string | null;
  checkpoint_id: string | null;
  session_id: string | null;
  agent: string | null;
  model: string | null;
  coding_prompts: string[];
  coding_agent_note: string | null;
  graph_changes?: string | null;
  entire_url: string | null;
  files_changed: string[];
};

export type Diagnosis = {
  incident_type: string;
  title: string;
  root_cause: string;
  action: string;
  action_params: Record<string, unknown>;
  confidence: number;
  culprit_release: string | null;
  culprit_commit: string | null;
  culprit_checkpoint: string | null;
  coding_prompt: string | null;
  evidence_trace_ids: string[];
  permanent_fix: string | null;
  method: string;
  model: string | null;
  cost_usd: number;
  provenance: Provenance | null;
  nightshift_trace_id?: string | null;
};

export type ActionRow = {
  id: number;
  incident_id: string;
  ts: number;
  kind: string;
  mode: string;
  status: string;
  reason: string | null;
  params: Record<string, unknown>;
};

export type IncidentDetail = IncidentRow & {
  diagnosis: Diagnosis | null;
  verification: {
    replay?: { n: number; passed: number; rate: number; items: Record<string, unknown>[] };
    live_ok?: boolean;
    live_reasons?: string[];
  } | null;
  events: IncidentEvent[];
  actions: ActionRow[];
  postmortem: string;
};

export type Release = {
  id: string;
  title: string;
  description: string;
  tools: string[];
  max_steps: number;
  orders_api: string;
  provenance: Provenance | null;
};

export type State = {
  brain: string;
  local_time: string;
  local_time_simulated: boolean;
  local_offset_s: number;
  release: string;
  release_title: string;
  model: string;
  flags: Record<string, boolean>;
  outage_models: string[];
  traffic: { running: boolean; per_minute: number; attack_share: number };
  nightshift_enabled: boolean;
  open_incident: IncidentRow | null;
  totals: { n: number; loss: number; cost: number };
  budget: { available: boolean; spend?: number; max_budget?: number };
  signals: { name: string; description: string }[];
};

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/** Poll an endpoint. Returns [data, error, reload]. */
export function usePoll<T>(path: string | null, ms = 3000): [T | null, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      get<T>(path)
        .then((d) => {
          if (alive) {
            setData(d);
            setError(null);
          }
        })
        .catch((e) => alive && setError(String(e)));
    load();
    const t = setInterval(load, ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path, ms, n]);
  return [data, error, () => setN((x) => x + 1)];
}

export type StreamEvent = { type: string; ts: number; [k: string]: unknown };

/** Subscribe to the Server-Sent-Events stream. */
export function useStream(onEvent: (e: StreamEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        handler.current(JSON.parse(m.data));
      } catch {
        /* ignore malformed */
      }
    };
    return () => es.close();
  }, []);
  return connected;
}

export const money = (v: number | null | undefined, digits = 0) =>
  `$${(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const short = (s: string | null | undefined, n = 10) => (s ? s.slice(0, n) : "—");

export const neatlogsTraceUrl = (traceId: string) =>
  `https://app.neatlogs.com/traces?search=${encodeURIComponent(traceId)}`;

export const OUTCOME_COLOR: Record<string, string> = {
  correct: "var(--ok)",
  escalated: "var(--info)",
  wrong_refund: "var(--alert)",
  missed_refund: "var(--amber)",
  failed: "var(--alert)",
};

/** Format a unix timestamp on the on-call clock (which may be pinned to a simulated local time). */
export const clockTime = (ts: number, offsetS = 0, seconds = true) =>
  new Date((ts + offsetS) * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: false,
    timeZone: "UTC",
  });
