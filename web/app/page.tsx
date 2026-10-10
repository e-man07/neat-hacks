"use client";

import Link from "next/link";
import Nav from "@/components/Nav";
import NightSky from "@/components/NightSky";
import IncidentReel from "@/components/IncidentReel";
import Phone from "@/components/Phone";
import { Card, GhostLink, Label, PrimaryLink } from "@/components/ui";
import { useBenchmark } from "@/lib/bench";
import { money } from "@/lib/api";

const LOOP = [
  { k: "01", t: "Watch", d: "Ledger reconciled against policy, failed replies, tool errors and cost per conversation — the signals that matter, not HTTP 200s." },
  { k: "02", t: "Investigate", d: "A Claude Sonnet agent reads neatlogs traces, the deploy log, release diffs and the Entire checkpoint behind the change." },
  { k: "03", t: "Price", d: "Dollars per minute at production volume × minutes until a human would answer. Unit economics come from the cfo.ai model." },
  { k: "04", t: "Contain", d: "Roll back, fail over, or switch off a risky capability — only if a pre-approved policy allows it and it can be undone." },
  { k: "05", t: "Verify", d: "Replays the exact conversations that failed against the new config, then watches live traffic. Undoes itself if it got worse." },
  { k: "06", t: "Report", d: "A page on your phone, a postmortem, a regression eval from the failing traces, and a permanent fix waiting for your approval." },
];

export default function Home() {
  const bench = useBenchmark();
  const results = bench?.results ?? [];
  const hero = results.find((r) => r.incident === "I1" && r.timeline?.length) ?? results.find((r) => r.timeline?.length);
  const solved = results.filter((r) => r.type_correct && r.action_correct).length;
  const avgMitigate = (() => {
    const xs = results.map((r) => r.seconds_detect_to_mitigate).filter((x): x is number => typeof x === "number");
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  })();
  const prevented = results.reduce((a, r) => a + (r.action_mode === "auto" ? r.projected_loss_if_waiting ?? 0 : 0), 0);

  return (
    <main className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="px-3 sm:px-5">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-black">
          <NightSky alert={0.6} />
          <div className="relative z-10 flex min-h-[640px] flex-col items-center justify-center px-5 py-24 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 font-mono text-[11px] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--alert)] pulse-alert" /> 03:07 AM · production · nobody is awake
            </div>
            <h1 className="headline max-w-[920px] text-[44px] sm:text-[64px] lg:text-[76px]">
              The on-call engineer
              <br />
              for your AI agents.
            </h1>
            <p className="mt-6 max-w-[620px] text-[17px] leading-relaxed text-white/75 sm:text-[19px]">
              It stops the bleeding by itself. It only wakes you for decisions that can’t be undone.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryLink href="/console">Open the live console</PrimaryLink>
              <GhostLink href="/benchmark">See the incident benchmark</GhostLink>
            </div>
            <div className="mt-6 font-mono text-[11px] text-white/40">
              built for neatHack 2026 · traced with neatlogs · provenance from Entire · economics from cfo.ai
            </div>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="mx-auto mt-14 grid max-w-[1100px] grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line px-0 sm:grid-cols-4">
        {[
          { v: results.length ? `${solved}/${results.length}` : "—", l: "staged incidents diagnosed and handled correctly" },
          { v: avgMitigate !== null ? `${avgMitigate}s` : "—", l: "average from detection to containment" },
          { v: results.length ? money(prevented) : "—", l: "projected loss avoided vs. waiting for a human" },
          { v: results.length ? money(results.reduce((a, r) => a + r.nightshift_cost_usd, 0), 2) : "—", l: "LLM cost of every investigation, combined" },
        ].map((s) => (
          <div key={s.l} className="bg-bg px-5 py-6">
            <div className="text-[28px] font-light tracking-tight text-white">{s.v}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/50">{s.l}</div>
          </div>
        ))}
      </section>
      <p className="mx-auto mt-3 max-w-[1100px] px-4 font-mono text-[11px] text-white/35">
        {bench?.run ? `from benchmark run ${bench.run} (${bench.source}) · live Claude models · incidents staged on purpose` : "start the API to load benchmark evidence"}
      </p>

      {/* The night, replayed */}
      <section className="mx-auto mt-24 max-w-[1100px] px-4">
        <h2 className="subhead text-[30px] sm:text-[36px]">
          A real incident, replayed.
          <br />
          <span className="dim">From the first bad refund to the page on your phone.</span>
        </h2>
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="dotgrid min-w-0 rounded-2xl p-4 sm:p-8">
            {hero ? (
              <IncidentReel events={hero.timeline} title={`night-shift — ${hero.incident_id} · ${hero.name}`} />
            ) : (
              <div className="window grid h-[380px] place-items-center font-mono text-sm text-white/40">waiting for evidence…</div>
            )}
          </div>
          <Phone
            clock="03:08"
            notes={
              hero
                ? [
                    {
                      title: "✅ Incident handled — no action needed tonight",
                      body: `${hero.name}: ${hero.action?.replaceAll("_", " ")} ${hero.seconds_detect_to_mitigate ?? "?"}s after detection. ${hero.replay}/${hero.replay_n} failed conversations now pass. ~${money(hero.projected_loss_if_waiting)} prevented. Permanent fix is waiting for your approval.`,
                      time: "now",
                      tone: "ok",
                    },
                  ]
                : []
            }
          />
        </div>
        {hero?.coding_prompt && (
          <Card className="relative mt-8 p-5">
            <Label>root cause, traced through Entire to the prompt behind the change</Label>
            <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-white/85">
              “{hero.coding_prompt.length >= 300 ? `${hero.coding_prompt.trimEnd()}…` : hero.coding_prompt}”
            </p>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              release {hero.culprit} · checkpoint {hero.checkpoint}
            </p>
          </Card>
        )}
      </section>

      {/* Loop */}
      <section className="mx-auto mt-28 max-w-[1100px] px-4">
        <h2 className="subhead text-[30px] sm:text-[36px]">
          Six steps, every incident.
          <br />
          <span className="dim">Each one leaves evidence you can check.</span>
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {LOOP.map((s) => (
            <div key={s.k} className="bg-black p-6">
              <div className="font-mono text-[11px] text-white/35">{s.k}</div>
              <div className="mt-3 text-[19px] font-semibold tracking-tight text-white">{s.t}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Autonomy */}
      <section className="mx-auto mt-28 max-w-[1100px] px-4">
        <h2 className="subhead text-[30px] sm:text-[36px]">
          Autonomous where it’s reversible.
          <br />
          <span className="dim">A human approves anything that isn’t.</span>
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <Label>acts alone (pre-approved, one-step undo)</Label>
            <ul className="mt-4 space-y-3 text-[14.5px] text-white/80">
              <li>↩︎ Roll back to the last known-good release</li>
              <li>⇄ Fail over to a backup model when a provider is down</li>
              <li>⏻ Switch off automatic refunds — they queue for a human</li>
              <li>⧗ Cap agent steps to stop a runaway loop</li>
            </ul>
            <p className="mt-5 text-[13px] text-white/45">
              Gates: confidence ≥ 0.6, projected loss ≥ $25 (or a safety incident), verified by replay, auto-undo if worse.
            </p>
          </Card>
          <Card className="p-6">
            <Label>waits for you</Label>
            <ul className="mt-4 space-y-3 text-[14.5px] text-white/80">
              <li>✎ Deploying a code or prompt fix</li>
              <li>⎌ Reverting a commit on main</li>
              <li>$ Refunding or contacting customers</li>
              <li>✕ Anything not on the list</li>
            </ul>
            <p className="mt-5 text-[13px] text-white/45">
              Low-impact incidents aren’t worth waking you: they’re deferred to the morning with the fix attached.
            </p>
          </Card>
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto mt-28 max-w-[1100px] px-4">
        <h2 className="subhead text-[30px] sm:text-[36px]">
          Three tools, one loop.
          <br />
          <span className="dim">Each does the job it was built for.</span>
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          {[
            {
              n: "neatlogs",
              r: "the evidence",
              d: "Every conversation and every Night Shift investigation is traced. The investigator reads traces back over the neatlogs MCP, cites them in the postmortem, and leaves a detection behind for the incident's signature.",
            },
            {
              n: "Entire",
              r: "the why",
              d: "Every release was written by a coding-agent session and checkpointed. Night Shift follows the bad deploy to its commit, its checkpoint, the developer's prompt — and the warning the coding agent gave that nobody read.",
            },
            {
              n: "cfo.ai",
              r: "the price",
              d: "The business model holds volume, lifetime value, ticket cost and refund economics. Night Shift prices each incident with it and decides whether waiting until morning is affordable.",
            },
          ].map((t) => (
            <div key={t.n} className="bg-black p-6">
              <div className="text-[19px] font-semibold tracking-tight text-white">{t.n}</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">{t.r}</div>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-28 max-w-[1100px] px-4 pb-24">
        <div className="dotgrid relative overflow-hidden rounded-2xl border border-line px-6 py-16 text-center">
          <h2 className="subhead text-[30px] sm:text-[40px]">Go to sleep. It’s handled.</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-white/60">
            Deploy a bad release in the console and watch Night Shift catch it, price it, contain it and prove it.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <PrimaryLink href="/console">Open the console</PrimaryLink>
            <GhostLink href="/business">Business plan</GhostLink>
          </div>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/35">
          <span>Night Shift · neatHack 2026</span>
          <span className="flex gap-4">
            <Link href="/incidents" className="hover:text-white">Incidents</Link>
            <Link href="/benchmark" className="hover:text-white">Benchmark</Link>
            <a href="https://github.com/e-man07/neat-hacks" className="hover:text-white">GitHub</a>
          </span>
        </footer>
      </section>
    </main>
  );
}
