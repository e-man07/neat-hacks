"use client";

import type { ReactNode } from "react";
import { Moon } from "./ui";

export type PhoneNote = { title: string; body: string; time: string; tone?: "ok" | "alert" | "low" };

/** A lock-screen phone showing the pages Night Shift sends. */
export default function Phone({ notes, clock, footer }: { notes: PhoneNote[]; clock: string; footer?: ReactNode }) {
  return (
    <div className="force-dark relative mx-auto w-[260px] rounded-[38px] border border-white/15 bg-[#050506] p-3 shadow-[0_40px_120px_rgba(0,0,0,.7)]">
      <div className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="dotgrid relative h-[470px] overflow-hidden rounded-[30px] bg-gradient-to-b from-[#0b0d18] to-black px-3 pt-10">
        <div className="text-center">
          <div className="text-[11px] font-medium text-white/60">Saturday, October 11</div>
          <div className="text-[56px] font-light leading-none tracking-tight text-white">{clock.slice(0, 5)}</div>
        </div>
        <div className="mt-6 space-y-2">
          {notes.length === 0 && (
            <div className="mt-16 text-center text-[12px] text-white/35">No pages. Sleep well.</div>
          )}
          {notes.slice(0, 4).map((n, i) => (
            <div
              key={`${n.title}-${i}`}
              className="slide-in rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/50">
                <span className="grid h-4 w-4 place-items-center rounded bg-black text-white">
                  <Moon size={10} />
                </span>
                Night Shift <span className="ml-auto normal-case">{n.time}</span>
              </div>
              <div
                className="text-[12.5px] font-semibold"
                style={{ color: n.tone === "alert" ? "var(--alert)" : n.tone === "low" ? "var(--amber)" : "#fff" }}
              >
                {n.title}
              </div>
              <div className="mt-0.5 line-clamp-5 text-[11.5px] leading-snug text-white/75">{n.body}</div>
            </div>
          ))}
        </div>
        {footer && <div className="absolute inset-x-3 bottom-4">{footer}</div>}
      </div>
    </div>
  );
}
