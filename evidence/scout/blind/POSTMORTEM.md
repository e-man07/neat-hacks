# INC-1012-01-8aa1: s4 top_k=1 + 1-2 sentence constraint causes refund policy retrieval failure → mass escalations

- **Status:** DEFERRED  ·  **Severity:** SEV3  ·  **Type:** prompt_regression
- **Opened:** 2026-10-12 10:26:46  ·  **Mitigated:** —  ·  **Resolved:** —
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.95

## What happened
Release s4 (deployed 4.3 min before onset, commit cc9b8b9c7294) introduced two regressive changes vs s2:
1. **top_k reduced from 2 → 1**: The title/heading retriever (v2) now returns only 1 doc section. The refund policy content is apparently not the top-ranked hit for "refund on annual plan", so it is never retrieved.
2. **max_steps reduced from 6 → 4** and **reply length capped to 1-2 sentences**: Even if the agent tried to search further, the tighter budget discourages follow-up tool calls.

The net effect: Scout makes zero tool calls, finds no refund policy content, and falls back to "I don't have access to that information → contact support@lumen.dev", triggering a human escalation every time. All 3 sampled failing conversations show 0 tool calls and identical fallback replies. Escalation rate jumped from 5% baseline to 30%.

## Root cause and provenance
- Release: `s4`
- Commit: `cc9b8b9c7294` Release s4: cheaper answers
- Entire checkpoint: `01M4QSS28K20HPAQTQK0RJHE8K` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/cc9b8b9c7294659f2f1e074d86f5719b6237bd88))
- Coding agent: — 
- Prompt behind the change: “—”

## Impact
- Loss rate at detection: **$0.02/min** at production volume (20.0 conversations/min)
- Human response time at 10:27 local: 15.0 min → projected loss if waiting: **$0**
- Unit economics: Lumen support: a deflected ticket costs $4.50; docs bot answers ~400/h overnight

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Before merging any \"cheaper answers\" release: (1) add a regression eval that covers the refund policy question and asserts zero escalations; (2) enforce a minimum top_k of 2 for the v2 title/heading retriever since it is keyword-only and misses on paraphrase; (3) require that any reduction in top_k or max_steps passes the full eval suite, not just cost metrics. Optionally, switch to a semantic/embedding retriever so single-result retrieval is more robust.", "revert_commit": "cc9b8b9c7294659f2f1e074d86f5719b6237bd88", "release": "s4"} — proposed — forward fix: needs human approval
- [needs_approval] `rollback_release` {"target": "s2"} — proposed — 'rollback_release' is pre-approved and reversible in one step; confidence 0.95 ≥ 0.6; projected loss $0 below $25 — defer to the morning

## Verification
- Replay of failing conversations: None/None pass
- Live metrics after action: pending

## Evidence (neatlogs traces)
- `985b989283ec0a370334363e7212de5b`
- `9cd9b83f5e75c13425e81ed85248ea56`
- `94b050817368acd878e10654319eb94b`

## Permanent fix (needs human approval)
Before merging any "cheaper answers" release: (1) add a regression eval that covers the refund policy question and asserts zero escalations; (2) enforce a minimum top_k of 2 for the v2 title/heading retriever since it is keyword-only and misses on paraphrase; (3) require that any reduction in top_k or max_steps passes the full eval suite, not just cost metrics. Optionally, switch to a semantic/embedding retriever so single-result retrieval is more robust.

## Timeline
- 2026-10-12 10:26:46 · **detect** · Anomaly detected: 30% of conversations handed to humans (baseline 5%): ticket flood
- 2026-10-12 10:26:46 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-12 10:26:49 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-12 10:26:49 · **step** · get_signals: 30% of conversations handed to humans (baseline 5%): ticket flood
- 2026-10-12 10:26:49 · **step** · list_recent_deploys: s4 (4.3 min before onset), s2 (2069.0 min before onset)
- 2026-10-12 10:26:49 · **step** · get_failing_conversations: 3 failing conversations: escalated, escalated, escalated
- 2026-10-12 10:26:52 · **step** · think: Clear pattern: release `s4` deployed 4.3 minutes before onset, and all escalations are about refund policy questions where the bot says it "doesn't have access" to the info. Let me get the release diff and change provenance simultaneously, plus check a few traces.
- 2026-10-12 10:26:54 · **step** · get_release_diff: s2 → s4: 20 lines removed, 90 added
- 2026-10-12 10:26:57 · **step** · get_change_provenance: s4 ← commit cc9b8b9c · checkpoint 01M4QSS28K20HPAQTQK0RJHE8K
- 2026-10-12 10:26:58 · **step** · get_trace: trace 985b989283ec from neatlogs: 2 spans
- 2026-10-12 10:27:00 · **step** · think: The root cause is crystal clear. Let me confirm by checking what the previous release (s2) had for comparison.
- 2026-10-12 10:27:03 · **step** · get_change_provenance: s2 ← commit 9d2d0e30 · checkpoint 01M4KWSGWHTGYJZ4JB83QT3TDJ
- 2026-10-12 10:27:12 · **step** · think: I have everything I need. The diagnosis is clear. Let me submit it.
- 2026-10-12 10:27:12 · **step** · submit_diagnosis: s4 top_k=1 + 1-2 sentence constraint causes refund policy retrieval failure → mass escalations
- 2026-10-12 10:27:12 · **diagnosis** · s4 top_k=1 + 1-2 sentence constraint causes refund policy retrieval failure → mass escalations (prompt_regression, confidence 0.95)
- 2026-10-12 10:27:12 · **impact** · $0.02/min · human response at 10:27: 15 min · $0 at risk
- 2026-10-12 10:27:12 · **propose** · Permanent fix proposed (needs approval): Before merging any "cheaper answers" release: (1) add a regression eval that covers the refund policy question and asserts zero escalations; (2) enforce a minimum top_k of 2 for the v2 title/heading retriever since it is keyword-only and misses on paraphrase; (3) require that any reduction in top_k or max_steps passes the full eval suite, not just cost metrics. Optionally, switch to a semantic/embedding retriever so single-result retrieval is more robust.
- 2026-10-12 10:27:12 · **decide** · Policy: defer — rollback_release {'target': 's2'}
- 2026-10-12 10:27:12 · **defer** · Not worth waking anyone: $0 at risk until morning. Left the proposed fix for the day shift.
- 2026-10-12 10:27:13 · **page** · Paged on-call via slack #social: 🌙 For the morning
