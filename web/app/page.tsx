import Link from "next/link";
import type { ReactNode } from "react";
import HeroVideo from "@/components/HeroVideo";
import HeroIncident from "@/components/landing/HeroIncident";
import LogoMarquee from "@/components/landing/LogoMarquee";
import ProofStrip from "@/components/landing/ProofStrip";
import Story from "@/components/landing/Story";
import { costRange, heroIncident } from "@/components/landing/data";
import "@/components/landing/landing.css";
import { Reveal } from "@/components/Motion";
import Nav from "@/components/Nav";
import { Arrow, Moon } from "@/components/ui";

export default function Home() {
  const inc = heroIncident();
  const cost = costRange();

  return (
    <main className="min-h-screen overflow-x-clip bg-bg">
      <Nav />

      {/* Hero: fully server-rendered, nothing starts hidden */}
      <section className="relative">
        <div aria-hidden className="lp-hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="lp-grid pointer-events-none absolute inset-x-0 top-0 h-[720px]" />
        <div className="relative mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-12 lg:pb-24">
          <div>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-[12px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /> <span className="sm:hidden">On-call for AI agents</span><span className="hidden sm:inline">The on-call engineer for your AI agents</span>
            </span>
            <h1 className="headline mt-6 text-[40px] sm:text-[56px] lg:text-[54px]">
              Your AI agent broke <span className="whitespace-nowrap">at 3 AM.</span>
              <br />
              <span className="lp-gradient-text">Nightly fixed it before you woke&nbsp;up.</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-muted">
              It spots the failure your 200s hide, rolls back the change behind it, proves the fix, and pages you once in Slack.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sandbox"
                className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-3 text-[15px] font-medium shadow-[0_8px_24px_-8px_rgba(17,17,17,0.5)] transition hover:-translate-y-px hover:bg-[#2a2a2a]"
                style={{ color: "#fff" }}
              >
                Run the 3 AM incident <Arrow />
              </Link>
              <Link href="/app" className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg px-5 py-3 text-[15px] font-medium text-fg transition hover:bg-card-2">
                Connect your agent
              </Link>
            </div>
            <Link href="/judge" className="mt-5 inline-flex items-center gap-1.5 text-[14px] text-muted underline-offset-4 transition hover:text-fg hover:underline">
              For judges: every criterion and its evidence <Arrow />
            </Link>
          </div>
          <div className="pb-6 sm:pb-0">
            <HeroIncident inc={inc} />
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="mx-auto max-w-[1180px] px-5">
        <ProofStrip
          stats={[
            { pre: "13–", from: 13, n: 21, post: " s", label: "to contain", sub: "from detection, no human awake" },
            { n: 6, post: "/6", label: "incidents handled", sub: "planted in a live agent" },
            { pre: "4/6 → ", from: 4, n: 6, post: "/6", label: "it got better", sub: "between benchmark runs" },
            { n: 5, post: " min", label: "blind incident caught", sub: "a change nobody planned, deployed unread" },
          ]}
        />
        <p className="mt-3 font-mono text-[11.5px] text-faint">
          live agents · real model and tool calls · traced in neatlogs · {cost} per investigation
        </p>
      </section>

      {/* Built on */}
      <section className="mt-20">
        <div className="eyebrow text-center">BUILT ON THE TOOLS YOU ALREADY USE</div>
        <div className="mt-6">
          <LogoMarquee />
        </div>
      </section>

      {/* The 3 AM story */}
      <div className="mt-16 sm:mt-24 lg:mt-0">
        <Story inc={inc} />
      </div>

      {/* With / without */}
      <section className="mx-auto max-w-[1000px] px-5 pt-24 sm:pt-32">
        <Reveal>
          <h2 className="subhead text-center text-[32px] sm:text-[44px]">
            Monitoring tells you. <span className="text-muted">Nightly handles it.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-line bg-card-2 p-6 sm:p-7">
              <div className="font-mono text-[12.5px] text-muted">Without Nightly</div>
              <ul className="mt-5 space-y-3.5 text-[15.5px] text-fg-2">
                <Item mark="✕" tone="var(--alert)">No alert. Every request is 200.</Item>
                <Item mark="✕" tone="var(--alert)">{inc.atRisk} lost before anyone wakes up.</Item>
                <Item mark="✕" tone="var(--alert)">Postmortem by hand. Nobody finds the prompt.</Item>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-[#111] bg-card p-6 shadow-soft sm:p-7">
              <div className="font-mono text-[12.5px] text-fg">With Nightly</div>
              <ul className="mt-5 space-y-3.5 text-[15.5px] text-fg">
                <Item mark="✓" tone="var(--ok)">Contained 13–21 s after detection.</Item>
                <Item mark="✓" tone="var(--ok)">Traced to the commit and the prompt behind it.</Item>
                <Item mark="✓" tone="var(--ok)">One Slack message. You approve the fix PR.</Item>
              </ul>
            </div>
          </Reveal>
        </div>
        <p className="mt-5 text-center text-[13.5px] text-muted">
          Reversible fixes on its own: rollback, model failover, kill switch, step cap. Anything irreversible waits for a human.
        </p>
      </section>

      {/* SDK */}
      <section className="mx-auto grid max-w-[1000px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 pt-24 sm:pt-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <h2 className="subhead text-[30px] sm:text-[38px]">
            Five minutes <span className="text-muted">to connect.</span>
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted">One SDK in your agent. Zero dependencies, fails open. Nightly steers the release, model and kill switches it reads.</p>
          <div className="mt-6">
            <code className="chip !px-3 !py-1.5 !text-[13.5px]">pip install nightly-sdk</code>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <pre className="force-dark window overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75]">
            <code>
              <span style={{ color: "#b69cff" }}>from</span> nightly_sdk <span style={{ color: "#b69cff" }}>import</span> Nightly
              {"\n\n"}ns = Nightly()
              {"\n"}prompt = load_prompt(ns.<span style={{ color: "#7aa2ff" }}>release</span>(<span style={{ color: "#4ade80" }}>&quot;v12&quot;</span>))
              {"\n"}model = ns.<span style={{ color: "#7aa2ff" }}>model</span>(<span style={{ color: "#4ade80" }}>&quot;claude-haiku&quot;</span>)
              {"\n"}max_steps = ns.<span style={{ color: "#7aa2ff" }}>max_steps</span>(8)
              {"\n\n"}ns.<span style={{ color: "#7aa2ff" }}>record</span>(<span style={{ color: "#4ade80" }}>&quot;ok&quot;</span> <span style={{ color: "#b69cff" }}>if</span> result.ok <span style={{ color: "#b69cff" }}>else</span>{" "}
              <span style={{ color: "#4ade80" }}>&quot;failed&quot;</span>)
              {"\n"}ns.<span style={{ color: "#7aa2ff" }}>serve_replays</span>(<span style={{ color: "#b69cff" }}>lambda</span> t: handle(t, dry_run=<span style={{ color: "#b69cff" }}>True</span>))
            </code>
          </pre>
        </Reveal>
      </section>

      {/* Explainer */}
      <section className="mx-auto max-w-[1000px] px-5 pt-24 sm:pt-32">
        <Reveal>
          <h2 className="subhead text-center text-[28px] sm:text-[36px]">
            Watch the <span className="text-muted">67-second explainer</span>
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <HeroVideo />
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1000px] px-5 pb-12 pt-24 sm:pt-32">
        <div className="relative overflow-hidden rounded-3xl border border-line px-6 py-20 text-center">
          <div aria-hidden className="lp-hero-glow absolute inset-0" />
          <div aria-hidden className="lp-grid absolute inset-0" />
          <div className="relative">
            <h2 className="subhead text-[34px] sm:text-[48px]">Go to sleep. It’s handled.</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/sandbox" className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-3 text-[15px] font-medium transition hover:bg-[#2a2a2a]" style={{ color: "#fff" }}>
                Run the 3 AM incident <Arrow />
              </Link>
              <Link href="/app" className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg px-5 py-3 text-[15px] font-medium text-fg transition hover:bg-card-2">
                Connect your agent
              </Link>
            </div>
          </div>
        </div>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span className="flex items-center gap-2">
            <Moon size={14} /> Nightly · neatHack 2026
          </span>
          <span className="flex flex-wrap gap-5">
            <Link href="/docs" className="hover:text-fg">Docs</Link>
            <Link href="/benchmark" className="hover:text-fg">Benchmark</Link>
            <Link href="/judge" className="hover:text-fg">For judges</Link>
            <a href="https://github.com/e-man07/nightly" className="hover:text-fg">GitHub</a>
          </span>
        </footer>
      </section>
    </main>
  );
}

function Item({ mark, tone, children }: { mark: string; tone: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]" style={{ background: tone, color: "#fff" }}>
        {mark}
      </span>
      <span>{children}</span>
    </li>
  );
}
