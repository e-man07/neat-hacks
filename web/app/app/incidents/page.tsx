"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Empty, IncidentTable, PageHead, TableSkeleton } from "@/components/app/bits";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type InboxIncident, useApi, useStream } from "@/lib/app";

const FILTERS = ["all", "open", "needs approval", "resolved"] as const;
type Filter = (typeof FILTERS)[number];

const match = (f: Filter, i: InboxIncident) =>
  f === "all"
    ? true
    : f === "open"
      ? !["RESOLVED", "DEFERRED"].includes(i.status)
      : f === "needs approval"
        ? ["AWAITING_APPROVAL", "ESCALATED"].includes(i.status)
        : i.status === "RESOLVED";

export default function IncidentsPage() {
  const { data, reload } = useApi<InboxIncident[]>("/incidents", 10000);
  const [f, setF] = useState<Filter>("all");
  useStream((e) => e.type.startsWith("incident") && reload());
  const rows = (data ?? []).filter((i) => match(f, i));
  return (
    <>
      <PageHead title="Incidents" sub="Every incident across your agents, with the investigation, actions and postmortem." />
      <Tabs value={f} onValueChange={(v) => setF(v as Filter)} className="mb-4">
        <TabsList>
          {FILTERS.map((x) => (
            <TabsTrigger key={x} value={x} className="capitalize">
              {x}
              {data && <span className="ml-1 rounded bg-background/70 px-1 text-[11px] tabular-nums text-muted-foreground">{data.filter((i) => match(x, i)).length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {data && rows.length === 0 ? (
        <Empty icon={ShieldCheck} title={f === "all" ? "No incidents yet" : `No ${f} incidents`}>
          When an agent misbehaves, Nightly opens an incident here with the investigation, the fix and the postmortem.
        </Empty>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">{!data ? <TableSkeleton rows={6} /> : <IncidentTable rows={rows} />}</Card>
      )}
    </>
  );
}
