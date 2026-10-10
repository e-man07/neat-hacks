# INC-1010-01-3167: claude-haiku provider returning 503 — 30% conversation failure rate

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** provider_outage
- **Opened:** 2026-10-10 20:40:42  ·  **Mitigated:** 2026-10-10 20:41:04  ·  **Resolved:** 2026-10-10 20:41:11
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.95

## What happened
The primary model provider for claude-haiku is returning "503 Service Unavailable" on every request. All 3 most-recent conversations (100% failure rate in the latest window) failed at step 0 with zero tokens consumed — the model gateway never returned a response. The live health probe confirms the model is currently unhealthy. No code change is responsible; this is a pure provider-side outage. The deploy r41 was present before onset and is not the cause.

## Root cause and provenance
- Release: `None`
- Commit: `` 
- Entire checkpoint: `None`
- Coding agent: — 
- Prompt behind the change: “—”

## Impact
- Loss rate at detection: **$31.20/min** at production volume (1.5 conversations/min)
- Human response time at 03:13 local: 300.0 min → projected loss if waiting: **$9,360**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Add automatic model failover in the gateway: if claude-haiku returns \u22652 consecutive 503s within a 30-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe the primary every 60 seconds and restore traffic once healthy. This eliminates manual intervention for provider outages."} — proposed — forward fix: needs human approval
- [auto] `failover_model` {"model": "nova-lite"} — applied — 'failover_model' is pre-approved and reversible in one step; confidence 0.95 ≥ 0.6; projected loss while waiting for a human $9,360 ≥ $25

## Verification
- Replay of failing conversations: 4/5 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `6bfed53a7bc0c296b2f86f152ff5b6d4`
- `52b4ab8d47c145f13d84003eaffb1a32`
- `b74f7ebf1851355aaba436efc393dfa4`

## Permanent fix (needs human approval)
Add automatic model failover in the gateway: if claude-haiku returns ≥2 consecutive 503s within a 30-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe the primary every 60 seconds and restore traffic once healthy. This eliminates manual intervention for provider outages.

## Timeline
- 2026-10-10 20:40:42 · **detect** · Anomaly detected: 30% of conversations ended without a usable reply
- 2026-10-10 20:40:42 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:40:46 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:40:46 · **step** · get_signals: 30% of conversations ended without a usable reply
- 2026-10-10 20:40:46 · **step** · list_recent_deploys: r41 (0.2 min before onset)
- 2026-10-10 20:40:46 · **step** · get_failing_conversations: 5 failing conversations: failed, failed, failed, escalated, escalated
- 2026-10-10 20:40:48 · **step** · think: Clear signal: `claude-haiku` is returning 503s. Let me verify model health directly and also pull a trace to confirm.
- 2026-10-10 20:40:48 · **step** · check_model_health: error: 503 Service Unavailable from provider for model 'claude-haiku' (injected fault)
- 2026-10-10 20:40:50 · **step** · get_trace: trace 6bfed53a7bc0 from neatlogs: 0 spans
- 2026-10-10 20:40:56 · **step** · think: The evidence is conclusive. Let me submit the diagnosis.
- 2026-10-10 20:40:56 · **step** · submit_diagnosis: claude-haiku provider returning 503 — 30% conversation failure rate
- 2026-10-10 20:40:56 · **diagnosis** · claude-haiku provider returning 503 — 30% conversation failure rate (provider_outage, confidence 0.95)
- 2026-10-10 20:40:56 · **impact** · $31.20/min · human response at 03:13: 300 min · $9,360 at risk
- 2026-10-10 20:40:56 · **propose** · Permanent fix proposed (needs approval): Add automatic model failover in the gateway: if claude-haiku returns ≥2 consecutive 503s within a 30-second window, automatically route traffic to the fallback model (nova-lite) and alert on-call. Re-probe the primary every 60 seconds and restore traffic once healthy. This eliminates manual intervention for provider outages.
- 2026-10-10 20:40:56 · **decide** · Policy: auto — failover_model {'model': 'nova-lite'}
- 2026-10-10 20:40:56 · **act** · Auto action: routed traffic to backup model nova-lite
- 2026-10-10 20:41:04 · **verify** · Replayed 5 failing conversations on the new config: 4/5 pass
- 2026-10-10 20:41:04 · **regression** · Added regression eval INC-1010-01-3167.yaml from the failing conversations
- 2026-10-10 20:41:11 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
