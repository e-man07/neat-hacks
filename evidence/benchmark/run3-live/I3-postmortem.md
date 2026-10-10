# INC-1010-01-5b1c: r44 track_shipment carrier API timeouts causing 30%+ tool error rate

- **Status:** DEFERRED  ·  **Severity:** SEV3  ·  **Type:** tool_schema_drift
- **Opened:** 2026-10-10 20:40:00  ·  **Mitigated:** —  ·  **Resolved:** —
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.95

## What happened
Release r44 (commit bca7c775a808, deployed at incident onset) added the track_shipment tool and a system prompt instruction to "retry until you get a confirmed result — never reply without confirmed tracking." The carrier tracking API is consistently returning TimeoutError on every call. The agent obeys the retry instruction, burning 2–3 extra track_shipment calls per conversation before eventually proceeding, producing tool errors in every r44 conversation. max_steps was also raised from 8 to 30, creating a potential step-runaway if the API never recovers. The coding agent itself noted there was no fallback for a persistently down carrier API.

## Root cause and provenance
- Release: `r44`
- Commit: `bca7c775a808` Release r44: always confirm live tracking
- Entire checkpoint: `01M4KPXHAVYRP4JJ0Y8M5E353S` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/bca7c775a808090a4b124a1968de9df04dc5fa02))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yaml as a copy of backend/harbor/releases/r41.yaml with id r44 and title 'Always confirm live tracking'. Changes: add track_shipment to the tools list; raise max_steps to 30 so the agent has room to retry; and add an instruction to the system prompt that before replying about any or”

## Impact
- Loss rate at detection: **$0.00/min** at production volume (1.5 conversations/min)
- Human response time at 03:12 local: 300.0 min → projected loss if waiting: **$1**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "In r45, re-introduce track_shipment with a bounded retry policy (max 2 retries) and a graceful fallback: if the carrier API is still unavailable after retries, the agent should inform the customer that live tracking is temporarily unavailable and proceed with the rest of the request. Remove the \"never reply without confirmed tracking\" absolute constraint. Also keep max_steps at 8 (or a similarly conservative value) to prevent runaway loops. Additionally, add a circuit-breaker or health-check on the carrier tracking API so track_shipment is automatically disabled in the tool list when the API is down.", "revert_commit": "bca7c775a808090a4b124a1968de9df04dc5fa02", "release": "r44"} — proposed — forward fix: needs human approval
- [needs_approval] `rollback_release` {"target": "r41"} — proposed — 'rollback_release' is pre-approved and reversible in one step; confidence 0.95 ≥ 0.6; projected loss $1 below $25 — defer to the morning

## Verification
- Replay of failing conversations: None/None pass
- Live metrics after action: pending

## Evidence (neatlogs traces)
- `27bfa3fa5f382401167518774379728f`
- `cb3f31b6c24d498d0c18a36d387b9545`
- `155035e11a5e8fea1c08cd8d38b1f27f`

## Permanent fix (needs human approval)
In r45, re-introduce track_shipment with a bounded retry policy (max 2 retries) and a graceful fallback: if the carrier API is still unavailable after retries, the agent should inform the customer that live tracking is temporarily unavailable and proceed with the rest of the request. Remove the "never reply without confirmed tracking" absolute constraint. Also keep max_steps at 8 (or a similarly conservative value) to prevent runaway loops. Additionally, add a circuit-breaker or health-check on the carrier tracking API so track_shipment is automatically disabled in the tool list when the API is down.

## Timeline
- 2026-10-10 20:40:00 · **detect** · Anomaly detected: tool errors in 30% of conversations
- 2026-10-10 20:40:00 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:40:01 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:40:01 · **step** · get_signals: tool errors in 30% of conversations
- 2026-10-10 20:40:01 · **step** · list_recent_deploys: r44 (0.0 min before onset), r41 (0.2 min before onset)
- 2026-10-10 20:40:01 · **step** · get_failing_conversations: 2 failing conversations: escalated, escalated
- 2026-10-10 20:40:03 · **step** · think: The signals show **100% tool error rate in the most recent conversations on r44**. Let me look at the traces for r44 conversations and get the release diff.
- 2026-10-10 20:40:05 · **step** · get_trace: trace 155035e11a5e from neatlogs: 7 spans
- 2026-10-10 20:40:05 · **step** · get_release_diff: r41 → r44: 5 lines removed, 8 added
- 2026-10-10 20:40:08 · **step** · think: The diff is very revealing. r44 added `track_shipment` with a dangerous instruction: **"retry until you get a confirmed result"** and **max_steps bumped from 8 to 30**. Now let me check the r44 traces and provenance.
- 2026-10-10 20:40:09 · **step** · get_trace: trace 0fade0dcd8ad from neatlogs: 7 spans
- 2026-10-10 20:40:09 · **step** · get_change_provenance: r44 ← commit bca7c775 · checkpoint 01M4KPXHAVYRP4JJ0Y8M5E353S · prompt: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yam”
- 2026-10-10 20:40:11 · **step** · search_traces: 5 traces match 'track_shipment error'
- 2026-10-10 20:40:12 · **step** · think: Now let me look at the r44 traces directly to see the `track_shipment` errors in action:
- 2026-10-10 20:40:13 · **step** · get_trace: trace 27bfa3fa5f38 from neatlogs: 12 spans
- 2026-10-10 20:40:14 · **step** · get_trace: trace cb3f31b6c24d from neatlogs: 10 spans
- 2026-10-10 20:40:28 · **step** · think: I have a complete picture. Let me now submit the diagnosis.

**Root cause confirmed:**

- **Release r44** (commit `bca7c775a808`, deployed at incident onset) introduced `track_shipment` into the tools list and added a system prompt instruction: *"retry until you get a confirmed r
- 2026-10-10 20:40:28 · **step** · submit_diagnosis: r44 track_shipment carrier API timeouts causing 30%+ tool error rate
- 2026-10-10 20:40:28 · **diagnosis** · r44 track_shipment carrier API timeouts causing 30%+ tool error rate (tool_schema_drift, confidence 0.95)
- 2026-10-10 20:40:28 · **impact** · $0.00/min · human response at 03:12: 300 min · $1 at risk
- 2026-10-10 20:40:28 · **propose** · Permanent fix proposed (needs approval): In r45, re-introduce track_shipment with a bounded retry policy (max 2 retries) and a graceful fallback: if the carrier API is still unavailable after retries, the agent should inform the customer that live tracking is temporarily unavailable and proceed with the rest of the request. Remove the "never reply without confirmed tracking" absolute constraint. Also keep max_steps at 8 (or a similarly conservative value) to prevent runaway loops. Additionally, add a circuit-breaker or health-check on the carrier tracking API so track_shipment is automatically disabled in the tool list when the API is down.
- 2026-10-10 20:40:28 · **decide** · Policy: defer — rollback_release {'target': 'r41'}
- 2026-10-10 20:40:28 · **defer** · Not worth waking anyone: $1 at risk until morning. Left the proposed fix for the day shift.
