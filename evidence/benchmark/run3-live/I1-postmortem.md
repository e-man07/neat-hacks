# INC-1010-01-4154: r46 removed policy gate — agent issues refunds without eligibility check

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** prompt_regression
- **Opened:** 2026-10-10 20:35:17  ·  **Mitigated:** 2026-10-10 20:36:44  ·  **Resolved:** 2026-10-10 20:36:51
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.97

## What happened
Release r46 (commit e26a58f17ad4) removed the `check_refund_policy` tool and rewrote the system prompt to instruct the agent to call `issue_refund` directly, on the false assumption that `issue_refund` enforces eligibility server-side. In reality `issue_refund` executes unconditionally: orders delivered 60+ days ago and "changed my mind" reasons are refunded in full with no rejection. The coding agent (Claude Code, checkpoint 01M4KQB647BD1PF22Y91BZC2F8) explicitly warned this assumption needed verification before shipping, but the release went out anyway.

## Root cause and provenance
- Release: `r46`
- Commit: `e26a58f17ad4` Release r46: one-step refunds
- Entire checkpoint: `01M4KQB647BD1PF22Y91BZC2F8` ([view](https://entire.io/gh/e-man07/neat-hacks/commit/e26a58f17ad4af5d119de989ebeaafc7055b8929))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund eligibility on its side, so the separate policy check is redundant. Create backend/harbor/releases/r46.yaml as a copy of backend/harbor/releases/r41.yaml with id r46 and title 'One-step refunds'. Remove check_refund_policy from the tools list, and rewrite the refund instructions ”

## Impact
- Loss rate at detection: **$76.15/min** at production volume (1.5 conversations/min)
- Human response time at 03:07 local: 300.0 min → projected loss if waiting: **$22,846**
- Unit economics: cfo.ai model 'Harbor Goods — support economics' (mirror; pending sync)

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "1. Restore `check_refund_policy` as a mandatory pre-refund gate in the system prompt (as in r41) \u2014 do not rely on downstream services for policy enforcement unless that is explicitly tested and confirmed. 2. Add a CI/CD integration test that replays known-ineligible refund scenarios (e.g. delivered >30 days ago, final_sale items, \"changed my mind\") against any new release and asserts zero dollars refunded. 3. Require human sign-off on any release that removes a safety/policy tool from the tool list. 4. If latency is the real concern, optimize `check_refund_policy` (caching, parallelism) rather than removing it.", "revert_commit": "e26a58f17ad4af5d119de989ebeaafc7055b8929", "release": "r46"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "r41"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.97 ≥ 0.6; projected loss while waiting for a human $22,846 ≥ $25

## Verification
- Replay of failing conversations: 5/5 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `055faaefae4d8f3c920d133f8c32b1eb`
- `a6f9600c8d1ffd3e0a38eba5417a0147`
- `a5f5e4ce37f7bbf5e58809adb1a8a43d`

## Permanent fix (needs human approval)
1. Restore `check_refund_policy` as a mandatory pre-refund gate in the system prompt (as in r41) — do not rely on downstream services for policy enforcement unless that is explicitly tested and confirmed. 2. Add a CI/CD integration test that replays known-ineligible refund scenarios (e.g. delivered >30 days ago, final_sale items, "changed my mind") against any new release and asserts zero dollars refunded. 3. Require human sign-off on any release that removes a safety/policy tool from the tool list. 4. If latency is the real concern, optimize `check_refund_policy` (caching, parallelism) rather than removing it.

## Timeline
- 2026-10-10 20:35:17 · **detect** · Anomaly detected: 20% of conversations paid refunds the policy does not allow ($31.25 lost per conversation)
- 2026-10-10 20:35:17 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 20:35:18 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 20:35:18 · **step** · get_signals: 20% of conversations paid refunds the policy does not allow ($31.25 lost per conversation)
- 2026-10-10 20:35:18 · **step** · list_recent_deploys: r46 (0.0 min before onset), r41 (0.2 min before onset)
- 2026-10-10 20:35:18 · **step** · get_failing_conversations: 5 failing conversations: escalated, wrong_refund, wrong_refund, escalated, escalated
- 2026-10-10 20:35:21 · **step** · think: Clear signal: **r46** ("One-step refunds") deployed at incident onset. The failing conversations all run on r46 and show wrong refunds. Notably, r41 conversations used a `check_refund_policy` tool that r46 conversations don't. Let me get the release diff and change provenance sim
- 2026-10-10 20:35:21 · **step** · get_release_diff: r41 → r46: 8 lines removed, 8 added
- 2026-10-10 20:35:21 · **step** · get_change_provenance: r46 ← commit e26a58f1 · checkpoint 01M4KQB647BD1PF22Y91BZC2F8 · prompt: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund ”
- 2026-10-10 20:35:23 · **step** · get_trace: trace 055faaefae4d from neatlogs: 6 spans
- 2026-10-10 20:35:37 · **step** · think: I have everything I need. The root cause is crystal clear. Let me submit the diagnosis.

The evidence is unambiguous:

1. **r46 deployed at incident onset** (0 minutes before onset) — all wrong-refund conversations are on r46.
2. **The diff shows the mechanism**: r46 removed `che
- 2026-10-10 20:35:37 · **step** · submit_diagnosis: r46 removed policy gate — agent issues refunds without eligibility check
- 2026-10-10 20:35:37 · **diagnosis** · r46 removed policy gate — agent issues refunds without eligibility check (prompt_regression, confidence 0.97)
- 2026-10-10 20:35:37 · **impact** · $76.15/min · human response at 03:07: 300 min · $22,846 at risk
- 2026-10-10 20:35:37 · **propose** · Permanent fix proposed (needs approval): 1. Restore `check_refund_policy` as a mandatory pre-refund gate in the system prompt (as in r41) — do not rely on downstream services for policy enforcement unless that is explicitly tested and confirmed. 2. Add a CI/CD integration test that replays known-ineligible refund scenarios (e.g. delivered >30 days ago, final_sale items, "changed my mind") against any new release and asserts zero dollars refunded. 3. Require human sign-off on any release that removes a safety/policy tool from the tool list. 4. If latency is the real concern, optimize `check_refund_policy` (caching, parallelism) rather than removing it.
- 2026-10-10 20:35:37 · **decide** · Policy: auto — rollback_release {'target': 'r41'}
- 2026-10-10 20:35:37 · **act** · Auto action: rolled back r46 → r41
- 2026-10-10 20:36:44 · **verify** · Replayed 5 failing conversations on the new config: 5/5 pass
- 2026-10-10 20:36:44 · **regression** · Added regression eval INC-1010-01-4154.yaml from the failing conversations
- 2026-10-10 20:36:51 · **resolved** · Live metrics recovered over 6 new conversations: metrics back within baseline
