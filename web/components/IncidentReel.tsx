"use client";

import { useEffect, useMemo, useState } from "react";
import { WindowFrame } from "./ui";

export type ReelEvent = { t: number; kind: string; title: string };

const KIND_STYLE: Record<string, { tag: string; color: string }> = {
  detect: { tag: "DETECT", color: "var(--alert)" },
  investigate: { tag: "INVESTIGATE", color: "var(--info)" },
  step: { tag: "TOOL", color: "var(--faint)" },
  diagnosis: { tag: "DIAGNOSIS", color: "var(--violet)" },
  impact: { tag: "PRICE", color: "var(--amber)" },
  decide: { tag: "POLICY", color: "var(--info)" },
  propose: { tag: "PROPOSE", color: "var(--faint)" },
  act: { tag: "ACT", color: "var(--ok)" },
  verify: { tag: "VERIFY", color: "var(--ok)" },
  regression: { tag: "TEST", color: "var(--faint)" },
  detection: { tag: "NEATLOGS", color: "var(--faint)" },
  page: { tag: "PAGE", color: "var(--amber)" },
  defer: { tag: "DEFER", color: "var(--amber)" },
  resolved: { tag: "RESOLVED", color: "var(--ok)" },
  undo: { tag: "UNDO", color: "var(--alert)" },
};

function clockAt(base: string, seconds: number) {
  const [h, m] = base.split(":").map(Number);
  const total = h * 3600 + m * 60 + 12 + Math.round(seconds);
  const hh = Math.floor(total / 3600) % 24;
  const mm = Math.floor(total / 60) % 60;
  const ss = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Replays a real incident timeline from the benchmark evidence, line by line, on loop. */
export default function IncidentReel({ events, title, base = "03:07" }: { events: ReelEvent[]; title: string; base?: string }) {
  const shown = useMemo(
    () => events.filter((e) => !(e.kind === "step" && e.title.startsWith("think"))).slice(0, 18),
    [events],
  );
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!shown.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(shown.length);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      if (i > shown.length + 6) i = 0;
      setN(Math.min(i, shown.length));
    }, 650);
    return () => clearInterval(t);
  }, [shown]);

  return (
    <WindowFrame title={title} className="w-full min-w-0">
      <div className="h-[340px] overflow-hidden px-4 py-3 font-mono text-[12px] leading-[1.55]">
        {shown.slice(0, n).map((e, i) => {
          const s = KIND_STYLE[e.kind] ?? { tag: e.kind.toUpperCase(), color: "var(--faint)" };
          const text = e.kind === "step" ? e.title.replace(/^(\w+):\s*/, "$1 → ") : e.title;
          return (
            <div key={i} className="slide-in flex min-w-0 gap-3">
              <span className="shrink-0 text-white/30">{clockAt(base, e.t)}</span>
              <span className="w-[86px] shrink-0" style={{ color: s.color }}>
                {s.tag}
              </span>
              <span className={`min-w-0 ${e.kind === "step" ? "text-white/45" : "text-white/85"} truncate`}>{text}</span>
            </div>
          );
        })}
        {n < shown.length && <div className="caret text-white/50" />}
      </div>
    </WindowFrame>
  );
}
