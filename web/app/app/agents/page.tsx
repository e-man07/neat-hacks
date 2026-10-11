"use client";

import Link from "next/link";
import { AgentStatus, Empty, PageHead } from "@/components/app/bits";
import { Card, PrimaryLink } from "@/components/ui";
import { type OverviewAgent, ago, fmtUsd, useApi } from "@/lib/app";

export default function AgentsPage() {
  const { data } = useApi<{ agents: OverviewAgent[] }>("/overview", 15000);
  const agents = data?.agents ?? [];
  return (
    <>
      <PageHead title="Agents" sub="Production agents Nightly is on call for." actions={<PrimaryLink href="/app/agents/new">Connect an agent</PrimaryLink>} />
      {data && agents.length === 0 ? (
        <Empty>No agents connected yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="px-4 py-2.5 font-normal">agent</th>
                <th className="px-4 py-2.5 font-normal">status</th>
                <th className="px-4 py-2.5 font-normal">release</th>
                <th className="px-4 py-2.5 font-normal">runs 24h</th>
                <th className="px-4 py-2.5 font-normal">loss 24h</th>
                <th className="px-4 py-2.5 font-normal">last seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/app/agents/${a.id}`} className="font-medium text-white hover:underline">
                      {a.name}
                    </Link>
                    <div className="font-mono text-[11px] text-faint">{a.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AgentStatus status={a.status} lastSeen={a.last_seen_at} />
                  </td>
                  <td className="px-4 py-3 font-mono text-fg-2">{a.release ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-fg-2">{a.runs_24h}</td>
                  <td className="px-4 py-3 tabular-nums text-fg-2">{fmtUsd(a.loss_24h)}</td>
                  <td className="px-4 py-3 text-muted">{ago(a.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
