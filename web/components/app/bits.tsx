"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui";
import { STATUS_COLOR, type InboxIncident, ago, fmtUsd } from "@/lib/app";

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tabular-nums" style={{ color: tone ?? "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}

export function AgentStatus({ status, lastSeen }: { status: string; lastSeen: number | null }) {
  const stale = status === "live" && lastSeen != null && Date.now() / 1000 - lastSeen > 300;
  if (status === "live" && !stale) return <Pill color="var(--ok)">live</Pill>;
  if (stale) return <Pill color="var(--amber)">silent {ago(lastSeen)}</Pill>;
  if (status === "paused") return <Pill color="var(--muted)">paused</Pill>;
  return <Pill color="var(--amber)">waiting for first call</Pill>;
}

export function IncidentRow({ inc }: { inc: InboxIncident }) {
  const color = STATUS_COLOR[inc.status] ?? "var(--muted)";
  const open = !["RESOLVED", "DEFERRED"].includes(inc.status);
  return (
    <Link
      href={`/app/incidents/${inc.agent_id}/${inc.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 transition last:border-0 hover:bg-white/[0.03]"
    >
      <Pill color={color} pulse={open && inc.status !== "MONITORING"}>
        {inc.status.replaceAll("_", " ").toLowerCase()}
      </Pill>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-fg">{inc.title ?? "Investigating…"}</div>
        <div className="mt-0.5 font-mono text-[11px] text-faint">
          {inc.agent_name} · {inc.id} · {ago(inc.opened_at)}
        </div>
      </div>
      {inc.impact?.projected_loss_if_waiting != null && (
        <div className="text-right">
          <div className="text-sm tabular-nums text-amber">{fmtUsd(inc.impact.projected_loss_if_waiting, 0)}</div>
          <div className="font-mono text-[10px] text-faint">at risk if it waited</div>
        </div>
      )}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-fg-2">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-line-strong bg-white/[0.03] px-3 py-2 text-sm text-fg outline-none transition placeholder:text-faint focus:border-white/40";

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-[var(--code-bg)] p-4 font-mono text-[12.5px] leading-relaxed text-fg-2">
      {children}
    </pre>
  );
}
