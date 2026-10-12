# Scout: a second agent, connected only through the SDK and neatlogs

Scout (`agents/scout/`) is a docs assistant for Lumen, a fictional analytics SaaS. It shares no code with
Nightly. It runs in its own process. Nightly sees it through two channels only: its neatlogs
traces, and the outcome events it reports with the SDK. Nightly steers it through the SDK's control
plane.

## The changes, written by independent Claude Code dev sessions (each linked to an Entire checkpoint)

| release | change | live eval (18 questions) | Nightly |
|---|---|---|---|
| s1 | launch: full-text section search | 18/18 | baseline |
| s2 | "faster, cheaper": title/heading-only search, top_k 2 | 17/18 | **no page**: ran ~40 min, no false alarm |
| s3 | read pages from `docs/v2` "ahead of the docs migration" (the folder doesn't exist yet) | 15/18, plus tool errors on most runs | incident, auto-rollback |

The s3 dev session warned in its own summary that the eval dropped to 15/18 because `docs/v2` doesn't
exist yet. Nightly found that warning through Entire and quoted it in the postmortem.

## Two live incidents (live LLMs, real neatlogs, the product API, Scout's own replay worker)

| | run 1 | run 2 |
|---|---|---|
| s3 deployed | 22:19:26 | 22:32:52 |
| detected | +1m20s (tool errors in 30% of runs) | +1m43s |
| diagnosis | `tool_schema_drift`, confidence 0.97 | `tool_schema_drift`, confidence 0.95 |
| priced | $9.27/min, $2,780 at risk by morning | $11.25/min, $3,376 at risk |
| contained | +1m38s, auto rollback s3 → s2 | +2m11s, auto rollback s3 → s2 |
| verified | replay 1/1 (run by Scout via `ns.serve_replays`) | replay 3/3 (now includes tool-error runs) |
| resolved | +2m16s | +2m56s |
| proposed for approval | eval gate in CI + startup check that `doc_root` exists | eval gate in CI |

Postmortems: [run1](run1/POSTMORTEM.md), [run2](run2/POSTMORTEM.md).

## What we learned (and changed)

- **neatlogs dropped most traces.** Scout answered ~120 questions in 12 minutes, but only ~25 traces
  were searchable, and `get_trace_context` returned "Trace not found" for most trace ids. Meanwhile the
  SDK's delivery diagnostics reported 0 queue drops and 0 export failures. In a sim test, 1 of 8 traces
  became readable. So the SDK's outcome event now carries the run's details (input, steps, tool errors,
  tokens, latency). The event is the heartbeat, and the neatlogs trace enriches the row when it lands
  (`brain = sdk+neatlogs`). Nightly no longer depends on every trace arriving.
- Run 1 replayed only the escalated run. Runs that had tool errors but still produced a passable answer
  were skipped. Replays and the investigator now include any run with tool errors, and Scout's replay
  passes only when no tool call failed.
- Evals and replays are traced under their own root span (`scout_replay`), so they never count as
  production traffic.
- **A noisy false alarm, handled by the money gate.** After run 2, 3 of 10 healthy s2 runs escalated
  (the refund question sometimes defers to support). The detector opened INC-1010-03, the investigator
  pattern-matched the earlier incident and blamed s3, and Nightly priced the damage at $1 and
  **deferred it to the morning without paging anyone**. The deferral was right, the diagnosis was not. The
  investigator's output is now checked against the evidence: a blamed release must have served the
  failing runs, and a rollback to the release that's already live becomes "no action". Either failure
  caps confidence at 0.4.
