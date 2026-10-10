"use client";

import Link from "next/link";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHead } from "@/components/app/bits";
import IncidentPanel from "@/components/console/IncidentPanel";
import { Card, Label } from "@/components/ui";
import type { IncidentDetail } from "@/lib/api";
import { api, useApi, useStream } from "@/lib/app";

export default function AppIncident({ params }: { params: Promise<{ agent: string; id: string }> }) {
  const { agent, id } = use(params);
  const { data: inc, error, reload } = useApi<IncidentDetail & { agent_name: string }>(`/agents/${agent}/incidents/${id}`, 5000);
  useStream((e) => e.agent_id === agent && reload());
  return (
    <>
      <PageHead
        title={inc?.title ?? id}
        sub={
          inc && (
            <>
              <Link href={`/app/agents/${agent}`} className="underline decoration-white/20">
                {inc.agent_name}
              </Link>{" "}
              · {inc.id} · {inc.type ?? "triage"} · {inc.severity ?? "—"}
            </>
          )
        }
      />
      {error && <p className="text-sm text-alert">Couldn’t load the incident: {error}</p>}
      {inc && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="force-dark h-[760px] overflow-hidden">
            <IncidentPanel
              inc={inc}
              onChange={reload}
              onApprove={(aid) => api(`/agents/${agent}/actions/${aid}/approve`, { method: "POST" })}
              onUndo={(aid) => api(`/agents/${agent}/actions/${aid}/undo`, { method: "POST" })}
            />
          </Card>
          <Card className="h-[760px] overflow-y-auto p-6">
            <Label>postmortem (written by Night Shift)</Label>
            <div className="prose-ns mt-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{inc.postmortem}</ReactMarkdown>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
