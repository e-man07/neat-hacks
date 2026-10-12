"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { money, type Conversation } from "@/lib/api";
import { plain } from "./text";

export const OUTCOME: Record<string, { label: string; color: string; bad: boolean }> = {
  correct: { label: "handled right", color: "var(--ok)", bad: false },
  escalated: { label: "passed to a human", color: "var(--info)", bad: false },
  wrong_refund: { label: "refunded, shouldn’t have", color: "var(--alert)", bad: true },
  missed_refund: { label: "refused a valid refund", color: "var(--amber)", bad: true },
  failed: { label: "errored", color: "var(--alert)", bad: true },
};

/** Compact, plain-language feed of the customer chats Harbor is answering. */
export default function ChatFeed({ items, lost, lostLabel, running }: { items: Conversation[]; lost: number; lostLabel: string; running: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="text-[13px] font-medium text-fg">Live customer chats</div>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-ok" : "bg-faint"}`} />
          {running ? "live" : "paused"}
        </span>
      </div>
      <div className="max-h-[420px] min-h-[220px] flex-1 overflow-y-auto overflow-x-hidden">
        {items.length === 0 && (
          <div className="p-6 text-center text-[13px] text-muted">Chats appear here once the demo starts.</div>
        )}
        <AnimatePresence initial={false}>
          {items.map((c) => {
            const o = OUTCOME[c.outcome] ?? { label: c.outcome, color: "var(--faint)", bad: false };
            return (
              <motion.div
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 truncate text-[13px] text-fg">“{plain(c.message)}”</div>
                  <span className="shrink-0 text-[11.5px] font-medium" style={{ color: o.color }}>
                    {o.bad ? "✗" : "✓"} {o.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                  <span className="min-w-0 flex-1 truncate">{c.error ? `Error: ${c.error}` : plain(c.reply)}</span>
                  {c.loss_usd > 0 && <span className="shrink-0 font-mono text-[11.5px] text-alert">−{money(c.loss_usd, 2)}</span>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-line px-4 py-3">
        <span className="text-[12.5px] text-muted">{lostLabel}</span>
        <span className={`font-mono text-[20px] tabular-nums ${lost > 0 ? "text-alert" : "text-fg"}`}>{money(lost, 2)}</span>
      </div>
    </div>
  );
}
