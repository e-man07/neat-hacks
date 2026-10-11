"use client";

import { useState } from "react";
import { post, type Release, type State } from "@/lib/api";
import { Button, Label } from "../ui";

export default function Controls({ state, releases, onChange }: { state: State | null; releases: Release[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    fn()
      .catch((e) => alert(String(e)))
      .finally(() => {
        setBusy(null);
        onChange();
      });
  };
  const traffic = state?.traffic;
  const outage = (state?.outage_models ?? []).length > 0;
  const attack = (traffic?.attack_share ?? 0) > 0;
  const bad = releases.filter((r) => r.id !== "r41");

  return (
    <div className="space-y-5 p-4">
      <div>
        <Label>customer traffic</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            tone={traffic?.running ? "default" : "primary"}
            disabled={busy === "traffic"}
            onClick={() => run("traffic", () => post("/api/traffic", { running: !traffic?.running }))}
          >
            {traffic?.running ? "Pause traffic" : "Start traffic"}
          </Button>
          {[6, 12, 24].map((pm) => (
            <Button
              key={pm}
              tone={traffic?.per_minute === pm ? "ok" : "default"}
              onClick={() => run("rate", () => post("/api/traffic", { running: true, per_minute: pm }))}
            >
              {pm}/min
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>ship a release (each written by a Claude Code session)</Label>
        <div className="mt-2 space-y-1.5">
          {bad.map((r) => (
            <button
              key={r.id}
              disabled={busy !== null || state?.release === r.id}
              onClick={() => run(r.id, () => post("/api/demo/deploy", { release: r.id }))}
              className="group block w-full rounded-md border border-line bg-white/[0.02] px-3 py-2 text-left transition hover:border-alert/50 hover:bg-alert/[0.06] disabled:opacity-40"
            >
              <div className="flex items-center gap-2 text-[12.5px] text-white">
                <span className="font-mono text-white/40">{r.id}</span> {r.title}
                {state?.release === r.id && <span className="ml-auto font-mono text-[10px] text-alert">LIVE</span>}
              </div>
              {r.provenance?.checkpoint_id && (
                <div className="mt-0.5 truncate font-mono text-[10px] text-white/30">
                  checkpoint {r.provenance.checkpoint_id} · {r.provenance.agent} {r.provenance.model}
                </div>
              )}
            </button>
          ))}
          <Button
            className="w-full"
            disabled={busy !== null || state?.release === "r41"}
            onClick={() => run("r41", () => post("/api/demo/deploy", { release: "r41", actor: "human" }))}
          >
            Deploy r41 (known-good) by hand
          </Button>
        </div>
      </div>

      <div>
        <Label>chaos</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            tone={outage ? "danger" : "default"}
            onClick={() => run("outage", () => post("/api/demo/fault", { kind: "provider_outage", value: outage ? null : "claude-haiku" }))}
          >
            {outage ? "End provider outage" : "Provider outage"}
          </Button>
          <Button
            tone={attack ? "danger" : "default"}
            onClick={() => run("attack", () => post("/api/demo/attack", { share: attack ? 0 : 0.5 }))}
          >
            {attack ? "Stop attack wave" : "Prompt-injection wave"}
          </Button>
        </div>
      </div>

      <div>
        <Label>nightly</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            tone={state?.nightshift_enabled ? "ok" : "danger"}
            onClick={() => run("ns", () => post("/api/nightshift", { enabled: !state?.nightshift_enabled }))}
          >
            {state?.nightshift_enabled ? "On call ✓" : "Off duty — click to enable"}
          </Button>
          <Button
            onClick={() => {
              if (confirm("Reset the demo? This clears conversations and incidents.")) run("reset", () => post("/api/demo/reset"));
            }}
          >
            Reset demo
          </Button>
        </div>
      </div>
    </div>
  );
}
