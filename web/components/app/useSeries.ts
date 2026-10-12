"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/app";
import { type Bucket, fillBuckets, sumBuckets } from "./charts";

/** Runs/failures per bucket across the given agents (read from each agent's existing metrics endpoint). */
export function useSeries(agentIds: string[], minutes = 60, bucketS = 120, refreshMs = 30000) {
  const [series, setSeries] = useState<Bucket[] | null>(null);
  const key = agentIds.join(",");
  useEffect(() => {
    if (!key) {
      setSeries([]);
      return;
    }
    let alive = true;
    const load = () =>
      Promise.all(
        key.split(",").map((id) =>
          api<{ series: Bucket[] }>(`/agents/${id}/metrics?minutes=${minutes}&bucket_s=${bucketS}`)
            .then((m) => m.series)
            .catch(() => [] as Bucket[]),
        ),
      ).then((all) => alive && setSeries(fillBuckets(sumBuckets(all), minutes, bucketS)));
    load();
    const t = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [key, minutes, bucketS, refreshMs]);
  return series;
}
