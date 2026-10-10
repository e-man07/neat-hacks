# INC-1010-01-c0ce: r43 Orders API v2 adapter crashes on every lookup — KeyError: 'order_id'

- **Status:** AWAITING_HUMAN  ·  **Severity:** SEV1  ·  **Type:** tool_schema_drift
- **Opened:** 2026-10-10 20:19:24  ·  **Mitigated:** —  ·  **Resolved:** —
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.5

## What happened
Release r43 migrated order lookups to Orders API v2. The new `lookup_v2` adapter in `backend/harbor/adapters.py` assumes the v2 response is nested under an `"order"` key (per the developer's spec), but the real v2 API response does not match that shape — it does not contain an `"order"` key (or uses a different key). This causes a `KeyError: 'order_id'` on every `lookup_order` and `check_refund_policy` call, making 100% of r43 conversations unable to resolve customer requests. The coding agent explicitly noted it had not tested against the real service before the commit was approved and deployed.

## Root cause and provenance
- Release: `r43`
- Commit: `3db638581821` Release r43: migrate order lookups to orders API v2
- Entire checkpoint: `01M4KPWY55GJ9PGRTVS3WXTF8R` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/3db638581821530cd8f7f6e78902915031fd261b))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service is owned by the platform team and its code is not ours to read or change — use this spec: v2 returns the same order fields as v1, just nested under an 'order' key. Do two things only: (1) in backend/harbor/adapters.py add a lookup_v2 adapter that calls orders_service.get_order(or”

## Impact
- Loss rate at detection: **$145.60/min** at production volume (7.0 conversations/min)
- Human response time at 03:09 local: 300.0 min → projected loss if waiting: **$43,680**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `rollback_release` {"target": "r41"} — proposed — 'rollback_release' is pre-approved and reversible in one step; confidence 0.50 < 0.6

## Verification
- Replay of failing conversations: None/None pass
- Live metrics after action: pending

## Evidence (neatlogs traces)
- `a54e26774ed5ed2a7900ddba60eac295`
- `023c3235902e6aab35463e1bafcabdde`
- `d5d83a5ee10a2dcc7ccfe4b3ad703e80`

## Permanent fix (needs human approval)
—

## Timeline
- 2026-10-10 20:19:24 · **detect** · Anomaly detected: 30% of conversations ended without a usable reply; tool errors in 30% of conversations
- 2026-10-10 20:19:24 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:19:25 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:19:25 · **step** · get_signals: 30% of conversations ended without a usable reply; tool errors in 30% of conversations
- 2026-10-10 20:19:25 · **step** · list_recent_deploys: r43 (-0.1 min before onset), r41 (0.1 min before onset)
- 2026-10-10 20:19:25 · **step** · get_failing_conversations: 5 failing conversations: failed, failed, failed, escalated, escalated
- 2026-10-10 20:19:27 · **step** · think: Clear pattern: **r43** is causing 100% failure rate with `KeyError: 'order_id'` on `lookup_order`. Let me get the release diff and change provenance simultaneously.
- 2026-10-10 20:19:27 · **step** · get_release_diff: r41 → r43: 4 lines removed, 4 added
- 2026-10-10 20:19:27 · **step** · get_change_provenance: r43 ← commit 3db63858 · checkpoint 01M4KPWY55GJ9PGRTVS3WXTF8R · prompt: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service ”
- 2026-10-10 20:19:29 · **step** · get_trace: trace a54e26774ed5 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:19:42 · **step** · think: I have everything I need. The root cause is crystal clear. Let me submit the diagnosis.

**Summary of findings:**

1. **Release r43** deployed ~0.1 minutes before incident onset — "Orders API v2 migration"
2. **The bug**: `lookup_v2` in `adapters.py` accesses `orders_service.get_
- 2026-10-10 20:19:42 · **step** · submit_diagnosis: r43 Orders API v2 adapter crashes on every lookup — KeyError: 'order_id'
- 2026-10-10 20:19:42 · **diagnosis** · r43 Orders API v2 adapter crashes on every lookup — KeyError: 'order_id' (tool_schema_drift, confidence 0.50)
- 2026-10-10 20:19:42 · **impact** · $145.60/min · human response at 03:09: 300 min · $43,680 at risk
- 2026-10-10 20:19:42 · **decide** · Policy: needs_approval — rollback_release {'target': 'r41'}
- 2026-10-10 20:19:42 · **page** · Waiting for a human: 'rollback_release' is pre-approved and reversible in one step; confidence 0.50 < 0.6
