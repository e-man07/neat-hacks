"use client";

import { useEffect, useRef, useState } from "react";
import "./landing.css";

type Stat = { pre?: string; from?: number; n: number; post: string; label: string; sub: string };

/** Big proof numbers. The real values are always shown (a count-up would flash smaller, wrong-looking
 *  numbers like "2/6" in the first frames); on view each cell fades and lifts in, staggered. */
export default function ProofStrip({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const x = Math.min(1, (now - start) / 900);
          setK(1 - Math.pow(1 - x, 3));
          if (x < 1) raf = requestAnimationFrame(step);
        };
        setK(0);
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      {stats.map((s, i) => {
        const t = Math.min(1, Math.max(0, k * 1.6 - i * 0.2)); // stagger the four cells
        return (
        <div key={s.label} className="bg-bg p-4 sm:p-7">
          <div
            className="whitespace-nowrap text-[26px] leading-none tracking-[-0.04em] text-fg tabular-nums sm:text-[48px]"
            style={{ opacity: 0.25 + 0.75 * t, transform: `translateY(${(1 - t) * 10}px)` }}
          >
            {s.pre}
            {s.n}
            {s.post}
          </div>
          <div className="mt-3 text-[14px] font-medium text-fg">{s.label}</div>
          <div className="mt-1 text-[12.5px] leading-snug text-muted">{s.sub}</div>
        </div>
        );
      })}
    </div>
  );
}
