"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import HalftoneMoon from "@/components/HalftoneMoon";
import IncidentReel from "@/components/IncidentReel";
import Nav from "@/components/Nav";
import Phone from "@/components/Phone";
import { GhostLink, Moon, PrimaryLink } from "@/components/ui";
import { money } from "@/lib/api";
import { useBenchmark } from "@/lib/bench";

const CITED = [
  "NEATLOGS TRACE",
  "ENTIRE CHECKPOINT",
  "CODING PROMPT",
  "DEPLOY LOG",
  "RELEASE DIFF",
  "ENTIRE-GRAPH",
  "CFO.AI MODEL",
  "POLICY v3",
  "REPLAY 3/3",
  "POSTMORTEM",
  "REGRESSION EVAL",
  "FIX PR",
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
  const STEP_KINDS = ["detect", "diagnosis", "impact", "decide", "act", "verify", "page"];
  const steps = (hero?.timeline ?? []).filter((e) => STEP_KINDS.includes(e.kind)).slice(0, 7);

  return (
    <main className="min-h-screen overflow-x-hidden bg-bg">
      <Nav />

      {/* Hero */}
      <section className="relative">
        <SideTiles side="left" />
        <SideTiles side="right" />
        <div className="relative z-10 mx-auto flex max-w-[760px] flex-col items-center px-5 pt-20 text-center sm:pt-28">
          <div className="eyebrow flex flex-wrap items-center justify-center gap-x-2">
            Built with <span className="text-fg">neatlogs</span> · <span className="text-fg">Entire</span> · <span className="text-fg">cfo.ai</span>
          </div>
          <h1 className="headline mt-5 text-[40px] sm:text-[56px]">The on-call engineer for your AI agents</h1>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-muted sm:text-[17px]">
            It stops the bleeding by itself, and only wakes you for decisions that can’t be undone.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PrimaryLink href="/app">Get started</PrimaryLink>
            <GhostLink href="/sandbox">Try the sandbox</GhostLink>
          </div>
        </div>
        <div className="relative mx-auto mt-6 h-[280px] max-w-[1180px] sm:h-[460px]">
          <HalftoneMoon />
          <div className="pointer-events-none absolute left-1/2 top-[4%] hidden -translate-x-1/2 sm:block">
            <span className="eyebrow rounded-full border border-line bg-white/90 px-3 py-1 text-[11.5px] shadow-soft" style={{ background: "rgba(255,255,255,0.92)" }}>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-alert pulse-alert" /> 03:07 AM · production · nobody is awake
            </span>
          </div>
        </div>
      </section>

      {/* Every incident cited */}
      <section className="border-y border-line bg-bg">
        <div className="mx-auto flex max-w-[1180px] items-center gap-5 overflow-hidden px-5 py-4">
          <span className="shrink-0 text-[15px] text-fg">Every incident cited</span>
          <span className="h-6 w-px shrink-0 bg-line-strong" />
          <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <div className="marquee flex w-max gap-2">
              {[...CITED, ...CITED].map((c, i) => (
                <span key={i} className="chip text-muted">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Without / With */}
      <section className="mx-auto max-w-[1000px] px-5 pt-28">
        <h2 className="subhead mx-auto max-w-[860px] text-center text-[32px] sm:text-[44px]">
          Keep your agents <span className="text-muted">working</span> while <span className="text-muted">nobody is awake</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line-strong p-6">
            <div className="font-mono text-[13px] text-muted">Without Night Shift</div>
            <div className="mt-6 space-y-3">
              <Bubble right>“Make refunds one step, payments already validates them.”</Bubble>
              <LogLine t="17:42">Coding agent ships r46. Its warning about eligibility checks scrolls past.</LogLine>
              <LogLine t="03:07">Refunds the policy forbids start going out. Every request returns 200.</LogLine>
              <LogLine t="03:07–08:12" tone="alert">
                No alert fires. {hero ? money(hero.projected_loss_if_waiting) : "$22,500"} leaks out before anyone wakes up.
              </LogLine>
              <LogLine t="08:12">Someone notices a refund spike in the dashboard.</LogLine>
              <LogLine t="11:30">Postmortem written by hand. Nobody finds the prompt that caused it.</LogLine>
            </div>
          </div>
          <div className="rounded-2xl border border-[#111] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md bg-[#111] px-2 py-1 font-mono text-[13px]" style={{ color: "#fff" }}>
                With Night Shift
              </span>
              <span className="font-mono text-[12.5px] text-muted">
                <span className="mr-1 text-fg">●</span> live · {bench?.run ?? "benchmark"}
              </span>
            </div>
            <div className="mt-6 space-y-2.5">
              {steps.length ? (
                steps.map((e, i) => (
                  <div key={i} className="flex gap-3 text-[13.5px] leading-snug">
                    <span className="w-[86px] shrink-0 font-mono text-[11.5px] uppercase tracking-wide text-faint">{e.kind}</span>
                    <span className="line-clamp-2 text-fg-2">{e.title}</span>
                  </div>
                ))
              ) : (
                <p className="font-mono text-[12.5px] text-faint">loading the recorded incident…</p>
              )}
              {hero && (
                <div className="mt-4 rounded-lg bg-card-2 px-3 py-2.5 text-[13.5px] text-fg">
                  ✅ Contained {hero.seconds_detect_to_mitigate ?? "?"}s after detection · {hero.replay}/{hero.replay_n} replays pass · ~
                  {money(hero.projected_loss_if_waiting)} not lost
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="how" className="mx-auto max-w-[1000px] scroll-mt-24 px-5 pt-32">
        <h2 className="subhead mx-auto max-w-[680px] text-center text-[28px] sm:text-[34px]">
          One SDK connects your agents to an engineer that reads neatlogs, Entire and cfo.ai
        </h2>
        <div className="relative mt-14 grid items-center gap-6 lg:grid-cols-[180px_auto_1fr_auto_220px]">
          <DiagramCard label="AI agents">
            <div className="grid grid-cols-3 gap-2">
              {["H", "S", "+", "◐", "◇", "⌘"].map((g, i) => (
                <span key={i} className="grid h-11 place-items-center rounded-lg bg-chip font-mono text-[15px] text-fg">
                  {g}
                </span>
              ))}
            </div>
            <div className="mt-2 font-mono text-[11px] text-faint">Harbor · Scout · yours</div>
          </DiagramCard>
          <Connector label="traces · outcomes" />
          <div className="relative">
            <div className="mx-auto max-w-[230px] rounded-xl bg-[#111] p-4 shadow-soft" style={{ color: "#fff" }}>
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <span className="grid h-6 w-6 place-items-center rounded bg-white/15">
                  <Moon size={13} />
                </span>
                Night Shift
              </div>
              <div className="mt-2 font-mono text-[12.5px] text-white/60" style={{ color: "rgba(255,255,255,0.6)" }}>
                SDK · policy · Slack
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-[300px] rounded-xl border border-line-strong p-4">
              <div className="font-mono text-[12.5px] text-muted">What it does</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["↩ Roll back", "⇄ Fail over model", "⏻ Kill switch", "⧗ Cap steps", "▤ Postmortem"].map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
                <span className="chip border border-dashed border-line-strong bg-transparent">✎ Fix PR · needs you</span>
              </div>
            </div>
          </div>
          <Connector label="reads" reverse />
          <DiagramCard label="Evidence">
            {[
              ["neatlogs", "traces, read back over MCP"],
              ["Entire", "checkpoint → prompt"],
              ["cfo.ai", "$ per minute, runway"],
            ].map(([n, d]) => (
              <div key={n} className="border-b border-line py-2 last:border-0">
                <div className="text-[14px] text-fg">{n}</div>
                <div className="font-mono text-[11.5px] text-faint">{d}</div>
              </div>
            ))}
          </DiagramCard>
        </div>
        <div className="mx-auto mt-8 w-fit rounded-lg border border-dashed border-line-strong px-4 py-2 font-mono text-[12.5px] text-muted">
          ← replays the failed runs through your agent to prove every fix
        </div>
      </section>

      {/* Proof */}
      <section className="mx-auto max-w-[1000px] px-5 pt-28">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line-strong sm:grid-cols-4">
          {[
            { v: results.length ? `${solved}/${results.length}` : "—", l: "staged incidents diagnosed and handled correctly" },
            { v: avgMitigate !== null ? `${avgMitigate}s` : "—", l: "average from detection to containment" },
            { v: results.length ? money(prevented) : "—", l: "projected loss avoided vs. waiting for a human" },
            { v: results.length ? money(results.reduce((a, r) => a + r.nightshift_cost_usd, 0), 2) : "—", l: "LLM cost of every investigation, combined" },
          ].map((s, i) => (
            <div key={s.l} className={`p-5 sm:p-6 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""} border-line`}>
              <div className="text-[30px] font-normal tracking-tight text-fg">{s.v}</div>
              <div className="mt-1 text-[13px] leading-snug text-muted">{s.l}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11.5px] text-faint">
          {bench?.run ? `benchmark run ${bench.run} · live Claude models · incidents staged on purpose so they're reproducible` : "loading benchmark evidence…"}
        </p>
      </section>

      {/* Numbered rows */}
      <section className="mx-auto max-w-[1000px] space-y-28 px-5 pt-32">
        <Row
          n="01"
          tag="neatlogs"
          title="Every run, traced. Every incident, investigated."
          body="Night Shift watches the signals that matter, not HTTP 200s: failed answers, wrong refunds, tool errors, loops, cost. When a window goes bad, a Claude agent investigates the way an SRE would, reading the failing traces back from neatlogs and citing them."
        >
          {hero ? (
            <div className="force-dark min-w-0">
              <IncidentReel events={hero.timeline} title={`night-shift — ${hero.incident_id} · ${hero.name}`} />
            </div>
          ) : (
            <div className="grid h-[380px] place-items-center font-mono text-sm text-faint">waiting for evidence…</div>
          )}
        </Row>
        <Row
          n="02"
          tag="Entire"
          title="Traced to the prompt behind the change."
          body="Every release in our benchmark was written by a real coding-agent session and checkpointed by Entire. Night Shift follows the bad deploy to its commit, its checkpoint, the developer's prompt, and the warning the coding agent gave that nobody read."
        >
          <div className="rounded-xl border border-line bg-[var(--panel)] p-5 shadow-soft" style={{ background: "#fff" }}>
            <div className="font-mono text-[11.5px] uppercase tracking-wider text-faint">root cause → commit → checkpoint → prompt</div>
            <p className="mt-3 text-[15px] leading-relaxed text-fg">
              “{hero?.coding_prompt ? (hero.coding_prompt.length >= 300 ? `${hero.coding_prompt.trimEnd()}…` : hero.coding_prompt) : "Make refunds one step: payments already validates eligibility."}”
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="chip">release {hero?.culprit ?? "r46"}</span>
              {hero?.checkpoint && <span className="chip">checkpoint {hero.checkpoint.slice(0, 12)}</span>}
              <span className="chip">Claude Code</span>
            </div>
            <div className="mt-4 rounded-lg bg-[#fff5ef] px-3 py-2 text-[13px] text-alert">⚠ The coding agent warned about this. Nobody read it.</div>
          </div>
        </Row>
        <Row
          n="03"
          tag="cfo.ai"
          title="Priced before it decides. One page when it's done."
          body="Dollars per minute at production volume, times the minutes until a human would answer, from the unit economics in your cfo.ai model. Worth it and reversible? It acts, proves the fix by replay, and sends one message. Not worth waking you? It waits for morning."
        >
          <div className="flex justify-center py-2">
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
        </Row>
      </section>

      {/* Autonomy */}
      <section className="mx-auto max-w-[1000px] px-5 pt-32">
        <h2 className="subhead text-center text-[30px] sm:text-[40px]">
          Autonomous where it’s <span className="text-muted">reversible</span>.
          <br />A human approves anything that <span className="text-muted">isn’t</span>.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line-strong p-6">
            <div className="font-mono text-[13px] text-muted">Acts alone · pre-approved · one-step undo</div>
            <ul className="mt-5 space-y-3 text-[15px] text-fg">
              <li>↩︎ Roll back to the last known-good release</li>
              <li>⇄ Fail over to a backup model when a provider is down</li>
              <li>⏻ Switch off a risky tool; its work queues for a human</li>
              <li>⧗ Cap agent steps to stop a runaway loop</li>
            </ul>
            <p className="mt-5 text-[13px] text-muted">Gated on confidence and $ at risk, verified by replay, undone automatically if it made things worse.</p>
          </div>
          <div className="rounded-2xl border border-line-strong bg-card-2 p-6">
            <div className="font-mono text-[13px] text-muted">Waits for you · in Slack</div>
            <ul className="mt-5 space-y-3 text-[15px] text-fg">
              <li>✎ Shipping a code or prompt fix (opens a PR)</li>
              <li>$ Refunding or contacting customers</li>
              <li>✕ Deleting data</li>
              <li>… anything your policy doesn’t list</li>
            </ul>
            <p className="mt-5 text-[13px] text-muted">Low-impact incidents aren’t worth waking you for. They wait for morning, with the fix attached.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1000px] px-5 pb-16 pt-32">
        <div className="dotgrid rounded-2xl border border-line px-6 py-20 text-center">
          <h2 className="subhead text-[32px] sm:text-[44px]">Go to sleep. It’s handled.</h2>
          <p className="mx-auto mt-3 max-w-[480px] text-muted">
            Connect an agent in five minutes: one SDK, your neatlogs key, and a policy that says what Night Shift may do alone.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <PrimaryLink href="/app">Get started</PrimaryLink>
            <GhostLink href="/docs">Read the docs</GhostLink>
          </div>
        </div>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-muted">
          <span className="flex items-center gap-2">
            <Moon size={14} /> Night Shift · neatHack 2026
          </span>
          <span className="flex gap-5">
            <Link href="/docs" className="hover:text-fg">Docs</Link>
            <Link href="/benchmark" className="hover:text-fg">Benchmark</Link>
            <Link href="/business" className="hover:text-fg">Business</Link>
            <a href="https://github.com/e-man07/neat-hacks" className="hover:text-fg">GitHub</a>
          </span>
        </footer>
      </section>
    </main>
  );
}

function Bubble({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <div className={`flex ${right ? "justify-end" : ""}`}>
      <span className="max-w-[85%] rounded-xl bg-chip px-3.5 py-2.5 text-[13.5px] text-fg">{children}</span>
    </div>
  );
}

function LogLine({ t, children, tone }: { t: string; children: ReactNode; tone?: "alert" }) {
  return (
    <div className="flex gap-3 text-[13.5px] leading-snug">
      <span className="w-[86px] shrink-0 font-mono text-[11.5px] text-faint">{t}</span>
      <span className={tone === "alert" ? "text-alert" : "text-fg-2"}>{children}</span>
    </div>
  );
}

function DiagramCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-xl border border-line-strong p-3">
      <div className="mb-3 font-mono text-[12.5px] text-muted">{label}</div>
      {children}
    </div>
  );
}

function Connector({ label, reverse = false }: { label: string; reverse?: boolean }) {
  return (
    <div className="hidden flex-col items-center lg:flex">
      <span className="font-mono text-[12px] text-muted">{label}</span>
      <span className="mt-1 flex w-20 items-center text-faint">
        {reverse && <span className="text-[11px]">‹</span>}
        <span className="h-px flex-1 bg-line-strong" />
        {!reverse && <span className="text-[11px]">›</span>}
      </span>
    </div>
  );
}

function Row({ n, tag, title, body, children }: { n: string; tag: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-faint">{n}</span>
          <span className="chip">{tag}</span>
        </div>
        <h3 className="mt-4 text-[24px] font-normal tracking-tight text-fg sm:text-[26px]">{title}</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{body}</p>
      </div>
      <div className="dotgrid min-w-0 rounded-2xl border border-line bg-card-2 p-4 sm:p-7">{children}</div>
    </div>
  );
}

/** Decorative columns of dot tiles beside the hero (mireye-style), hidden on small screens. */
function SideTiles({ side }: { side: "left" | "right" }) {
  const cols =
    side === "left"
      ? [
          [{ h: 130, d: 6 }, { h: 170, d: 4 }, { h: 90, d: 0 }],
          [{ h: 90, d: 7, o: 40 }, { h: 90, d: -1 }, { h: 170, d: 5 }],
          [{ h: 160, d: 3, o: 20 }, { h: 80, d: 5 }, { h: 80, d: 8 }, { h: 80, d: 4 }],
        ]
      : [
          [{ h: 170, d: 4, o: 28 }, { h: 80, d: 0 }, { h: 80, d: -1 }],
          [{ h: 80, d: 6 }, { h: 80, d: 8 }, { h: 170, d: 4 }, { h: 80, d: 5 }],
          [{ h: 80, d: 5, o: 52 }, { h: 80, d: 7 }, { h: 170, d: 3 }],
        ];
  return (
    <div
      className={`pointer-events-none absolute top-14 hidden gap-2 xl:flex ${side === "left" ? "left-0 -translate-x-6" : "right-0 translate-x-6"}`}
      aria-hidden
    >
      {cols.map((col, ci) => (
        <div key={ci} className="flex w-[78px] flex-col gap-2" style={{ marginTop: col[0].o ?? 0 }}>
          {col.map((t, ti) => (
            <div
              key={ti}
              className="relative overflow-hidden rounded-xl border border-line bg-card-2"
              style={
                t.d > 0
                  ? {
                      height: t.h,
                      backgroundImage: `radial-gradient(rgba(17,17,17,${0.12 + t.d * 0.035}) ${0.6 + t.d * 0.12}px, transparent ${1 + t.d * 0.14}px)`,
                      backgroundSize: "6px 6px",
                    }
                  : { height: t.h, background: "#fff" }
              }
            >
              {t.d === 0 && (
                <div
                  className="absolute inset-2"
                  style={{
                    backgroundImage: "linear-gradient(rgba(17,17,17,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.08) 1px, transparent 1px)",
                    backgroundSize: "10px 10px",
                  }}
                >
                  <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#111]" />
                </div>
              )}
              {t.d === -1 && (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-alert pulse-alert" />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
