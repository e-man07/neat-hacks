"use client";

import { use } from "react";
import { AlertTriangle } from "lucide-react";
import IncidentView from "@/components/app/IncidentView";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { IncidentDetail } from "@/lib/api";
import { api, useApi, useStream } from "@/lib/app";

export default function AppIncident({ params }: { params: Promise<{ agent: string; id: string }> }) {
  const { agent, id } = use(params);
  const { data: inc, error, reload } = useApi<IncidentDetail & { agent_name: string }>(`/agents/${agent}/incidents/${id}`, 5000);
  useStream((e) => e.agent_id === agent && reload());
  if (error && !inc)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-alert/25 bg-alert/10 px-3 py-2 text-sm text-alert">
        <AlertTriangle className="size-4" /> Couldn’t load the incident: {error}
      </div>
    );
  if (!inc)
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 bg-secondary" />
          <Skeleton className="h-8 w-2/3 bg-secondary" />
          <Skeleton className="h-4 w-1/3 bg-secondary" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <Card className="h-[420px] p-6">
            <Skeleton className="h-full w-full bg-secondary" />
          </Card>
          <Card className="h-[420px] p-6">
            <Skeleton className="h-full w-full bg-secondary" />
          </Card>
        </div>
      </div>
    );
  return (
    <IncidentView
      inc={inc}
      agentId={agent}
      agentName={inc.agent_name}
      onChange={reload}
      onApprove={(aid) => api(`/agents/${agent}/actions/${aid}/approve`, { method: "POST" })}
      onUndo={(aid) => api(`/agents/${agent}/actions/${aid}/undo`, { method: "POST" })}
    />
  );
}
