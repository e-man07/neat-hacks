"use client";

import { useEffect, useState } from "react";
import { API } from "./api";

export type Window = {
  n: number;
  correct_rate: number;
  loss_per_conv: number;
  cost_per_conv: number;
  failed_rate: number;
  wrong_refund_rate: number;
  avg_steps: number;
  trace_ids: string[];
};

export type BenchResult = {
  incident: string;
  name: string;
  story: string;
  incident_id: string | null;
  status: string | null;
  severity: string | null;
  conversations_to_detect: number;
  seconds_to_detect: number | null;
  seconds_detect_to_mitigate: number | null;
  diagnosed_type: string | null;
  expected_type: string;
  type_correct: boolean;
  culprit: string | null;
  culprit_correct: boolean;
  checkpoint: string | null;
  coding_prompt: string;
  action: string | null;
  action_mode: string | null;
  action_correct: boolean;
  replay: number | null;
  replay_n: number | null;
  live_recovered: boolean | null;
  diagnosis_method: string | null;
  diagnosis_model: string | null;
  confidence: number | null;
  nightshift_cost_usd: number;
  nightshift_trace_id: string | null;
  evidence_trace_ids: string[];
  loss_per_minute: number | null;
  projected_loss_if_waiting: number | null;
  before: Window;
  during: Window;
  after: Window;
  traffic_cost_usd: number;
  timeline: { t: number; kind: string; title: string }[];
};

export type Bench = { run: string | null; results: BenchResult[]; source: "api" | "static" | "none" };

/** Benchmark evidence: from the API when it runs, else the snapshot shipped in /public. */
export function useBenchmark(): Bench | null {
  const [data, setData] = useState<Bench | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/benchmark`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (alive && d.results?.length) setData({ ...d, source: "api" });
        else return Promise.reject();
      })
      .catch(() =>
        fetch("/benchmark.json")
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d) => alive && setData({ ...d, source: "static" }))
          .catch(() => alive && setData({ run: null, results: [], source: "none" })),
      );
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
