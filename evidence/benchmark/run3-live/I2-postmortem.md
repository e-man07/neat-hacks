# INC-1010-01-56af: r43 Orders API v2 adapter broken — KeyError: 'order_id' on every order lookup

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** tool_schema_drift
- **Opened:** 2026-10-10 20:37:07  ·  **Mitigated:** 2026-10-10 20:38:34  ·  **Resolved:** 2026-10-10 20:38:42
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.95

## What happened
Release r43 (commit 3db638581821) migrated order lookups from API v1 to v2. The new `lookup_v2` adapter in `backend/harbor/adapters.py` calls `orders_service.get_order(order_id, api_version='v2')["order"]` and then reads fields like `p["order_id"]`. The real v2 service response does not match the assumed schema — the field key(s) under the nested `"order"` object differ from what the adapter expects, producing `KeyError: 'order_id'` on every call. The coding agent explicitly noted it had not tested against the real service. This breaks `lookup_order` and `check_refund_policy` for 100% of r43 conversations.

## Root cause and provenance
- Release: `r43`
- Commit: `3db638581821` Release r43: migrate order lookups to orders API v2
- Entire checkpoint: `01M4KPWY55GJ9PGRTVS3WXTF8R` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/3db638581821530cd8f7f6e78902915031fd261b))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service is owned by the platform team and its code is not ours to read or change — use this spec: v2 returns the same order fields as v1, just nested under an 'order' key. Do two things only: (1) in backend/harbor/adapters.py add a lookup_v2 adapter that calls orders_service.get_order(or”

## Impact
- Loss rate at detection: **$31.20/min** at production volume (1.5 conversations/min)
- Human response time at 03:09 local: 300.0 min → projected loss if waiting: **$9,360**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Before re-deploying the v2 adapter: (1) Obtain the actual v2 API response shape from the platform team (or call the real endpoint in a staging environment) and verify the exact key names under the `\"order\"` envelope. (2) Fix `lookup_v2` in `adapters.py` to use the correct field names. (3) Add an integration test that calls the real (or a contract-mocked) v2 endpoint and asserts the normalised output matches the v1 shape. (4) Require that the coding agent's sandbox can run `pytest` against a live/stubbed service before any adapter migration is merged.", "revert_commit": "3db638581821530cd8f7f6e78902915031fd261b", "release": "r43"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "r41"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.95 ≥ 0.6; projected loss while waiting for a human $9,360 ≥ $25

## Verification
- Replay of failing conversations: 5/5 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `5d49641aa27c70d42b97de9c8c5de0cc`
- `22e06f0c0f5dacafb56e168112e184a1`
- `b1765d6ceaaeaba016598a23e43be74c`

## Permanent fix (needs human approval)
Before re-deploying the v2 adapter: (1) Obtain the actual v2 API response shape from the platform team (or call the real endpoint in a staging environment) and verify the exact key names under the `"order"` envelope. (2) Fix `lookup_v2` in `adapters.py` to use the correct field names. (3) Add an integration test that calls the real (or a contract-mocked) v2 endpoint and asserts the normalised output matches the v1 shape. (4) Require that the coding agent's sandbox can run `pytest` against a live/stubbed service before any adapter migration is merged.

## Timeline
- 2026-10-10 20:37:07 · **detect** · Anomaly detected: 30% of conversations ended without a usable reply; tool errors in 30% of conversations
- 2026-10-10 20:37:07 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:37:08 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:37:08 · **step** · get_signals: 30% of conversations ended without a usable reply; tool errors in 30% of conversations
- 2026-10-10 20:37:08 · **step** · list_recent_deploys: r43 (0.0 min before onset), r41 (0.2 min before onset)
- 2026-10-10 20:37:08 · **step** · get_failing_conversations: 5 failing conversations: failed, failed, failed, escalated, escalated
- 2026-10-10 20:37:10 · **step** · think: Clear signal: **r43** ("Orders API v2 migration") deployed at incident onset, and all r43 conversations fail with `KeyError: 'order_id'`. Let me get the release diff and change provenance simultaneously.
- 2026-10-10 20:37:10 · **step** · get_release_diff: r41 → r43: 4 lines removed, 4 added
- 2026-10-10 20:37:10 · **step** · get_change_provenance: r43 ← commit 3db63858 · checkpoint 01M4KPWY55GJ9PGRTVS3WXTF8R · prompt: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service ”
- 2026-10-10 20:37:22 · **step** · think: I have everything I need. The root cause is crystal clear. Let me submit the diagnosis.

The evidence is unambiguous:

- **r43** deployed at exactly `minutes_before_onset: 0.0` — it landed right as the incident started.
- The `since_last_change` window shows **100% failure rate**
- 2026-10-10 20:37:22 · **step** · submit_diagnosis: error: missing confidence; re-submitting
- 2026-10-10 20:37:28 · **step** · submit_diagnosis: r43 Orders API v2 adapter broken — KeyError: 'order_id' on every order lookup
- 2026-10-10 20:37:28 · **diagnosis** · r43 Orders API v2 adapter broken — KeyError: 'order_id' on every order lookup (tool_schema_drift, confidence 0.95)
- 2026-10-10 20:37:28 · **impact** · $31.20/min · human response at 03:09: 300 min · $9,360 at risk
- 2026-10-10 20:37:28 · **propose** · Permanent fix proposed (needs approval): Before re-deploying the v2 adapter: (1) Obtain the actual v2 API response shape from the platform team (or call the real endpoint in a staging environment) and verify the exact key names under the `"order"` envelope. (2) Fix `lookup_v2` in `adapters.py` to use the correct field names. (3) Add an integration test that calls the real (or a contract-mocked) v2 endpoint and asserts the normalised output matches the v1 shape. (4) Require that the coding agent's sandbox can run `pytest` against a live/stubbed service before any adapter migration is merged.
- 2026-10-10 20:37:28 · **decide** · Policy: auto — rollback_release {'target': 'r41'}
- 2026-10-10 20:37:28 · **act** · Auto action: rolled back r43 → r41
- 2026-10-10 20:38:34 · **verify** · Replayed 5 failing conversations on the new config: 5/5 pass
- 2026-10-10 20:38:34 · **regression** · Added regression eval INC-1010-01-56af.yaml from the failing conversations
- 2026-10-10 20:38:42 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
