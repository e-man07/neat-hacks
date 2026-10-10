# INC-1010-01-fdc7: claude-haiku provider outage — 503s causing 30%+ conversation failures

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** provider_outage
- **Opened:** 2026-10-10 20:22:52  ·  **Mitigated:** 2026-10-10 20:23:13  ·  **Resolved:** 2026-10-10 20:23:18
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.97

## What happened
The claude-haiku model provider is returning 503 Service Unavailable on every inference request. All failing conversations have 0 steps and empty replies with identical ProviderOutage errors. The live health probe confirms the model is currently unhealthy. No code or config change is responsible — release r41 was already the previous release (no diff). The failure rate in the most recent window is 100%.

## Root cause and provenance
- Release: `None`
- Commit: `` 
- Entire checkpoint: `None`
- Coding agent: — 
- Prompt behind the change: “—”

## Impact
- Loss rate at detection: **$145.60/min** at production volume (7.0 conversations/min)
- Human response time at 03:12 local: 300.0 min → projected loss if waiting: **$43,680**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Add automatic model failover in the gateway: if claude-haiku returns \u22652 consecutive 503s within a 60-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe claude-haiku every 60 seconds and restore primary routing once it returns healthy. This eliminates manual intervention for provider outages."} — proposed — forward fix: needs human approval
- [auto] `failover_model` {"model": "nova-lite"} — applied — 'failover_model' is pre-approved and reversible in one step; confidence 0.97 ≥ 0.6; projected loss while waiting for a human $43,680 ≥ $25

## Verification
- Replay of failing conversations: 4/5 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `26ba3e017ebcaa4544fb0d4bb9b9c03a`
- `d2617aa6f010921b57b9b5b712af4a5f`
- `d554f1c9caf8d2eeb6e415e92ee173a8`

## Permanent fix (needs human approval)
Add automatic model failover in the gateway: if claude-haiku returns ≥2 consecutive 503s within a 60-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe claude-haiku every 60 seconds and restore primary routing once it returns healthy. This eliminates manual intervention for provider outages.

## Timeline
- 2026-10-10 20:22:52 · **detect** · Anomaly detected: 30% of conversations ended without a usable reply
- 2026-10-10 20:22:52 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:22:53 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:22:53 · **step** · get_signals: 30% of conversations ended without a usable reply
- 2026-10-10 20:22:53 · **step** · list_recent_deploys: r41 (0.1 min before onset)
- 2026-10-10 20:22:53 · **step** · get_failing_conversations: 5 failing conversations: failed, failed, failed, escalated, escalated
- 2026-10-10 20:22:55 · **step** · think: Clear signal: `claude-haiku` is returning 503s. Let me confirm with a live health check and also pull a trace to verify, while checking the release diff.
- 2026-10-10 20:22:55 · **step** · check_model_health: error: 503 Service Unavailable from provider for model 'claude-haiku' (injected fault)
- 2026-10-10 20:22:57 · **step** · get_trace: trace 26ba3e017ebc from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:22:58 · **step** · get_trace: trace d2617aa6f010 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:23:05 · **step** · think: The evidence is conclusive. Here's what I found:

**Root Cause:** `claude-haiku` (the primary model) is experiencing a provider outage — every call returns `503 Service Unavailable`. This is confirmed by:
- Live health check: `healthy: false`, `503 Service Unavailable (injected f
- 2026-10-10 20:23:05 · **step** · submit_diagnosis: claude-haiku provider outage — 503s causing 30%+ conversation failures
- 2026-10-10 20:23:05 · **diagnosis** · claude-haiku provider outage — 503s causing 30%+ conversation failures (provider_outage, confidence 0.97)
- 2026-10-10 20:23:05 · **impact** · $145.60/min · human response at 03:12: 300 min · $43,680 at risk
- 2026-10-10 20:23:05 · **propose** · Permanent fix proposed (needs approval): Add automatic model failover in the gateway: if claude-haiku returns ≥2 consecutive 503s within a 60-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe claude-haiku every 60 seconds and restore primary routing once it returns healthy. This eliminates manual intervention for provider outages.
- 2026-10-10 20:23:05 · **decide** · Policy: auto — failover_model {'model': 'nova-lite'}
- 2026-10-10 20:23:05 · **act** · Auto action: routed traffic to backup model nova-lite
- 2026-10-10 20:23:13 · **verify** · Replayed 5 failing conversations on the new config: 4/5 pass
- 2026-10-10 20:23:13 · **regression** · Added regression eval INC-1010-01-fdc7.yaml from the failing conversations
- 2026-10-10 20:23:18 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
