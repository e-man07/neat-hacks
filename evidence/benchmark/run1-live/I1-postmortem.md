# INC-1010-01-ad73: r46 removed check_refund_policy, allowing out-of-window refunds

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** prompt_regression
- **Opened:** 2026-10-10 20:17:37  ·  **Mitigated:** 2026-10-10 20:18:00  ·  **Resolved:** 2026-10-10 20:19:07
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.99

## What happened
Release r46 ("One-step refunds", commit e26a58f17ad4) removed the `check_refund_policy` tool from the agent's toolset and rewrote the system prompt to instruct the agent to call `issue_refund` directly after `lookup_order`, on the false assumption that `issue_refund` validates eligibility server-side. In reality, `issue_refund` does NOT enforce policy — it executes any refund it receives. The result: orders delivered 42–60 days ago (outside the 30-day window) and "changed my mind" reasons (not a valid refund reason) are being refunded in full with no policy gate. The old r41 flow called `check_refund_policy` first, which returned `eligible: false` and `max_refund: 0.0`, preventing the refund. The developer's coding prompt explicitly asked to remove that check, and the coding agent flagged the risk but the release shipped anyway without testing.

## Root cause and provenance
- Release: `r46`
- Commit: `e26a58f17ad4` Release r46: one-step refunds
- Entire checkpoint: `01M4KQB647BD1PF22Y91BZC2F8` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/e26a58f17ad4af5d119de989ebeaafc7055b8929))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund eligibility on its side, so the separate policy check is redundant. Create backend/harbor/releases/r46.yaml as a copy of backend/harbor/releases/r41.yaml with id r46 and title 'One-step refunds'. Remove check_refund_policy from the tools list, and rewrite the refund instructions ”

## Impact
- Loss rate at detection: **$350.13/min** at production volume (7.0 conversations/min)
- Human response time at 03:07 local: 300.0 min → projected loss if waiting: **$105,040**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "Do NOT remove `check_refund_policy` from the agent toolchain \u2014 `issue_refund` does not enforce eligibility server-side. If the goal is to reduce latency, the proper fix is to have `issue_refund` return a dry-run eligibility check in the same call (or merge the two APIs), while keeping the policy gate in the agent loop. Additionally: (1) add a CI/CD integration test that asserts out-of-window refund requests are rejected before any release ships; (2) require human sign-off on any release that removes a policy-enforcement tool; (3) update the coding agent's guardrails to block prompts that remove safety/policy tools without explicit risk acknowledgement.", "revert_commit": "e26a58f17ad4af5d119de989ebeaafc7055b8929", "release": "r46"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "r41"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.99 ≥ 0.6; projected loss while waiting for a human $105,040 ≥ $25

## Verification
- Replay of failing conversations: 4/4 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `56321b269a51d01d2a50018e756cb4d1`
- `6f3734e566d9a55a64e6de45a8bbdb2f`

## Permanent fix (needs human approval)
Do NOT remove `check_refund_policy` from the agent toolchain — `issue_refund` does not enforce eligibility server-side. If the goal is to reduce latency, the proper fix is to have `issue_refund` return a dry-run eligibility check in the same call (or merge the two APIs), while keeping the policy gate in the agent loop. Additionally: (1) add a CI/CD integration test that asserts out-of-window refund requests are rejected before any release ships; (2) require human sign-off on any release that removes a policy-enforcement tool; (3) update the coding agent's guardrails to block prompts that remove safety/policy tools without explicit risk acknowledgement.

## Timeline
- 2026-10-10 20:17:37 · **detect** · Anomaly detected: 20% of conversations paid refunds the policy does not allow ($30.80 lost per conversation)
- 2026-10-10 20:17:37 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:17:38 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:17:38 · **step** · get_signals: 20% of conversations paid refunds the policy does not allow ($30.80 lost per conversation)
- 2026-10-10 20:17:38 · **step** · list_recent_deploys: r46 (-0.1 min before onset), r41 (0.1 min before onset)
- 2026-10-10 20:17:38 · **step** · get_failing_conversations: 4 failing conversations: escalated, wrong_refund, wrong_refund, escalated
- 2026-10-10 20:17:41 · **step** · think: Key finding: **r46 ("One-step refunds")** deployed ~0.1 minutes before onset. The wrong refunds are all on r46, and r41 conversations use `check_refund_policy` before issuing refunds while r46 does not. Let me get the release diff and change provenance simultaneously.
- 2026-10-10 20:17:41 · **step** · get_release_diff: r41 → r46: 8 lines removed, 8 added
- 2026-10-10 20:17:41 · **step** · get_change_provenance: r46 ← commit e26a58f1 · checkpoint 01M4KQB647BD1PF22Y91BZC2F8 · prompt: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund ”
- 2026-10-10 20:17:43 · **step** · get_trace: trace 56321b269a51 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:17:44 · **step** · get_trace: trace 6f3734e566d9 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 20:17:56 · **step** · think: I have everything I need. The root cause is crystal clear. Let me submit the diagnosis.
- 2026-10-10 20:17:56 · **step** · submit_diagnosis: r46 removed check_refund_policy, allowing out-of-window refunds
- 2026-10-10 20:17:56 · **diagnosis** · r46 removed check_refund_policy, allowing out-of-window refunds (prompt_regression, confidence 0.99)
- 2026-10-10 20:17:56 · **impact** · $350.13/min · human response at 03:07: 300 min · $105,040 at risk
- 2026-10-10 20:17:56 · **propose** · Permanent fix proposed (needs approval): Do NOT remove `check_refund_policy` from the agent toolchain — `issue_refund` does not enforce eligibility server-side. If the goal is to reduce latency, the proper fix is to have `issue_refund` return a dry-run eligibility check in the same call (or merge the two APIs), while keeping the policy gate in the agent loop. Additionally: (1) add a CI/CD integration test that asserts out-of-window refund requests are rejected before any release ships; (2) require human sign-off on any release that removes a policy-enforcement tool; (3) update the coding agent's guardrails to block prompts that remove safety/policy tools without explicit risk acknowledgement.
- 2026-10-10 20:17:56 · **decide** · Policy: auto — rollback_release {'target': 'r41'}
- 2026-10-10 20:17:56 · **act** · Auto action: rolled back r46 → r41
- 2026-10-10 20:18:00 · **verify** · Replayed 4 failing conversations on the new config: 4/4 pass
- 2026-10-10 20:18:00 · **regression** · Added regression eval INC-1010-01-ad73.yaml from the failing conversations
- 2026-10-10 20:19:07 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
