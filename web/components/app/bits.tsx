"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type InboxIncident, ago, fmtUsd } from "@/lib/app";
import { cn } from "@/lib/utils";

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A KPI card: label + icon, a big number, and an optional footnote or sparkline. */
export function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: "ok" | "alert" | "amber" | "info";
  children?: ReactNode;
}) {
  const toneCls = { ok: "text-ok", alert: "text-alert", amber: "text-amber", info: "text-info" }[tone ?? "ok"];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="grid size-7 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn("px-5 pt-1.5 text-[28px] leading-tight font-semibold tracking-tight tabular-nums", tone ? toneCls : "text-foreground")}>
        {value}
      </div>
      {hint && <div className="px-5 pt-0.5 text-xs text-muted-foreground">{hint}</div>}
      <div className={cn("mt-auto", children ? "pt-2" : "pb-4")}>{children}</div>
    </Card>
  );
}

/** Coloured status badge: a soft tinted background, a dot and the label. */
export function Tone({
  color,
  children,
  pulse = false,
  className,
}: {
  color: "ok" | "info" | "amber" | "alert" | "grey" | "violet";
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const map = {
    ok: "border-ok/20 bg-ok/10 text-ok",
    info: "border-info/20 bg-info/10 text-info",
    amber: "border-amber/25 bg-amber/10 text-amber",
    alert: "border-alert/25 bg-alert/10 text-alert",
    violet: "border-violet/20 bg-violet/10 text-violet",
    grey: "border-border bg-secondary text-muted-foreground",
  }[color];
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-md font-medium", map, className)}>
      <span className="relative flex size-1.5">
        {pulse && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {children}
    </Badge>
  );
}

const INCIDENT_TONE: Record<string, "ok" | "info" | "amber" | "alert" | "grey" | "violet"> = {
  RESOLVED: "ok",
  MONITORING: "info",
  AWAITING_HUMAN: "amber",
  AWAITING_APPROVAL: "amber",
  INVESTIGATING: "amber",
  MITIGATING: "amber",
  OPEN: "alert",
  ESCALATED: "alert",
  DEFERRED: "grey",
};

export function IncidentStatus({ status }: { status: string }) {
  const open = !["RESOLVED", "DEFERRED", "MONITORING"].includes(status);
  return (
    <Tone color={INCIDENT_TONE[status] ?? "grey"} pulse={open}>
      {status.replaceAll("_", " ").toLowerCase()}
    </Tone>
  );
}

export function Severity({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-muted-foreground">—</span>;
  const s = severity.toLowerCase();
  const tone = s.includes("1") || s === "critical" || s === "high" ? "alert" : s.includes("2") || s === "medium" ? "amber" : "grey";
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md font-mono text-[11px] uppercase",
        tone === "alert" ? "border-alert/30 text-alert" : tone === "amber" ? "border-amber/30 text-amber" : "text-muted-foreground",
      )}
    >
      {severity}
    </Badge>
  );
}

export function AgentStatus({ status, lastSeen }: { status: string; lastSeen: number | null }) {
  const stale = status === "live" && lastSeen != null && Date.now() / 1000 - lastSeen > 300;
  if (status === "live" && !stale) return <Tone color="ok" pulse>live</Tone>;
  if (stale) return <Tone color="amber">silent {ago(lastSeen)}</Tone>;
  if (status === "paused") return <Tone color="grey">paused</Tone>;
  return <Tone color="amber">waiting for first call</Tone>;
}

/** Incidents as a table: status, title, agent, severity, money at risk, when. */
export function IncidentTable({ rows, showAgent = true }: { rows: InboxIncident[]; showAgent?: boolean }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[150px] pl-4">Status</TableHead>
          <TableHead>Incident</TableHead>
          {showAgent && <TableHead className="hidden md:table-cell">Agent</TableHead>}
          <TableHead className="hidden sm:table-cell">Severity</TableHead>
          <TableHead className="text-right">At risk</TableHead>
          <TableHead className="hidden pr-4 text-right sm:table-cell">Opened</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((inc) => {
          const href = `/app/incidents/${inc.agent_id}/${inc.id}`;
          return (
            <TableRow key={`${inc.agent_id}-${inc.id}`} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell className="pl-4">
                <IncidentStatus status={inc.status} />
              </TableCell>
              <TableCell className="max-w-[320px]">
                <Link href={href} className="block truncate font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                  {inc.title ?? "Investigating…"}
                </Link>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {inc.id}
                  {inc.type ? ` · ${inc.type}` : ""}
                </div>
              </TableCell>
              {showAgent && <TableCell className="hidden text-muted-foreground md:table-cell">{inc.agent_name}</TableCell>}
              <TableCell className="hidden sm:table-cell">
                <Severity severity={inc.severity} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {inc.impact?.projected_loss_if_waiting != null ? (
                  <span className="font-medium text-amber">{fmtUsd(inc.impact.projected_loss_if_waiting, 0)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden pr-4 text-right text-muted-foreground sm:table-cell">{ago(inc.opened_at)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Empty state: icon, one line, optional CTA. */
export function Empty({
  icon: Icon = Inbox,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && (
        <Button asChild size="sm" className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

/** A card with a title row (title, description, right-hand action) and flush content. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  flush = false,
  icon: Icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-3.5 [.border-b]:pb-3.5">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon className="size-4 text-muted-foreground" />}
            {title}
          </CardTitle>
          {description && <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn(flush ? "p-0" : "p-5")}>{children}</CardContent>
    </Card>
  );
}

export function ViewAll({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
      <Link href={href}>
        {children} <ArrowUpRight className="size-3" />
      </Link>
    </Button>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-20 bg-secondary" />
          <Skeleton className="h-4 flex-1 bg-secondary" />
          <Skeleton className="h-4 w-16 bg-secondary" />
        </div>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const textareaCls =
  "w-full rounded-md border border-input bg-[var(--code-bg)] p-3 font-mono text-[12.5px] leading-relaxed text-foreground shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-[var(--code-bg)] p-4 font-mono text-[12.5px] leading-relaxed text-foreground/85">
      {children}
    </pre>
  );
}

export function Notice({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", ok ? "border-ok/20 bg-ok/10 text-ok" : "border-alert/25 bg-alert/10 text-alert")}>
      {children}
    </div>
  );
}
