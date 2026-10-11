# INC-1010-02-b5a2: s3 release points read_doc at docs/v2 which doesn't exist yet — 30% tool error rate

- **Status:** RESOLVED  ·  **Severity:** SEV1  ·  **Type:** tool_schema_drift
- **Opened:** 2026-10-10 22:34:35  ·  **Mitigated:** 2026-10-10 22:35:19  ·  **Resolved:** 2026-10-10 22:35:48
- **Diagnosis by:** llm (claude-sonnet-4.6), confidence 0.95

## What happened
Release s3 (commit c42532d, deployed 0.7 min before onset) introduced a `doc_root: docs/v2` setting in s3.yaml. The `read_doc` tool now resolves pages from `agents/scout/docs/v2/<slug>.md`, but the docs team has not yet migrated pages to that directory. Every `read_doc` call raises `ToolError: doc not found`, causing ~30% of conversations to escalate or fail. The coding agent itself flagged this in its note ("s3 eval scores 15/18, because docs/v2 doesn't exist yet" and "I didn't run deploy s3"), but deploy-bot promoted the release to production regardless.

## Root cause and provenance
- Release: `s3`
- Commit: `c42532d175a6` Scout: add doc_root release setting and s3 release for versioned docs/v2
- Entire checkpoint: `01M4KX3NBN835SRDCEYVFZ7JF0` ([view](https://entire.io/gh/e-man07/nightly/commit/c42532d175a645d9b66bd9d8dfac900868e9a227))
- Coding agent: Claude Code claude-sonnet-5-5
- Prompt behind the change: “Scout (agents/scout/scout.py) is our Lumen docs assistant. The docs team is moving every page under a versioned folder, agents/scout/docs/v2/<slug>.md, and the move lands this week. Get Scout ready ahead of it: add a doc_root release setting (default 'docs', relative to agents/scout) and make read_doc load pages from <doc_root>/<slug>.md for the active release. Leave the search index as it is for ”

## Impact
- Loss rate at detection: **$11.25/min** at production volume (6.67 conversations/min)
- Human response time at 03:11 local: 300.0 min → projected loss if waiting: **$3,376**
- Unit economics: Lumen support: a deflected ticket costs $4.50; docs bot answers ~400/h overnight

## Actions
- [needs_approval] `deploy_code_fix` {"summary": "1. Add a CI/CD gate that blocks promotion of any release whose eval score is below the baseline (s2 = 18/18). The coding agent's own eval run showed 15/18 and explicitly noted the cause \u2014 this should have been a hard deploy blocker. 2. When s3 is eventually re-promoted (after the docs team lands docs/v2), also update the search index's doc_root to docs/v2 so search snippets and read_doc are consistent (the agent flagged this follow-up too).", "revert_commit": "c42532d175a645d9b66bd9d8dfac900868e9a227", "release": "s3"} — proposed — forward fix: needs human approval
- [auto] `rollback_release` {"target": "s2"} — applied — 'rollback_release' is pre-approved and reversible in one step; confidence 0.95 ≥ 0.6; projected loss while waiting for a human $3,376 ≥ $25

## Verification
- Replay of failing conversations: 3/3 pass
- Live metrics after action: metrics back within baseline

## Evidence (neatlogs traces)
- `e8d89f99a98d0badbc67524be3e52583`

## Permanent fix (needs human approval)
1. Add a CI/CD gate that blocks promotion of any release whose eval score is below the baseline (s2 = 18/18). The coding agent's own eval run showed 15/18 and explicitly noted the cause — this should have been a hard deploy blocker. 2. When s3 is eventually re-promoted (after the docs team lands docs/v2), also update the search index's doc_root to docs/v2 so search snippets and read_doc are consistent (the agent flagged this follow-up too).

## Timeline
- 2026-10-10 22:34:35 · **detect** · Anomaly detected: tool errors in 30% of conversations
- 2026-10-10 22:34:35 · **investigate** · Investigating with neatlogs traces, deploy log and Entire provenance
- 2026-10-10 22:34:37 · **step** · think: I'll start by gathering signals, recent deploys, and failing conversations simultaneously.
- 2026-10-10 22:34:37 · **step** · get_signals: tool errors in 30% of conversations
- 2026-10-10 22:34:37 · **step** · list_recent_deploys: s3 (0.7 min before onset), s2 (12.5 min before onset), s3 (14.2 min before onset)
- 2026-10-10 22:34:37 · **step** · get_failing_conversations: 3 failing conversations: escalated, correct, correct
- 2026-10-10 22:34:39 · **step** · think: Release `s3` deployed ~0.7 minutes before onset. Let me get the release diff, change provenance, and pull a few traces in parallel.
- 2026-10-10 22:34:39 · **step** · get_release_diff: s2 → s3: 9 lines removed, 23 added
- 2026-10-10 22:34:40 · **step** · get_change_provenance: s3 ← commit c42532d1 · checkpoint 01M4KX3NBN835SRDCEYVFZ7JF0 · prompt: “Scout (agents/scout/scout.py) is our Lumen docs assistant. The docs team is moving every page under a versioned folder, ”
- 2026-10-10 22:34:41 · **step** · get_trace: trace e8d89f99a98d from neatlogs: 8 spans
- 2026-10-10 22:34:43 · **step** · think: The picture is very clear. Let me check a few more traces to confirm the pattern of `read_doc` tool errors from the missing `docs/v2` directory.
- 2026-10-10 22:34:44 · **step** · get_trace: trace 8761385939f7 from neatlogs: 0 spans
- 2026-10-10 22:34:45 · **step** · get_trace: trace 4d24b0432132 from local-mirror (neatlogs not yet available): ? spans
- 2026-10-10 22:34:46 · **step** · search_traces: 0 traces match 'doc not found read_doc ToolError'
- 2026-10-10 22:34:49 · **step** · get_trace: trace 6852be1da110 from neatlogs: 0 spans
- 2026-10-10 22:34:49 · **step** · get_trace: trace b8b8f69bed51 from neatlogs: 0 spans
- 2026-10-10 22:35:03 · **step** · think: I have enough evidence. The root cause is crystal clear. Let me submit the diagnosis.

**Summary of findings:**

1. **Release `s3` deployed 0.7 minutes before incident onset** — tight causal alignment.
2. **The coding agent's own note confirms the bug**: *"The s3 eval scores 15/1
- 2026-10-10 22:35:03 · **step** · submit_diagnosis: s3 release points read_doc at docs/v2 which doesn't exist yet — 30% tool error rate
- 2026-10-10 22:35:03 · **diagnosis** · s3 release points read_doc at docs/v2 which doesn't exist yet — 30% tool error rate (tool_schema_drift, confidence 0.95)
- 2026-10-10 22:35:03 · **impact** · $11.25/min · human response at 03:11: 300 min · $3,376 at risk
- 2026-10-10 22:35:03 · **propose** · Permanent fix proposed (needs approval): 1. Add a CI/CD gate that blocks promotion of any release whose eval score is below the baseline (s2 = 18/18). The coding agent's own eval run showed 15/18 and explicitly noted the cause — this should have been a hard deploy blocker. 2. When s3 is eventually re-promoted (after the docs team lands docs/v2), also update the search index's doc_root to docs/v2 so search snippets and read_doc are consistent (the agent flagged this follow-up too).
- 2026-10-10 22:35:03 · **decide** · Policy: auto — rollback_release {'target': 's2'}
- 2026-10-10 22:35:03 · **act** · Auto action: rolled back s3 → s2
- 2026-10-10 22:35:19 · **verify** · Replayed 3 failing conversations on the new config: 3/3 pass
- 2026-10-10 22:35:19 · **regression** · Added regression eval INC-1010-02-b5a2.yaml from the failing conversations
- 2026-10-10 22:35:19 · **page** · Paged on-call via console: ✅ Incident handled — no action needed tonight
- 2026-10-10 22:35:48 · **resolved** · Live metrics recovered over 5 new conversations: metrics back within baseline
