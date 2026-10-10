"use client";

import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import IncidentPanel from "@/components/console/IncidentPanel";
import PageShell from "@/components/PageShell";
import { Card, Label } from "@/components/ui";
import { usePoll, type IncidentDetail } from "@/lib/api";

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inc, err, reload] = usePoll<IncidentDetail>(`/api/incidents/${id}`, 3000);
  return (
    <PageShell title={inc?.title ?? id} sub={inc ? `${inc.id} · ${inc.type} · ${inc.severity}` : undefined}>
      {err && <p className="text-[13px] text-alert">Couldn’t load {id}: {err}</p>}
      {inc && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="h-[760px] overflow-hidden">
            <IncidentPanel inc={inc} onChange={reload} />
          </Card>
          <Card className="h-[760px] overflow-y-auto p-6">
            <Label>postmortem (written by Night Shift)</Label>
            <div className="prose-ns mt-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{inc.postmortem}</ReactMarkdown>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
