"use client";

import { useEffect, useState } from "react";

/**
 * The product in one loop: an agent's runs go bad after a deploy, and the Night Shift Slack message
 * updates as it detects, traces, rolls back and verifies — then asks a human only for the fix PR.
 */
const PHASES = [
  { at: 0, key: "quiet" },
  { at: 3, key: "deploy" },
  { at: 5, key: "detect" },
  { at: 7, key: "trace" },
  { at: 9, key: "rollback" },
  { at: 11, key: "verify" },
] as const;
const LOOP_S = 16;

type Run = { id: number; q: string; ok: boolean; note: string };
const QUESTIONS = [
  "How many steps can a funnel have?",
  "Can I get a refund on our annual plan?",
  "Which identity providers work with SSO?",
  "How long is data kept on Growth?",
  "How do I read data with an API key?",
  "What happens if we exceed the event cap?",
];

export default function HeroDemo() {
  const [t, setT] = useState(0); // seconds into the loop (0.5 s ticks)
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(13);
      setRuns(QUESTIONS.slice(0, 4).map((q, i) => ({ id: i, q, ok: true, note: "s2 · 1.1s" })));
      return;
    }
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      const sec = (n / 2) % LOOP_S;
      setT(sec);
      if (n % 2 === 0) {
        const bad = sec >= 4 && sec < 9.5;
        setRuns((r) =>
          [
            {
              id: n,
              q: QUESTIONS[(n / 2) % QUESTIONS.length],
              ok: !bad || (n / 2) % 3 === 0,
              note: bad ? "s3 · tool error: doc not found" : `${sec >= 9.5 ? "s2" : sec >= 3 ? "s3" : "s2"} · ${(0.9 + ((n * 7) % 9) / 10).toFixed(1)}s`,
            },
            ...r,
          ].slice(0, 5),
        );
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const phase = [...PHASES].reverse().find((p) => t >= p.at)?.key ?? "quiet";
  const idx = PHASES.findIndex((p) => p.key === phase);
  const release = t >= 3 && t < 9 ? "s3" : "s2";
  const failing = t >= 4 && t < 9.5;

  return (
    <div className="dotgrid relative rounded-2xl border border-line bg-card-2 p-3 shadow-soft sm:p-5">
      <div className="grid gap-3 text-left md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Agent */}
        <div className="h-[258px] min-w-0 overflow-hidden rounded-xl border border-line bg-white p-4" style={{ background: "#fff" }}>
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-medium text-fg">Scout · docs assistant</div>
            <span className={`chip transition-colors ${failing ? "text-alert" : "text-ok"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${failing ? "bg-alert pulse-alert" : "bg-ok"}`} />
              {failing ? "degraded" : "healthy"}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-faint">
            production · release <span className={`transition-colors ${release === "s3" ? "text-alert" : "text-fg"}`}>{release}</span> · traced by neatlogs
          </div>
          {phase === "deploy" && (
            <div className="slide-in mt-3 rounded-md bg-chip px-2.5 py-1.5 font-mono text-[11.5px] text-fg-2">
              ⤴ deploy s3 · “get ready for the docs migration” · by Claude Code
            </div>
          )}
          <div className="mt-3 space-y-1.5">
            {runs.map((r) => (
              <div key={r.id} className="slide-in flex items-center gap-2 text-[12.5px]">
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${r.ok ? "bg-ok/15 text-ok" : "bg-alert/15 text-alert"}`}>
                  {r.ok ? "✓" : "✕"}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg-2">{r.q}</span>
                <span className={`shrink-0 font-mono text-[10.5px] ${r.ok ? "text-faint" : "text-alert"}`}>{r.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slack */}
        <div className="min-h-[258px] min-w-0 rounded-xl border border-line bg-white p-4" style={{ background: "#fff" }}>
          <div className="flex items-center gap-2 border-b border-line pb-2.5 text-[12.5px] text-muted">
            <SlackMark /> <span className="font-medium text-fg">#incidents</span> · Slack
          </div>
          <div className="mt-3 flex gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#111]" style={{ color: "#fff" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
                <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill="currentColor" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px]">
                <span className="font-semibold text-fg">Night Shift</span> <span className="rounded bg-chip px-1 text-[10px] text-muted">APP</span>{" "}
                <span className="text-[11px] text-faint">03:08 AM</span>
              </div>
              {idx < 2 ? (
                <p className="mt-1 text-[13px] text-muted">All quiet. Watching Scout, Harbor and 1 more agent.</p>
              ) : (
                <div className="mt-1.5 space-y-1.5 text-[13px] leading-snug">
                  <Step on={idx >= 2} done={idx > 2} text="Tool errors in 30% of Scout's runs since s3" icon="🔴" />
                  <Step on={idx >= 3} done={idx > 3} text="Cause: release s3, commit c42532d · prompt found via Entire" icon="🔎" />
                  <Step on={idx >= 4} done={idx > 4} text="Rolled back s3 → s2 automatically · $11/min stopped" icon="↩" />
                  <Step on={idx >= 5} done text="Verified: 3/3 failed questions now pass" icon="✅" />
                  {idx >= 5 && (
                    <div className="slide-in flex flex-wrap gap-2 pt-1.5">
                      <span className="rounded-md bg-[#111] px-2.5 py-1 text-[12px] font-medium" style={{ color: "#fff" }}>
                        Approve fix PR
                      </span>
                      <span className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-fg">Undo rollback</span>
                      <span className="self-center text-[11.5px] text-faint">the PR waits for you</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* progress */}
      <div className="mt-3 flex items-center gap-1.5 px-1 font-mono text-[10.5px] text-faint">
        {["watch", "deploy", "detect", "trace", "contain", "verify"].map((s, i) => (
          <span key={s} className={`flex items-center gap-1.5 transition-colors ${i <= idx ? "text-fg" : ""}`}>
            {i > 0 && <span className={`h-px w-4 sm:w-8 ${i <= idx ? "bg-fg" : "bg-line-strong"}`} />}
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Step({ on, done, text, icon }: { on: boolean; done?: boolean; text: string; icon: string }) {
  if (!on) return null;
  return (
    <div className="slide-in flex gap-2">
      <span className="w-4 shrink-0 text-center">{icon}</span>
      <span className={done ? "text-fg-2" : "text-fg"}>
        {text}
        {!done && <span className="caret text-faint" />}
      </span>
    </div>
  );
}

export function SlackMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="9.5" y="1.5" width="4" height="10" rx="2" fill="#36C5F0" />
      <rect x="12.5" y="9.5" width="10" height="4" rx="2" fill="#2EB67D" />
      <rect x="10.5" y="12.5" width="4" height="10" rx="2" fill="#ECB22E" />
      <rect x="1.5" y="10.5" width="10" height="4" rx="2" fill="#E01E5A" />
    </svg>
  );
}

export function GitHubMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
