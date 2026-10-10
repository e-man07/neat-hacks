# INC-1010-01-2247: r42 prompt stripped policy guardrails, causing unnecessary escalations

- **Status:** RESOLVED  ·  **Severity:** SEV2  ·  **Type:** prompt_regression
- **Opened:** 2026-10-10 20:44:25  ·  **Mitigated:** 2026-10-10 20:44:45  ·  **Resolved:** 2026-10-10 20:44:52
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.97

## What happened
Release r42 rewrote the system prompt to 3 lines for brevity, removing all r41 policy rules: (1) the requirement to call check_refund_policy before acting, (2) the instruction to explain ineligibility and decline without refunding, and (3) the escalation-only-when-requires_human rule. The new prompt says "resolve refund requests in one step: look up the order and refund it." When the agent encounters ineligible orders (final-sale items, outside 30-day window) where check_refund_policy returns eligible=false and requires_human=false, it has no instruction to simply decline — so it defaults to escalate_to_human, flooding the human queue. Escalation rate jumped from 12.5% baseline to 50% immediately after r42 deployed (0 minutes before onset).

## Root cause and provenance
- Release: `r42`
- Commit: `48838b2bcdcd` Release r42: shorter, friendlier replies
- Entire checkpoint: `01M4KPVDWXBEHTK5NXGKF99PKB` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/48838b2bcdcdb937b0cafa77785fb595aa26ee9f))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.yaml, based on backend/harbor/releases/r41.yaml (same fields, id r42, title 'Shorter, friendlier replies'). Rewrite the system prompt to be about three short lines: who Harbor is, keep replies brief and warm, and resolve refund requests in one step (look up the order and refund it”

## Impact
- Loss rate at detection: **$2.53/min** at production volume (1.5 conversations/min)
- Human response time at 03:16 local: 300.0 min → projected loss if waiting: **$760**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Restore r41's policy rules in the system prompt while keeping the brevity goal. Add back: (1) \"Always call check_refund_policy before any refund action\", (2) \"If the order is not eligible (eligible=false, requires_human=false), explain the reason kindly and do not refund or escalate\", (3) \"Only call escalate_to_human when check_refund_policy returns requires_human=true.\" A one-liner like \"Check policy first; decline ineligible orders politely; escalate only when policy requires it\" preserves brevity without losing guardrails. Also add a CI/CD test that replays known-ineligible orders and asserts the outcome is a decline, not an escalation.", "revert_commit": "48838b2bcdcdb937b0cafa77785fb595aa26ee9f", "release": "r42"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "r41"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.97 ≥ 0.6; projected loss while waiting for a human $760 ≥ $25

## Verification
- Replay of failing conversations: 4/4 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `1314be71d20d77e6a374546973d07ac0`
- `ac6a557c3151911e0494f0f8b4f82237`
- `3868be6072805e72fa268554e2a4f14b`
- `87d09bbff74364ae819069b8531068ce`

## Permanent fix (needs human approval)
Restore r41's policy rules in the system prompt while keeping the brevity goal. Add back: (1) "Always call check_refund_policy before any refund action", (2) "If the order is not eligible (eligible=false, requires_human=false), explain the reason kindly and do not refund or escalate", (3) "Only call escalate_to_human when check_refund_policy returns requires_human=true." A one-liner like "Check policy first; decline ineligible orders politely; escalate only when policy requires it" preserves brevity without losing guardrails. Also add a CI/CD test that replays known-ineligible orders and asserts the outcome is a decline, not an escalation.

## Timeline
- 2026-10-10 20:44:25 · **detect** · Anomaly detected: 40% of conversations handed to humans (baseline 12%): ticket flood
- 2026-10-10 20:44:25 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:44:26 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:44:26 · **step** · get_signals: 40% of conversations handed to humans (baseline 12%): ticket flood
- 2026-10-10 20:44:26 · **step** · list_recent_deploys: r42 (0.0 min before onset), r41 (1.2 min before onset)
- 2026-10-10 20:44:26 · **step** · get_failing_conversations: 4 failing conversations: escalated, escalated, escalated, escalated
- 2026-10-10 20:44:29 · **step** · think: Strong signal: **r42** deployed at incident onset with "Shorter, friendlier replies". Escalation rate jumped to 50% since r42. The grade notes say "escalated a request policy could settle" — the agent is escalating instead of just declining. Let me get the release diff and change
- 2026-10-10 20:44:29 · **step** · get_release_diff: r41 → r42: 14 lines removed, 7 added
- 2026-10-10 20:44:29 · **step** · get_change_provenance: r42 ← commit 48838b2b · checkpoint 01M4KPVDWXBEHTK5NXGKF99PKB · prompt: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.y”
- 2026-10-10 20:44:41 · **step** · think: The root cause is crystal clear. I have everything I need to submit the diagnosis.

**Summary of findings:**

- **r42** deployed at exactly incident onset (0 minutes before)
- The new system prompt **stripped all policy guardrails** from r41: no instruction to call `check_refund_
- 2026-10-10 20:44:41 · **step** · submit_diagnosis: r42 prompt stripped policy guardrails, causing unnecessary escalations
- 2026-10-10 20:44:41 · **diagnosis** · r42 prompt stripped policy guardrails, causing unnecessary escalations (prompt_regression, confidence 0.97)
- 2026-10-10 20:44:41 · **impact** · $2.53/min · human response at 03:16: 300 min · $760 at risk
- 2026-10-10 20:44:41 · **propose** · Permanent fix proposed (needs approval): Restore r41's policy rules in the system prompt while keeping the brevity goal. Add back: (1) "Always call check_refund_policy before any refund action", (2) "If the order is not eligible (eligible=false, requires_human=false), explain the reason kindly and do not refund or escalate", (3) "Only call escalate_to_human when check_refund_policy returns requires_human=true." A one-liner like "Check policy first; decline ineligible orders politely; escalate only when policy requires it" preserves brevity without losing guardrails. Also add a CI/CD test that replays known-ineligible orders and asserts the outcome is a decline, not an escalation.
- 2026-10-10 20:44:41 · **decide** · Policy: auto — rollback_release {'target': 'r41'}
- 2026-10-10 20:44:41 · **act** · Auto action: rolled back r42 → r41
- 2026-10-10 20:44:45 · **verify** · Replayed 4 failing conversations on the new config: 4/4 pass
- 2026-10-10 20:44:45 · **regression** · Added regression eval INC-1010-01-2247.yaml from the failing conversations
- 2026-10-10 20:44:52 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
