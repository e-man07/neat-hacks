"use client";

import { OUTCOME_COLOR, clockTime, money, type Conversation } from "@/lib/api";
import { Label } from "../ui";
import { plain } from "../sandbox/text";

const LABEL: Record<string, string> = {
  correct: "resolved",
  escalated: "to human",
  wrong_refund: "wrong refund",
  missed_refund: "missed refund",
  failed: "failed",
};

export default function TrafficFeed({ items, offset = 0 }: { items: Conversation[]; offset?: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Label>live customer conversations</Label>
        <span className="font-mono text-[11px] text-white/35">{items.length} shown</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-6 text-center text-[13px] text-white/40">No traffic yet. Start traffic in the controls.</div>
        )}
        {items.map((c) => {
          const color = OUTCOME_COLOR[c.outcome] ?? "var(--faint)";
          return (
            <div key={c.id} className="slide-in border-b border-white/[0.04] px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[10.5px] text-white/35">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                <span>{clockTime(c.ts, offset)}</span>
                <span>{c.release}</span>
                <span className="truncate">{c.model}</span>
                <span className="ml-auto uppercase" style={{ color }}>
                  {LABEL[c.outcome] ?? c.outcome}
                  {c.loss_usd > 0 ? ` · −${money(c.loss_usd, 2)}` : ""}
                </span>
              </div>
              <div className="mt-1 truncate text-[12.5px] text-white/80">“{c.message}”</div>
              <div className="truncate text-[12px] text-white/40">{c.error ? `⚠ ${c.error}` : plain(c.reply)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
