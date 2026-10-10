"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "./api";

export type NsUser = { login: string; name: string | null; avatar: string | null };
type TokenState = { token: string | null; dev: boolean; user: NsUser; exp: number };

let cached: TokenState | null = null;
let inflight: Promise<TokenState> | null = null;

/** The signed-in user's API token, minted by the web app (null in local dev mode). */
export async function nsToken(): Promise<TokenState> {
  if (cached && cached.exp - Date.now() > 60_000) return cached;
  if (!inflight) {
    inflight = fetch("/api/ns-token", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
          throw new Error("sign in required");
        }
        const j = await r.json();
        cached = { token: j.token, dev: j.dev, user: j.user, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { token } = await nsToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API}/api/app${path}`, { ...init, headers, body, cache: "no-store" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, (data && (data.detail || data.error)) || res.statusText);
  return data as T;
}

/** GET an endpoint, refetch on an interval and whenever the live stream says something changed. */
export function useApi<T>(path: string | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
    if (!refreshMs) return;
    const t = setInterval(reload, refreshMs);
    return () => clearInterval(t);
  }, [reload, refreshMs]);
  return { data, error, loading, reload, setData };
}

export type StreamEvent = { type: string; agent_id?: string; incident_id?: string; [k: string]: unknown };

/** Workspace event stream (SSE). */
export function useStream(onEvent: (e: StreamEvent) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    nsToken().then(({ token }) => {
      if (closed) return;
      es = new EventSource(`${API}/api/app/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      es.onmessage = (m) => {
        try {
          cb.current(JSON.parse(m.data));
        } catch {}
      };
    });
    return () => {
      closed = true;
      es?.close();
    };
  }, []);
}

export function useMe() {
  const [user, setUser] = useState<TokenState | null>(cached);
  useEffect(() => {
    nsToken().then(setUser).catch(() => {});
  }, []);
  return user;
}

// -- types ------------------------------------------------------------------------------------------------
export type Economics = {
  runs_per_hour: { day: number; night: number };
  cost_per_failed_run_usd: number;
  human_response_minutes: { business_hours: number; evening: number; night: number };
  source?: string;
};

export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  kind: string;
  status: "pending" | "live" | "paused";
  workflow_name: string | null;
  root_span_name: string | null;
  repo: string | null;
  repo_dir?: string | null;
  has_neatlogs_key?: boolean | number;
  neatlogs_project_name?: string | null;
  token_prefix: string | null;
  economics: Economics | null;
  created_at: number;
  last_seen_at: number | null;
};

export type InboxIncident = {
  id: string;
  status: string;
  type: string | null;
  severity: string | null;
  title: string | null;
  summary: string | null;
  opened_at: number;
  mitigated_at: number | null;
  resolved_at: number | null;
  impact: { projected_loss_if_waiting?: number; loss_per_minute?: number } | null;
  agent_id: string;
  agent_name: string;
};

export type OverviewAgent = Agent & {
  runs_24h: number;
  loss_24h: number;
  llm_cost_24h: number;
  release: string | null;
  open_incident: InboxIncident | null;
  incidents_handled: number;
  loss_prevented: number;
};

export type Trace = {
  id: string;
  ts: number;
  release: string;
  model: string;
  message: string;
  reply: string | null;
  error: string | null;
  outcome: string;
  loss_usd: number;
  cost_usd: number;
  steps: number;
  tool_errors: number;
  tokens: number;
  trace_id: string | null;
  latency_ms: number;
};

export const fmtUsd = (v: number | null | undefined, digits = 2) =>
  `$${(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function ago(ts: number | null | undefined): string {
  if (!ts) return "never";
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const STATUS_COLOR: Record<string, string> = {
  OPEN: "var(--alert)",
  INVESTIGATING: "var(--amber)",
  MITIGATING: "var(--amber)",
  AWAITING_APPROVAL: "var(--violet)",
  ESCALATED: "var(--alert)",
  MONITORING: "var(--info)",
  RESOLVED: "var(--ok)",
  DEFERRED: "var(--muted)",
};
