"use client";

import PageShell from "@/components/PageShell";
import { Card, Label, Pill } from "@/components/ui";
import { money } from "@/lib/api";
import { useBenchmark, type BenchResult, type Window } from "@/lib/bench";

const ok = (b: boolean | null | undefined) =>
  b === null || b === undefined ? <span className="text-white/30">—</span> : b ? <span className="text-ok">✓</span> : <span className="text-alert">✕</span>;

function Bars({ r }: { r: BenchResult }) {
  const rows: [string, Window][] = [
    ["before", r.before],
    ["during", r.during],
    ["after", r.after],
  ];
  const max = Math.max(...rows.map(([, w]) => w.loss_per_conv), 1);
  return (
    <div className="space-y-1.5">
      {rows.map(([k, w]) => (
        <div key={k} className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-12 text-white/40">{k}</span>
          <div className="h-2 flex-1 rounded-full bg-white/[0.05]">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(w.loss_per_conv / max) * 100}%`, background: k === "during" ? "var(--alert)" : "var(--ok)" }}
            />
          </div>
          <span className="w-36 text-right text-white/60">
            {money(w.loss_per_conv, 2)}/conv · {Math.round(w.correct_rate * 100)}% ok
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BenchmarkPage() {
  const bench = useBenchmark();
  const results = bench?.results ?? [];
  return (
    <PageShell title="Incident benchmark" sub="Six staged incidents. Live models. Every number has a trace behind it.">
      <p className="max-w-[760px] text-[14px] leading-relaxed text-white/60">
        Each incident runs end to end: baseline traffic on the known-good release, a trigger (a bad release written by a real
        Claude Code session, an injected provider fault, or attack traffic), then Nightly detects, investigates, prices,
        decides under policy, contains, replays the failed conversations and watches live recovery. Incidents are staged on
        purpose so they are reproducible.
      </p>
      <p className="mt-2 font-mono text-[11px] text-white/35">
        {bench?.run ? `run ${bench.run} · source: ${bench.source}` : "loading…"}
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="bg-white/[0.03] font-mono text-[10.5px] uppercase tracking-wider text-white/40">
            <tr>
              {["#", "incident", "detected", "diagnosis", "culprit", "action", "replay", "recovered", "at risk", "LLM cost"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.incident} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono text-white/40">{r.incident}</td>
                <td className="px-3 py-3 text-white">{r.name}</td>
                <td className="px-3 py-3 font-mono text-white/70">{r.seconds_to_detect ?? "—"}s</td>
                <td className="px-3 py-3">{ok(r.type_correct)} <span className="text-white/70">{r.diagnosed_type}</span></td>
                <td className="px-3 py-3">{ok(r.culprit_correct)} <span className="font-mono text-white/70">{r.culprit ?? "none"}</span></td>
                <td className="px-3 py-3">
                  {ok(r.action_correct)} <span className="text-white/70">{r.action?.replaceAll("_", " ")}</span>
                  <div className="font-mono text-[10.5px] text-white/35">{r.action_mode}</div>
                </td>
                <td className="px-3 py-3 font-mono text-white/70">{r.replay_n ? `${r.replay}/${r.replay_n}` : "—"}</td>
                <td className="px-3 py-3">{ok(r.live_recovered)}</td>
                <td className="px-3 py-3 font-mono text-white/70">{money(r.projected_loss_if_waiting)}</td>
                <td className="px-3 py-3 font-mono text-white/70">{money(r.nightshift_cost_usd, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <Card key={r.incident} className="p-5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-white/40">{r.incident}</span>
              <span className="text-[15px] text-white">{r.name}</span>
              <span className="ml-auto">
                <Pill color={r.status === "RESOLVED" ? "var(--ok)" : "var(--amber)"}>{r.status ?? "—"}</Pill>
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{r.story}</p>
            <div className="mt-4">
              <Bars r={r} />
            </div>
            {r.coding_prompt && (
              <div className="mt-4">
                <Label>prompt behind the change (via Entire)</Label>
                <p className="mt-1 line-clamp-3 text-[12.5px] text-white/70">“{r.coding_prompt}”</p>
              </div>
            )}
            <div className="mt-3 space-y-0.5 font-mono text-[10.5px] text-white/35">
              <div>checkpoint {r.checkpoint ?? "—"} · diagnosis {r.diagnosis_method} ({r.diagnosis_model ?? "rules"}) · confidence {r.confidence}</div>
              <div>nightly trace {r.nightshift_trace_id ?? "—"}</div>
              <div>evidence traces {r.evidence_trace_ids.slice(0, 3).join(", ") || "—"}</div>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
