"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { AgentStatus, Empty, PageHead, TableSkeleton } from "@/components/app/bits";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type OverviewAgent, ago, fmtUsd, useApi } from "@/lib/app";

export default function AgentsPage() {
  const router = useRouter();
  const { data } = useApi<{ agents: OverviewAgent[] }>("/overview", 15000);
  const agents = data?.agents ?? [];
  return (
    <>
      <PageHead title="Agents" sub="Production agents Nightly is on call for." />
      {data && agents.length === 0 ? (
        <Empty icon={Bot} title="No agents connected yet" action={{ href: "/app/agents/new", label: "Connect an agent" }}>
          Add the SDK to your agent and Nightly starts watching its runs.
        </Empty>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {!data ? (
            <TableSkeleton />
          ) : (
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="pl-5">Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Release</TableHead>
                  <TableHead className="text-right">Runs 24h</TableHead>
                  <TableHead className="text-right">Loss 24h</TableHead>
                  <TableHead className="text-right">Prevented</TableHead>
                  <TableHead className="pr-5 text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/app/agents/${a.id}`)}>
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
                          <Bot className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`/app/agents/${a.id}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                            {a.name}
                          </Link>
                          <div className="font-mono text-[11px] text-muted-foreground">{a.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
                      {a.open_incident && <div className="mt-1 max-w-[200px] truncate text-xs text-alert">● {a.open_incident.title ?? "incident open"}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.release ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.runs_24h.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(a.loss_24h)}</TableCell>
                    <TableCell className="text-right tabular-nums text-ok">{fmtUsd(a.loss_prevented, 0)}</TableCell>
                    <TableCell className="pr-5 text-right text-muted-foreground">{ago(a.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
