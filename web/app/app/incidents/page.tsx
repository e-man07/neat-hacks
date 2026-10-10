"use client";

import { useState } from "react";
import { Empty, IncidentRow, PageHead } from "@/components/app/bits";
import { Card } from "@/components/ui";
import { type InboxIncident, useApi, useStream } from "@/lib/app";

const FILTERS = ["all", "open", "needs approval", "resolved"] as const;

export default function IncidentsPage() {
  const { data, reload } = useApi<InboxIncident[]>("/incidents", 10000);
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  useStream((e) => e.type.startsWith("incident") && reload());
  const rows = (data ?? []).filter((i) =>
    f === "all"
      ? true
      : f === "open"
        ? !["RESOLVED", "DEFERRED"].includes(i.status)
        : f === "needs approval"
          ? ["AWAITING_APPROVAL", "ESCALATED"].includes(i.status)
          : i.status === "RESOLVED",
  );
  return (
    <>
      <PageHead title="Incidents" sub="Every incident across your agents, with the investigation, actions and postmortem." />
      <div className="mb-3 flex gap-1.5">
        {FILTERS.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={`rounded-full border px-3 py-1 text-xs transition ${f === x ? "border-white/60 text-fg" : "border-line text-muted hover:text-fg"}`}
          >
            {x}
          </button>
        ))}
      </div>
      {data && rows.length === 0 ? (
        <Empty>No incidents here.</Empty>
      ) : (
        <Card className="overflow-hidden">
          {rows.map((i) => (
            <IncidentRow key={`${i.agent_id}-${i.id}`} inc={i} />
          ))}
        </Card>
      )}
    </>
  );
}
