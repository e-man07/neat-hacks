"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, GitHubMark } from "@/components/Marks";
import SlackPreview from "@/components/SlackPreview";
import type { HeroIncident } from "./data";
import "./landing.css";

type Step = { time: string; title: string; tag?: ReactNode; visual: ReactNode };

/** "3 AM": a sticky timeline on the left, one visual per step on the right, with parallax layers. */
export default function Story({ inc }: { inc: HeroIncident }) {
  const sec = useRef<HTMLElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = sec.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-49% 0px -50% 0px" },
    );
    panels.current.forEach((p) => p && io.observe(p));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => io.disconnect();
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        el.style.setProperty("--lp-p", p.toFixed(4));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const steps: Step[] = [
    {
      time: "03:07",
      title: "A release ships",
      visual: (
        <Card label="deploy log">
          <div className="space-y-2 font-mono text-[13px]">
            <Line k="release" v={<b className="text-fg">{inc.release}</b>} />
            <Line k="commit" v={inc.commit} />
            <Line k="written by" v="a Claude Code session" />
            <Line k="status" v={<span className="text-ok">HTTP 200 · all green</span>} />
          </div>
        </Card>
      ),
    },
    {
      time: "detected",
      title: "Nightly notices",
      tag: <Brand name="neatlogs" h={13} />,
      visual: (
        <Card label="neatlogs traces · outcomes">
          <div className="text-[17px] leading-snug text-alert">{inc.detect}.</div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              ["before", inc.correctBefore, "var(--fg)"],
              ["during", inc.correctDuring, "var(--alert)"],
              ["HTTP 200", 100, "var(--ok)"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl bg-card-2 p-3">
                <div className="text-[26px] tracking-tight" style={{ color: c as string }}>
                  {v}%
                </div>
                <div className="mt-1 font-mono text-[11px] text-faint">{l === "HTTP 200" ? "HTTP 200" : `correct, ${l}`}</div>
              </div>
            ))}
          </div>
        </Card>
      ),
    },
    {
      time: "cause",
      title: "Finds the prompt behind it",
      tag: <Brand name="entire" h={12} />,
      visual: (
        <Card label="commit → Entire checkpoint → prompt">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
            <span className="chip">{inc.release}</span>→<span className="chip">commit {inc.commit}</span>→<span className="chip">checkpoint {inc.checkpoint}</span>
          </div>
          <p className="mt-4 text-[17px] leading-relaxed text-fg">“{inc.prompt}”</p>
          <div className="mt-4 rounded-lg bg-[#fff4ef] px-3 py-2 text-[13px] text-alert">The coding agent warned about this. Nobody read it.</div>
        </Card>
      ),
    },
    {
      time: "priced",
      title: "Puts a price on it",
      tag: <Brand name="cfo" h={14} />,
      visual: (
        <Card label="cfo.ai unit economics">
          <div className="text-[44px] leading-none tracking-[-0.04em] text-fg">{inc.atRisk}</div>
          <div className="mt-2 text-[14px] text-muted">at risk before anyone wakes up · {inc.lossPerMin} per minute</div>
        </Card>
      ),
    },
    {
      time: `+${Math.round(Number(inc.secondsToContain))} s`,
      title: "Rolls it back",
      visual: (
        <Card label="policy · reversible, pre-approved">
          <div className="flex items-center gap-3 text-[22px] tracking-tight text-fg">
            <span className="line-through decoration-alert decoration-2">{inc.release}</span>
            <span className="text-faint">→</span>
            <span className="text-ok">{inc.previous}</span>
          </div>
          <div className="mt-2 text-[14px] text-muted">{inc.secondsToContain} s after detection. Undo is one click.</div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {["↩ Roll back", "⇄ Model failover", "⏻ Kill switch", "⧗ Step cap"].map((c, i) => (
              <span key={c} className={`chip ${i === 0 ? "!bg-[#111]" : ""}`} style={i === 0 ? { color: "#fff" } : undefined}>
                {c}
              </span>
            ))}
          </div>
        </Card>
      ),
    },
    {
      time: "verified",
      title: "Proves the fix",
      tag: <Brand name="neatlogs" h={13} />,
      visual: (
        <Card label="verification">
          <div className="space-y-3 text-[15px]">
            <Check>Replayed the failed runs: {inc.replay} pass</Check>
            <Check>Correct answers back to {inc.correctAfter}%</Check>
          </div>
          <div className="mt-5 text-[13px] text-muted">If a check fails, Nightly undoes its own fix and pages you.</div>
        </Card>
      ),
    },
    {
      time: "03:08",
      title: "Sends one message",
      tag: (
        <span className="inline-flex items-center gap-1">
          Slack · <GitHubMark size={12} />
        </span>
      ),
      visual: (
        <div className="flex justify-center">
          <SlackPreview
            agent={`Harbor · ${inc.name}`}
            incident={inc.incidentId}
            release={inc.release}
            seconds={String(Math.round(Number(inc.secondsToContain)))}
            replay={inc.replay}
            saved={inc.prevented}
          />
        </div>
      ),
    },
  ];

  const heading = (
    <>
      <div className="eyebrow">THE 3 AM INCIDENT · RECORDED</div>
      <h2 className="subhead mt-3 text-[34px] sm:text-[44px]">
        One bad release. <span className="text-muted">Handled in seconds.</span>
      </h2>
    </>
  );

  return (
    <section id="how" ref={sec} className="relative scroll-mt-20 overflow-clip">
      {/* parallax layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="lp-parallax-1 lp-blob absolute left-[-10%] top-[10%] h-[420px] w-[420px] bg-[rgba(47,91,211,0.08)]" />
        <div className="lp-parallax-2 lp-blob absolute right-[-8%] top-[45%] h-[380px] w-[380px] bg-[rgba(224,80,43,0.07)]" />
        <div className="lp-parallax-3 lp-blob absolute bottom-[5%] left-[30%] h-[360px] w-[360px] bg-[rgba(24,128,74,0.07)]" />
        <div className="lp-parallax-1 dotgrid absolute right-[6%] top-[20%] hidden h-[220px] w-[160px] rounded-2xl opacity-60 lg:block" />
        <div className="lp-parallax-3 dotgrid absolute left-[4%] top-[70%] hidden h-[160px] w-[120px] rounded-2xl opacity-60 lg:block" />
      </div>

      {/* desktop: both columns stick while invisible triggers drive the active step */}
      <div className="relative hidden lg:block" style={{ height: `${steps.length * 62}vh` }}>
        <div aria-hidden className="absolute inset-0 flex flex-col">
          {steps.map((s, i) => (
            <div
              key={s.title}
              ref={(n) => {
                panels.current[i] = n;
              }}
              data-i={i}
              className="flex-1"
            />
          ))}
        </div>
        <div className="sticky top-0 mx-auto grid h-screen max-w-[1120px] grid-cols-[380px_minmax(0,1fr)] items-center gap-16 px-5 pt-16">
          <div>
            {heading}
            <ol className="relative mt-8">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-line-strong" />
              <span
                className="absolute left-[5px] top-3 w-px bg-fg transition-all duration-500"
                style={{ height: `calc(${(active / (steps.length - 1)) * 100}% - ${(active / (steps.length - 1)) * 24}px)` }}
              />
              {steps.map((s, i) => (
                <li key={s.title} className="relative flex items-center gap-4 py-2">
                  <span
                    className="relative z-10 h-[11px] w-[11px] rounded-full border-2 transition-colors duration-300"
                    style={{ borderColor: i <= active ? "var(--fg)" : "var(--line-strong)", background: i < active ? "var(--fg)" : "var(--bg)" }}
                  />
                  <span className={`w-[70px] font-mono text-[12px] transition-colors ${i === active ? "text-fg" : "text-faint"}`}>{s.time}</span>
                  <span className={`text-[15px] transition-colors ${i === active ? "text-fg" : "text-muted"}`}>{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative">
            <div className="lp-parallax-3 pointer-events-none absolute -inset-8 rounded-[28px] dotgrid opacity-50" aria-hidden />
            <div key={active} className="lp-pop relative">
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[12px] text-faint">
                  {String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </span>
                {steps[active].tag && <span className="chip">{steps[active].tag}</span>}
              </div>
              {steps[active].visual}
            </div>
          </div>
        </div>
      </div>

      {/* mobile / tablet: a simple stacked story */}
      <div className="relative mx-auto max-w-[640px] px-5 lg:hidden">
        {heading}
        <div className="mt-8 space-y-10">
          {steps.map((s) => (
            <div key={s.title}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[12px] text-faint">{s.time}</span>
                <span className="text-[16px] font-medium text-fg">{s.title}</span>
                {s.tag && <span className="chip">{s.tag}</span>}
              </div>
              {s.visual}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-strong bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_44px_-14px_rgba(17,17,17,0.16)] sm:p-7">
      <div className="mb-4 font-mono text-[11.5px] uppercase tracking-wider text-faint">{label}</div>
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-[90px] shrink-0 text-faint">{k}</span>
      <span className="min-w-0 text-fg-2">{v}</span>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-fg">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-[11px]" style={{ color: "#fff" }}>
        ✓
      </span>
      {children}
    </div>
  );
}
