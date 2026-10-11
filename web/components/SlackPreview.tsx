"use client";

import { useState } from "react";

/** A faithful preview of the one Slack message Nightly sends per incident (same blocks as backend/product/slack.py). */
export default function SlackPreview({
  agent,
  incident,
  release,
  seconds,
  replay,
  saved,
}: {
  agent: string;
  incident: string;
  release: string;
  seconds: string;
  replay: string;
  saved: string;
}) {
  const [state, setState] = useState<"open" | "approved" | "undone">("open");
  return (
    <div className="w-full max-w-[460px] rounded-xl border border-line-strong bg-[#fff] p-4 text-left shadow-soft" style={{ color: "#1d1c1d" }}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nightly.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-md bg-[#2a2340] object-contain p-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14.5px] font-bold">Nightly</span>
            <span className="rounded-[3px] bg-[#e8e8e8] px-1 text-[10px] font-semibold text-[#616061]">APP</span>
            <span className="text-[12px] text-[#616061]">3:08 AM</span>
          </div>
          <div className="mt-1 text-[15px] font-bold leading-snug">✅ Handled. No action needed tonight</div>
          <div className="mt-1.5 space-y-1 text-[13.5px] leading-relaxed">
            <p>
              <b>Cause:</b> release <code className="rounded bg-[#f3f3f3] px-1 text-[12px] text-[#c0124e]">{release}</code>, written by a
              Claude Code session. Its Entire checkpoint shows the coding agent warned about it.
            </p>
            <p>
              <b>Contained:</b> rolled back {seconds}s after detection. <b>Verified:</b> {replay} failed tickets now pass.
            </p>
            <p>
              <b>Saved:</b> ~{saved} that would have been lost before anyone woke up.
            </p>
          </div>
          <div className="mt-1.5 text-[12px] text-[#616061]">
            <b>{agent}</b> · <code>{incident}</code> · status <b>{state === "undone" ? "ESCALATED" : "MONITORING"}</b>
          </div>
          {state === "open" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setState("approved")} className="rounded-md bg-[#007a5a] px-3 py-1.5 text-[13px] font-bold text-white transition hover:bg-[#148567]" style={{ color: "#fff" }}>
                Approve fix
              </button>
              <button onClick={() => setState("undone")} className="rounded-md border border-[#e01e5a] px-3 py-1.5 text-[13px] font-bold text-[#e01e5a] transition hover:bg-[#fdf2f5]">
                Undo containment
              </button>
              <a href="/sandbox" className="rounded-md border border-[#ccc] px-3 py-1.5 text-[13px] font-bold transition hover:bg-[#f8f8f8]">
                Open in Nightly
              </a>
            </div>
          ) : (
            <div className="mt-3 rounded-md bg-[#f8f8f8] px-3 py-2 text-[13px]">
              {state === "approved"
                ? "✅ Approved by you. Nightly opened a revert PR with the postmortem and a regression test."
                : "↩︎ Undone by you. The previous release is back in production and Nightly is watching it."}
              <button onClick={() => setState("open")} className="ml-2 text-[12px] text-[#1264a3] hover:underline">
                reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
