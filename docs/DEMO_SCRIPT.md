# Demo script — 3:00 max

Setup (before recording):
```bash
cd backend && NIGHTSHIFT_LOCAL_TIME=03:07 uv run uvicorn api.server:app --port 8000   # live models
cd web && npm run dev                                                                # http://localhost:3000
```
In the console: Reset demo → Start traffic (12/min). Let ~10 conversations go green. Have the
phone (ntfy app subscribed to `NTFY_TOPIC`) on camera if possible; otherwise the on-screen phone.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Landing hero | "It's 3:07 AM. Your support agent is talking to customers. Nobody is awake. Night Shift is the on-call engineer for AI agents: it stops the bleeding by itself and only wakes you for decisions that can't be undone." |
| 0:15–0:35 | Console, quiet | "This is Harbor, a real LLM support agent on Claude Haiku, handling refunds for a store. Every conversation is traced in **neatlogs**. Every release was written by a Claude Code session and checkpointed by **Entire**." |
| 0:35–0:50 | Click "r46 One-step refunds" | "A developer asked their coding agent to make refunds faster — and assumed the payments service validates eligibility. It doesn't." Money counter turns red. |
| 0:50–1:35 | Incident panel streams | "Night Shift detects wrong refunds from the ledger, then investigates like an SRE: reads the traces from neatlogs, sees the deploy, diffs the release, and follows the commit to the **Entire checkpoint** — here's the exact prompt behind the bug, and the warning the coding agent gave that nobody read." |
| 1:35–1:55 | Impact + policy cards | "It prices the incident with our **cfo.ai** model: dollars per minute at production volume × 300 minutes until a human would wake up. Above $25 and reversible, so policy lets it act." |
| 1:55–2:15 | Act + verify + phone | "It rolls back, replays the exact failed conversations on the fixed config — all pass — and watches live traffic recover. Then one page: handled, here's what it cost, a permanent fix is waiting for your approval." |
| 2:15–2:35 | Benchmark page | "Six staged incidents, live models: unchecked refunds, API drift, a flaky-dependency loop it chose *not* to wake you for, a provider outage it failed over, a prompt-injection wave, a ticket flood. Before vs after numbers, all with trace ids." Mention run 1 → run 2 improvement. |
| 2:35–2:50 | Business page | "Investigations cost about nine cents. The business plan — pricing, costs, revenue, runway — is built in cfo.ai from those measured costs." |
| 2:50–3:00 | Landing CTA | "Autonomous where it's reversible. A human approves anything that isn't. Go to sleep — it's handled." |

Cover for each tool (rubric): architecture (landing "three tools" section), implementation (console
provenance card / code), runtime (live incident), reasoning (investigator steps), result (benchmark).
