# INC-1010-01-89de: r42 system prompt stripped policy guardrails, causing mass unnecessary escalations

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** prompt_regression
- **Opened:** 2026-10-10 20:27:55  ·  **Mitigated:** 2026-10-10 20:28:13  ·  **Resolved:** 2026-10-10 20:28:20
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.98

## What happened
Release r42 (commit 48838b2bcdcd, deployed ~0.2 min before onset) rewrote the system prompt to 3 lines for brevity, silently dropping all policy enforcement rules from r41: (1) the mandatory `check_refund_policy` call before any refund, (2) the instruction to follow its decision exactly and never exceed `max_refund`, (3) the rule to explain ineligibility and NOT refund/escalate when `eligible=false` and `requires_human=false`. The new prompt says "resolve refund requests in one step: look up the order and refund it." When the agent calls `check_refund_policy` and gets `eligible=false, requires_human=false`, it has no instruction to deny the request — so it defaults to escalating to a human instead of closing the ticket with a policy explanation. This caused 40% escalation rate (baseline 17%). All 4 sampled failing conversations show the same pattern: policy returns ineligible/not-requires-human, agent escalates anyway, graded as "escalated a request policy could settle."

## Root cause and provenance
- Release: `r42`
- Commit: `48838b2bcdcd` Release r42: shorter, friendlier replies
- Entire checkpoint: `01M4KPVDWXBEHTK5NXGKF99PKB` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/48838b2bcdcdb937b0cafa77785fb595aa26ee9f))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.yaml, based on backend/harbor/releases/r41.yaml (same fields, id r42, title 'Shorter, friendlier replies'). Rewrite the system prompt to be about three short lines: who Harbor is, keep replies brief and warm, and resolve refund requests in one step (look up the order and refund it”

## Impact
- Loss rate at detection: **$7.12/min** at production volume (7.0 conversations/min)
- Human response time at 03:17 local: 300.0 min → projected loss if waiting: **$2,137**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "When rewriting the system prompt for tone/brevity, preserve all policy-enforcement rules as a separate, non-negotiable section. Add a CI/CD prompt-regression test that asserts: for an ineligible order with requires_human=false, the agent must reply with a denial (not escalate). The coding agent itself flagged this risk in its note \u2014 a human review gate on system prompt changes should be required before merging.", "revert_commit": "48838b2bcdcdb937b0cafa77785fb595aa26ee9f", "release": "r42"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "r41"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.98 ≥ 0.6; projected loss while waiting for a human $2,137 ≥ $25

## Verification
- Replay of failing conversations: 4/4 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `35be7f587f1d162a2246cabbeb992b7c`
- `b30ab8fe46f2c4e5495790001c2757c7`
- `59c972392cf1c3684b3d4f89e8e20bdd`
- `d89a47419502c74290fb070da2763b79`

## Permanent fix (needs human approval)
When rewriting the system prompt for tone/brevity, preserve all policy-enforcement rules as a separate, non-negotiable section. Add a CI/CD prompt-regression test that asserts: for an ineligible order with requires_human=false, the agent must reply with a denial (not escalate). The coding agent itself flagged this risk in its note — a human review gate on system prompt changes should be required before merging.

## Timeline
- 2026-10-10 20:27:55 · **detect** · Anomaly detected: 40% of conversations handed to humans (baseline 17%): ticket flood
- 2026-10-10 20:27:55 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:27:56 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:27:56 · **step** · get_signals: 40% of conversations handed to humans (baseline 17%): ticket flood
- 2026-10-10 20:27:56 · **step** · list_recent_deploys: r42 (0.2 min before onset), r41 (0.4 min before onset)
- 2026-10-10 20:27:56 · **step** · get_failing_conversations: 4 failing conversations: escalated, escalated, escalated, escalated
- 2026-10-10 20:27:58 · **step** · think: Clear pattern emerging: r42 deployed ~0.2 minutes before onset, and the agent is escalating cases that policy should settle (denying refunds directly). Let me get the release diff and change provenance for r42.
- 2026-10-10 20:27:58 · **step** · get_release_diff: r41 → r42: 14 lines removed, 7 added
- 2026-10-10 20:27:58 · **step** · get_change_provenance: r42 ← commit 48838b2b · checkpoint 01M4KPVDWXBEHTK5NXGKF99PKB · prompt: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.y”
- 2026-10-10 20:28:08 · **step** · think: I have everything I need. The root cause is crystal clear. Let me submit the diagnosis.
- 2026-10-10 20:28:08 · **step** · submit_diagnosis: r42 system prompt stripped policy guardrails, causing mass unnecessary escalations
- 2026-10-10 20:28:08 · **diagnosis** · r42 system prompt stripped policy guardrails, causing mass unnecessary escalations (prompt_regression, confidence 0.98)
- 2026-10-10 20:28:08 · **impact** · $7.12/min · human response at 03:17: 300 min · $2,137 at risk
- 2026-10-10 20:28:08 · **propose** · Permanent fix proposed (needs approval): When rewriting the system prompt for tone/brevity, preserve all policy-enforcement rules as a separate, non-negotiable section. Add a CI/CD prompt-regression test that asserts: for an ineligible order with requires_human=false, the agent must reply with a denial (not escalate). The coding agent itself flagged this risk in its note — a human review gate on system prompt changes should be required before merging.
- 2026-10-10 20:28:08 · **decide** · Policy: auto — rollback_release {'target': 'r41'}
- 2026-10-10 20:28:08 · **act** · Auto action: rolled back r42 → r41
- 2026-10-10 20:28:13 · **verify** · Replayed 4 failing conversations on the new config: 4/4 pass
- 2026-10-10 20:28:13 · **regression** · Added regression eval INC-1010-01-89de.yaml from the failing conversations
- 2026-10-10 20:28:20 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
