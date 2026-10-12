import bench from "@/public/benchmark.json";

/** The recorded benchmark incident the landing page tells (I1, run 3 on the live Harbor agent).
 *  Read at build time from the snapshot in /public, so every number is in the first server render. */
export type HeroIncident = {
  run: string;
  name: string;
  incidentId: string;
  release: string;
  previous: string;
  commit: string;
  checkpoint: string;
  prompt: string;
  detect: string;
  diagnosis: string;
  lossPerMin: string;
  atRisk: string;
  secondsToContain: string;
  replay: string;
  correctBefore: number;
  correctDuring: number;
  correctAfter: number;
};

type Result = (typeof bench.results)[number];

const usd = (n: number, d = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

export function heroIncident(): HeroIncident {
  const r: Result = bench.results.find((x) => x.incident === "I1") ?? bench.results[0];
  const title = (kind: string) => r.timeline.find((e) => e.kind === kind)?.title ?? "";
  const provenance = r.timeline.find((e) => e.title.startsWith("get_change_provenance"))?.title ?? "";
  const act = title("act");
  return {
    run: bench.run ?? "benchmark",
    name: r.name,
    incidentId: r.incident_id ?? "",
    release: r.culprit ?? "r46",
    previous: act.match(/→\s*(\S+)/)?.[1] ?? "r41",
    commit: provenance.match(/commit\s+([0-9a-f]{7})/)?.[1] ?? "",
    checkpoint: (r.checkpoint ?? "").slice(0, 12),
    prompt: r.coding_prompt.split(". ")[0] + ".",
    detect: title("detect").replace(/^Anomaly detected:\s*/, "").replace(/\s*\(.*\)$/, ""),
    diagnosis: title("diagnosis").replace(/\s*\(.*\)$/, ""),
    lossPerMin: usd(r.loss_per_minute ?? 0, 2),
    atRisk: usd(r.projected_loss_if_waiting ?? 0),
    secondsToContain: String(r.seconds_detect_to_mitigate ?? ""),
    replay: `${r.replay}/${r.replay_n}`,
    correctBefore: Math.round(r.before.correct_rate * 100),
    correctDuring: Math.round(r.during.correct_rate * 100),
    correctAfter: Math.round(r.after.correct_rate * 100),
  };
}

/** Min–max Nightly cost per investigation across the run, e.g. "$0.05–$0.15". */
export function costRange(): string {
  const xs = bench.results.map((r) => r.nightshift_cost_usd);
  return `${usd(Math.min(...xs), 2)}–${usd(Math.max(...xs), 2)}`;
}
