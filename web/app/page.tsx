"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import HeroVideo from "@/components/HeroVideo";
import { GitHubMark, SlackMark } from "@/components/Marks";
import IncidentReel from "@/components/IncidentReel";
import { Reveal, useInView, useScrollY } from "@/components/Motion";
import Nav from "@/components/Nav";
import Phone from "@/components/Phone";
import { GhostLink, Moon, PrimaryLink } from "@/components/ui";
import { money } from "@/lib/api";
import { useBenchmark, type BenchResult } from "@/lib/bench";

const CITED = ["NEATLOGS TRACE", "ENTIRE CHECKPOINT", "CODING PROMPT", "DEPLOY LOG", "RELEASE DIFF", "CFO.AI MODEL", "POLICY v3", "REPLAY 3/3", "POSTMORTEM", "REGRESSION EVAL", "FIX PR"];

const INTEGRATIONS: { name: string; icon: ReactNode; what: string }[] = [
  { name: "Slack", icon: <SlackMark size={18} />, what: "One message per incident, updated live. Approve or undo from the channel." },
  { name: "GitHub", icon: <GitHubMark size={18} />, what: "Sign in with GitHub. Approved fixes open as revert PRs on your repo." },
  { name: "neatlogs", icon: <Glyph>nl</Glyph>, what: "Your agent's traces. Nightly reads them back while it investigates." },
  { name: "Entire", icon: <Glyph>En</Glyph>, what: "Checkpoints link a bad deploy to the coding-agent prompt behind it." },
  { name: "cfo.ai", icon: <Glyph>$</Glyph>, what: "Your unit economics put a price on every minute of an incident." },
  { name: "Python SDK", icon: <Glyph>py</Glyph>, what: "pip install nightly-sdk. Zero dependencies, fails open." },
  { name: "Phone push", icon: <Glyph>◔</Glyph>, what: "ntfy notifications for the incidents that really need you." },
  { name: "Webhooks", icon: <Glyph>{"{}"}</Glyph>, what: "Send pages to PagerDuty, Opsgenie or your own tools." },
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
  const y = useScrollY();

  return (
    <main className="min-h-screen overflow-x-clip bg-bg">
      <Nav />

      {/* Hero: readable on its own */}
      <section className="relative">
        <SideTiles side="left" y={y} />
        <SideTiles side="right" y={y} />
        <div className="relative z-10 mx-auto flex max-w-[780px] flex-col items-center px-5 pt-16 text-center sm:pt-24">
          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-alert pulse-alert" /> On-call for AI agents<span className="hidden sm:inline"> · works in Slack</span>
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="headline mt-6 text-[40px] sm:text-[60px]">The on-call engineer for your AI agents</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-muted sm:text-[17.5px]">
              Nightly watches every run of your agents. When one breaks at 3 AM, it rolls back the bad release, proves the fix, and asks
              you in Slack only for what can’t be undone.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryLink href="/app">Connect your agent</PrimaryLink>
              <GhostLink href="/sandbox">Watch a live incident</GhostLink>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <SlackMark /> Slack
              </span>
              <span className="flex items-center gap-1.5 text-fg">
                <GitHubMark /> GitHub
              </span>
              <span>neatlogs</span>
              <span>Entire</span>
              <span>cfo.ai</span>
            </div>
          </Reveal>
        </div>
        <Reveal delay={320} className="relative z-10 mx-auto mt-14 max-w-[980px] px-4">
          <div style={{ transform: `translateY(${Math.min(y * -0.06, 0)}px)` }}>
            <HeroVideo />
          </div>
        </Reveal>
      </section>

      {/* Every incident cited */}
      <section className="mt-20 border-y border-line">
        <div className="mx-auto flex max-w-[1180px] items-center gap-5 overflow-hidden px-5 py-4">
          <span className="shrink-0 text-[15px] text-fg">Every incident cited</span>
          <span className="h-6 w-px shrink-0 bg-line-strong" />
          <Marquee items={CITED.map((c) => <span key={c} className="chip text-muted">{c}</span>)} />
        </div>
      </section>

      {/* Without / With */}
      <section className="mx-auto max-w-[1000px] px-5 pt-28">
        <Reveal>
          <h2 className="subhead mx-auto max-w-[820px] text-center text-[32px] sm:text-[44px]">
            The same bad release, <span className="text-muted">with and without</span> Nightly
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-line-strong p-6">
              <div className="font-mono text-[13px] text-muted">Without Nightly</div>
              <div className="mt-6 space-y-3">
                <LogLine t="03:07">Bad release goes live. Every request still returns 200.</LogLine>
                <LogLine t="03:07–08:12" tone="alert">
                  No alert fires. {hero ? money(hero.projected_loss_if_waiting) : "$22,846"} is lost before anyone wakes up.
                </LogLine>
                <LogLine t="08:12">Someone notices a spike on a dashboard.</LogLine>
                <LogLine t="11:30">Postmortem by hand. Nobody finds the prompt that caused it.</LogLine>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <WithCard hero={hero} run={bench?.run} />
          </Reveal>
        </div>
      </section>

      {/* Architecture */}
      <section id="how" className="mx-auto max-w-[1000px] scroll-mt-24 px-5 pt-32">
        <Reveal>
          <h2 className="subhead mx-auto max-w-[680px] text-center text-[28px] sm:text-[36px]">
            One SDK in your agent. <span className="text-muted">Nightly does the rest.</span>
          </h2>
        </Reveal>
        <div className="relative mt-14 grid items-center gap-6 lg:grid-cols-[180px_auto_1fr_auto_220px]">
          <Reveal>
            <DiagramCard label="Your agents">
              <div className="grid grid-cols-3 gap-2">
                {["H", "S", "+", "◐", "◇", "⌘"].map((g, i) => (
                  <span key={i} className="grid h-11 place-items-center rounded-lg bg-chip font-mono text-[15px] text-fg">
                    {g}
                  </span>
                ))}
              </div>
            </DiagramCard>
          </Reveal>
          <Connector label="traces · outcomes" />
          <Reveal delay={120}>
            <div className="float mx-auto max-w-[230px] rounded-xl bg-[#111] p-4 shadow-soft" style={{ color: "#fff" }}>
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <span className="grid h-6 w-6 place-items-center rounded bg-white/15">
                  <Moon size={13} />
                </span>
                Nightly
              </div>
              <div className="mt-2 font-mono text-[12.5px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                detect · trace · price · fix
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-[300px] rounded-xl border border-line-strong p-4">
              <div className="font-mono text-[12.5px] text-muted">Does on its own</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["↩ Roll back", "⇄ Switch model", "⏻ Kill switch", "⧗ Cap steps"].map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-4 font-mono text-[12.5px] text-muted">Asks you in Slack</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip border border-dashed border-line-strong bg-transparent">✎ Fix PR</span>
                <span className="chip border border-dashed border-line-strong bg-transparent">$ Refunds</span>
              </div>
            </div>
          </Reveal>
          <Connector label="reads" reverse />
          <Reveal delay={240}>
            <DiagramCard label="Evidence">
              {[
                ["neatlogs", "what happened"],
                ["Entire", "why it happened"],
                ["cfo.ai", "what it costs"],
              ].map(([n, d]) => (
                <div key={n} className="border-b border-line py-2 last:border-0">
                  <div className="text-[14px] text-fg">{n}</div>
                  <div className="font-mono text-[11.5px] text-faint">{d}</div>
                </div>
              ))}
            </DiagramCard>
          </Reveal>
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-[1000px] px-5 pt-32">
        <Reveal>
          <h2 className="subhead text-center text-[28px] sm:text-[36px]">
            Works with the tools <span className="text-muted">you already use</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INTEGRATIONS.map((it, i) => (
            <Reveal key={it.name} delay={(i % 4) * 70}>
              <div className="group h-full rounded-xl border border-line p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-soft">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-chip text-fg">{it.icon}</span>
                  <span className="text-[14.5px] font-medium text-fg">{it.name}</span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{it.what}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Proof */}
      <section className="mx-auto max-w-[1000px] px-5 pt-28">
        <Reveal>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line-strong sm:grid-cols-4">
            {[
              { v: results.length ? `${solved}/${results.length}` : "—", l: "incidents handled correctly" },
              { v: avgMitigate !== null ? `${avgMitigate}s` : "—", l: "from detection to fix" },
              { v: results.length ? money(prevented) : "—", l: "losses prevented" },
              { v: results.length ? money(results.reduce((a, r) => a + r.nightshift_cost_usd, 0) / results.length, 2) : "—", l: "per investigation" },
            ].map((s, i) => (
              <div key={s.l} className={`border-line p-5 sm:p-6 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
                <div className="text-[30px] font-normal tracking-tight text-fg">
                  <CountUp text={s.v} />
                </div>
                <div className="mt-1 text-[13px] text-muted">{s.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11.5px] text-faint">{bench?.run ? `benchmark ${bench.run} · live models · staged incidents` : "loading…"}</p>
        </Reveal>
      </section>

      {/* Numbered rows */}
      <section className="mx-auto max-w-[1000px] space-y-28 px-5 pt-32">
        <Row n="01" tag="neatlogs" title="It investigates like an engineer." body="Reads the failing traces, the deploy log and the diff, and cites every trace it used.">
          {hero ? (
            <div className="force-dark min-w-0">
              <IncidentReel events={hero.timeline} title={`nightly — ${hero.incident_id} · ${hero.name}`} />
            </div>
          ) : (
            <div className="grid h-[380px] place-items-center font-mono text-sm text-faint">loading…</div>
          )}
        </Row>
        <Row n="02" tag="Entire" title="It finds the prompt behind the bug." body="Follows the bad deploy to its commit, its Entire checkpoint, and the coding-agent prompt that wrote it.">
          <div className="rounded-xl border border-line p-5 shadow-soft" style={{ background: "#fff" }}>
            <div className="font-mono text-[11.5px] uppercase tracking-wider text-faint">commit → checkpoint → prompt</div>
            <p className="mt-3 line-clamp-4 text-[15px] leading-relaxed text-fg">
              “{hero?.coding_prompt ?? "Make refunds one step: payments already validates eligibility."}”
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="chip">release {hero?.culprit ?? "r46"}</span>
              {hero?.checkpoint && <span className="chip">checkpoint {hero.checkpoint.slice(0, 12)}</span>}
            </div>
            <div className="mt-4 rounded-lg bg-[#fff5ef] px-3 py-2 text-[13px] text-alert">⚠ The coding agent warned about this. Nobody read it.</div>
          </div>
        </Row>
        <Row n="03" tag="cfo.ai + Slack" title="It only wakes you when it’s worth it." body="Prices every minute of the incident. Fixes what’s reversible, then sends one message.">
          <div className="flex justify-center py-2">
            <Phone
              clock="03:08"
              notes={
                hero
                  ? [
                      {
                        title: "✅ Handled. No action needed tonight",
                        body: `${hero.name}: rolled back ${hero.seconds_detect_to_mitigate ?? "?"}s after detection. ${hero.replay}/${hero.replay_n} failed runs now pass. ~${money(hero.projected_loss_if_waiting)} saved. A fix PR is waiting for your approval.`,
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
        <Reveal>
          <h2 className="subhead text-center text-[30px] sm:text-[40px]">
            Fixes what’s <span className="text-muted">reversible</span>. Asks about what <span className="text-muted">isn’t</span>.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-line-strong p-6">
              <div className="font-mono text-[13px] text-muted">On its own</div>
              <ul className="mt-5 space-y-3 text-[15px] text-fg">
                <li>↩︎ Roll back a bad release</li>
                <li>⇄ Switch to a backup model</li>
                <li>⏻ Turn off a risky tool</li>
                <li>⧗ Stop a runaway loop</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-line-strong bg-card-2 p-6">
              <div className="flex items-center gap-2 font-mono text-[13px] text-muted">
                <SlackMark /> Asks you in Slack
              </div>
              <ul className="mt-5 space-y-3 text-[15px] text-fg">
                <li>✎ Ship a code fix (opens a PR)</li>
                <li>$ Refund or email customers</li>
                <li>✕ Delete data</li>
                <li>… anything your policy doesn’t allow</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1000px] px-5 pb-16 pt-32">
        <Reveal>
          <div className="dotgrid rounded-2xl border border-line px-6 py-20 text-center">
            <h2 className="subhead text-[32px] sm:text-[44px]">Go to sleep. It’s handled.</h2>
            <p className="mx-auto mt-3 max-w-[440px] text-muted">Connect an agent in five minutes and add Nightly to Slack.</p>
            <div className="mt-8 flex justify-center gap-3">
              <PrimaryLink href="/app">Get started</PrimaryLink>
              <GhostLink href="/docs">Read the docs</GhostLink>
            </div>
          </div>
        </Reveal>
        <div className="mt-16 overflow-hidden border-y border-line py-4">
          <Marquee
            reverse
            items={INTEGRATIONS.map((it) => (
              <span key={it.name} className="flex items-center gap-2 px-4 text-[14px] text-muted">
                <span className="text-fg">{it.icon}</span> {it.name}
              </span>
            ))}
          />
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span className="flex items-center gap-2">
            <Moon size={14} /> Nightly · neatHack 2026
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


/** The "with" card plays the real recorded incident step by step when it scrolls into view. */
function WithCard({ hero, run }: { hero?: BenchResult; run?: string | null }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const KINDS = ["detect", "diagnosis", "impact", "act", "verify", "page"];
  const LABEL: Record<string, string> = { detect: "detect", diagnosis: "cause", impact: "price", act: "fix", verify: "verify", page: "page" };
  const steps = (hero?.timeline ?? []).filter((e) => KINDS.includes(e.kind)).slice(0, 6);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || !steps.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(steps.length + 1);
      return;
    }
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown(n);
      if (n > steps.length) clearInterval(id);
    }, 650);
    return () => clearInterval(id);
  }, [inView, steps.length]);
  return (
    <div ref={ref} className="h-full rounded-2xl border border-[#111] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-[#111] px-2 py-1 font-mono text-[13px]" style={{ color: "#fff" }}>
          With Nightly
        </span>
        <span className="font-mono text-[12px] text-muted">● recorded · {run ?? "benchmark"}</span>
      </div>
      <div className="mt-6 space-y-2.5">
        {steps.slice(0, shown).map((e, i) => (
          <div key={i} className="slide-in flex gap-3 text-[13.5px] leading-snug">
            <span className="w-[56px] shrink-0 font-mono text-[11.5px] uppercase tracking-wide text-faint">{LABEL[e.kind]}</span>
            <span className="line-clamp-2 text-fg-2">{e.title}</span>
          </div>
        ))}
        {hero && shown > steps.length && (
          <div className="slide-in mt-3 rounded-lg bg-card-2 px-3 py-2.5 text-[13.5px] text-fg">
            ✅ Fixed {hero.seconds_detect_to_mitigate ?? "?"}s after detection · {money(hero.projected_loss_if_waiting)} saved
          </div>
        )}
      </div>
    </div>
  );
}

/** Animates the leading number of a stat ("$127,461", "6/6", "17s") when it scrolls into view. */
function CountUp({ text }: { text: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const m = text.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  const [v, setV] = useState(0);
  const target = m ? parseFloat(m[2].replace(/,/g, "")) : 0;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  useEffect(() => {
    if (!inView || !m) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target]);
  if (!m) return <span ref={ref}>{text}</span>;
  const shown = v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref}>
      {m[1]}
      {inView ? shown : "0"}
      {m[3]}
    </span>
  );
}

function Marquee({ items, reverse = false }: { items: ReactNode[]; reverse?: boolean }) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className={`${reverse ? "marquee-reverse" : "marquee"} flex w-max gap-2`}>
        {items}
        {items}
      </div>
    </div>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px] font-semibold">{children}</span>;
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
      <span className="relative mt-1.5 block h-px w-20 overflow-hidden bg-line-strong">
        <span className={`absolute top-0 h-px w-6 bg-fg ${reverse ? "flow-reverse" : "flow"}`} />
      </span>
    </div>
  );
}

function Row({ n, tag, title, body, children }: { n: string; tag: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-faint">{n}</span>
          <span className="chip">{tag}</span>
        </div>
        <h3 className="mt-4 text-[26px] font-normal tracking-tight text-fg">{title}</h3>
        <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{body}</p>
      </Reveal>
      <Reveal delay={150}>
        <div className="dotgrid min-w-0 rounded-2xl border border-line bg-card-2 p-4 sm:p-7">{children}</div>
      </Reveal>
    </div>
  );
}

/** Decorative dot tiles beside the hero; each column drifts at its own speed as you scroll. */
function SideTiles({ side, y }: { side: "left" | "right"; y: number }) {
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
  const speeds = side === "left" ? [0.18, 0.32, 0.12] : [0.14, 0.28, 0.2];
  return (
    <div className={`pointer-events-none absolute top-14 hidden gap-2 xl:flex ${side === "left" ? "left-0 -translate-x-6" : "right-0 translate-x-6"}`} aria-hidden>
      {cols.map((col, ci) => (
        <div key={ci} className="flex w-[78px] flex-col gap-2 will-change-transform" style={{ marginTop: col[0].o ?? 0, transform: `translateY(${-y * speeds[ci]}px)` }}>
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
