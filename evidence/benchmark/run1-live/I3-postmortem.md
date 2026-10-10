# INC-1010-01-856c: r44 mandatory track_shipment causes 100% tool errors — carrier API timing out on every call

- **Status:** AWAITING_HUMAN  ·  **Severity:** SEV3  ·  **Type:** tool_schema_drift
- **Opened:** 2026-10-10 20:21:02  ·  **Mitigated:** —  ·  **Resolved:** —
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.98

## What happened
Release r44 (commit bca7c775a808, deployed at incident onset) added `track_shipment` to the tool list and a system-prompt rule (step 5) requiring the agent to call it before every order reply and "retry until you get a confirmed result — never reply without confirmed tracking." The carrier tracking API is returning `TimeoutError` on every invocation. Every r44 conversation now generates 3+ `track_shipment` failures (ok=false) as the agent retries in a loop, producing the 30% (and rising to 100% in the latest window) tool error rate. The coding agent's own note flagged this risk: "The prompt has no fallback if the carrier API stays down. The agent will keep retrying until it hits the 30-step limit." max_steps was also raised from 8 → 30, amplifying the blast radius.

## Root cause and provenance
- Release: `r44`
- Commit: `bca7c775a808` Release r44: always confirm live tracking
- Entire checkpoint: `01M4KPXHAVYRP4JJ0Y8M5E353S` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/bca7c775a808090a4b124a1968de9df04dc5fa02))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yaml as a copy of backend/harbor/releases/r41.yaml with id r44 and title 'Always confirm live tracking'. Changes: add track_shipment to the tools list; raise max_steps to 30 so the agent has room to retry; and add an instruction to the system prompt that before replying about any or”

## Impact
- Loss rate at detection: **$0.03/min** at production volume (7.0 conversations/min)
- Human response time at 03:11 local: 300.0 min → projected loss if waiting: **$8**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Rewrite step 5 in the r44 system prompt to include a graceful fallback: call track_shipment once; if it returns a TimeoutError, inform the customer that live tracking is temporarily unavailable and proceed with the reply using order-status data from lookup_order. Do NOT retry indefinitely. Also restore max_steps to 8 (or a modest value like 10) to prevent runaway loops. Additionally, add a circuit-breaker / health-check on the carrier tracking API so that if it is down, track_shipment calls are short-circuited at the gateway rather than burning agent steps.", "revert_commit": "bca7c775a808090a4b124a1968de9df04dc5fa02", "release": "r44"} — proposed — forward fix: needs human approval
- [needs_approval] `rollback_release` {"target": "r41"} — proposed — 'rollback_release' is pre-approved and reversible in one step; confidence 0.98 ≥ 0.6; projected loss $8 below $25 — page only

## Verification
- Replay of failing conversations: None/None pass
- Live metrics after action: pending

## Evidence (neatlogs traces)
- `be8c85e129d5f10b777d76afa6dd0ab1`
- `508835c37e370956f93d1ecaffc3e40d`
- `d85a94c671378007c4e9cb23aaa5e23b`

## Permanent fix (needs human approval)
Rewrite step 5 in the r44 system prompt to include a graceful fallback: call track_shipment once; if it returns a TimeoutError, inform the customer that live tracking is temporarily unavailable and proceed with the reply using order-status data from lookup_order. Do NOT retry indefinitely. Also restore max_steps to 8 (or a modest value like 10) to prevent runaway loops. Additionally, add a circuit-breaker / health-check on the carrier tracking API so that if it is down, track_shipment calls are short-circuited at the gateway rather than burning agent steps.

## Timeline
- 2026-10-10 20:21:02 · **detect** · Anomaly detected: tool errors in 30% of conversations
- 2026-10-10 20:21:02 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:21:04 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:21:04 · **step** · get_signals: tool errors in 30% of conversations
- 2026-10-10 20:21:04 · **step** · list_recent_deploys: r44 (-0.1 min before onset), r41 (1.1 min before onset)
- 2026-10-10 20:21:04 · **step** · get_failing_conversations: 2 failing conversations: escalated, escalated
- 2026-10-10 20:21:06 · **step** · think: The signals show 100% tool error rate in the most recent window (r44). r44 was deployed ~0.1 minutes *after* onset (essentially at onset). Let me look at the r44 traces and the release diff simultaneously.
- 2026-10-10 20:21:08 · **step** · get_trace: trace 0460fa750de7 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:21:08 · **step** · get_release_diff: r41 → r44: 5 lines removed, 8 added
- 2026-10-10 20:21:08 · **step** · get_change_provenance: r44 ← commit bca7c775 · checkpoint 01M4KPXHAVYRP4JJ0Y8M5E353S · prompt: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yam”
- 2026-10-10 20:21:11 · **step** · think: Now let me look at the r44 traces specifically to see the `track_shipment` tool errors in action.
- 2026-10-10 20:21:11 · **step** · get_trace: trace 2de4d2745eed from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:21:13 · **step** · search_traces: 0 traces match 'track_shipment error timeout'
- 2026-10-10 20:21:14 · **step** · think: Let me get the r44 traces directly to see the tool errors.
- 2026-10-10 20:21:15 · **step** · get_trace: error: trace c_14cc04b4f6e7 not found
- 2026-10-10 20:21:16 · **step** · search_traces: 0 traces match 'track_shipment r44'
- 2026-10-10 20:21:19 · **step** · search_traces: 3 traces match 'track_shipment'
- 2026-10-10 20:21:19 · **step** · get_failing_conversations: 2 failing conversations: escalated, escalated
- 2026-10-10 20:21:20 · **step** · think: Now let me get the r44 traces directly to confirm the tool errors:
- 2026-10-10 20:21:21 · **step** · get_trace: trace be8c85e129d5 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:21:22 · **step** · get_trace: trace 508835c37e37 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:21:23 · **step** · get_trace: trace d85a94c67137 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:21:38 · **step** · think: I have a complete picture. Let me submit the diagnosis.

**Root cause confirmed:** Release **r44** (commit `bca7c775a808`, deployed ~0.1 min before incident onset) added a mandatory `track_shipment` call to the system prompt with instruction to **"retry until you get a confirmed 
- 2026-10-10 20:21:38 · **step** · submit_diagnosis: r44 mandatory track_shipment causes 100% tool errors — carrier API timing out on every call
- 2026-10-10 20:21:38 · **diagnosis** · r44 mandatory track_shipment causes 100% tool errors — carrier API timing out on every call (tool_schema_drift, confidence 0.98)
- 2026-10-10 20:21:38 · **impact** · $0.03/min · human response at 03:11: 300 min · $8 at risk
- 2026-10-10 20:21:38 · **propose** · Permanent fix proposed (needs approval): Rewrite step 5 in the r44 system prompt to include a graceful fallback: call track_shipment once; if it returns a TimeoutError, inform the customer that live tracking is temporarily unavailable and proceed with the reply using order-status data from lookup_order. Do NOT retry indefinitely. Also restore max_steps to 8 (or a modest value like 10) to prevent runaway loops. Additionally, add a circuit-breaker / health-check on the carrier tracking API so that if it is down, track_shipment calls are short-circuited at the gateway rather than burning agent steps.
- 2026-10-10 20:21:38 · **decide** · Policy: page_only — rollback_release {'target': 'r41'}
- 2026-10-10 20:21:38 · **page** · Waiting for a human: 'rollback_release' is pre-approved and reversible in one step; confidence 0.98 ≥ 0.6; projected loss $8 below $25 — page only
