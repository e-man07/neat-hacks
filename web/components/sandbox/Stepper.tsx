"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Brand, SlackMark } from "@/components/Marks";

export const STEPS: { label: string; caption: string; tag?: ReactNode }[] = [
  { label: "Ships", caption: "A coding agent ships a change to Harbor." },
  { label: "Noticed", caption: "Nightly notices customers getting refunds they shouldn’t.", tag: <Brand name="neatlogs" h={10} /> },
  { label: "Cause", caption: "It traces the damage back to the prompt that caused it.", tag: <Brand name="entire" h={10} /> },
  { label: "Priced", caption: "It works out what waiting until morning would cost.", tag: <Brand name="cfo" h={11} /> },
  { label: "Contained", caption: "It undoes the change on its own, because the rules allow it." },
  {
    label: "Proved",
    caption: "It replays the bad chats to prove the fix, then pages you once.",
    tag: (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
        <SlackMark size={10} /> Slack
      </span>
    ),
  },
];

/** Six-step progress bar. Completed steps can be clicked to revisit them. */
export default function Stepper({
  reached,
  viewing,
  live,
  onSelect,
}: {
  reached: number; // highest step shown so far (-1 = not started)
  viewing: number;
  live: boolean; // the current step is still in progress
  onSelect: (i: number) => void;
}) {
  return (
    <ol className="grid grid-cols-6" aria-label="Incident progress">
      {STEPS.map((s, i) => {
        const done = i < reached || (i === reached && !live);
        const current = i === reached && live;
        const clickable = i <= reached;
        const selected = i === viewing && reached >= 0;
        return (
          <li key={s.label} className="relative min-w-0">
            {i > 0 && (
              <span
                aria-hidden
                className="absolute top-[13px] h-[2px] -translate-y-1/2 rounded-full transition-colors duration-500"
                style={{ background: i <= reached ? "var(--fg)" : "var(--line-strong)", left: "calc(-50% + 17px)", right: "calc(50% + 17px)" }}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(i)}
              aria-current={selected ? "step" : undefined}
              className="group relative flex w-full flex-col items-center gap-1.5 text-center disabled:cursor-default"
            >
              <span
                className={`relative grid h-[26px] w-[26px] place-items-center rounded-full border-2 text-[11px] font-semibold transition-all duration-300 ${
                  done
                    ? "border-fg bg-fg text-[var(--bg)]"
                    : current
                      ? "border-fg bg-[var(--bg)] text-fg"
                      : "border-line-strong bg-[var(--bg)] text-faint"
                } ${selected ? "ring-4 ring-[color-mix(in_srgb,var(--fg)_12%,transparent)]" : ""} ${clickable ? "group-hover:scale-110" : ""}`}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                {current && <span className="absolute inset-[-5px] animate-ping rounded-full border border-fg/30 motion-reduce:hidden" />}
              </span>
              <span
                className={`truncate text-[11px] font-medium sm:text-[12.5px] ${
                  selected ? "text-fg" : i <= reached ? "text-fg-2" : "text-faint"
                }`}
              >
                {s.label}
              </span>
              <span className={`hidden h-3 items-center sm:flex ${i <= reached ? "opacity-90" : "opacity-40 grayscale"}`}>{s.tag}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
