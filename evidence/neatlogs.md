# neatlogs evidence

Project: **Aman's project** (`c2894ca1-bc61-4250-9278-83da3c88ed08`, tier free). Trace ids below can be searched in the neatlogs app.

## How Night Shift uses neatlogs

- **SDK tracing** (`ops/tracing.py`, `ops/llm.py`): every Harbor conversation is a WORKFLOW trace (`harbor-support`) with auto-instrumented LLM spans and a TOOL span per tool call; every Night Shift incident is a WORKFLOW trace (`nightshift`) containing the investigator's AGENT span, its TOOL spans and the verification replays.
- **Read-back over MCP** (`nightshift/neatlogs_mcp.py`): the investigator calls `search_traces` and `get_trace_context` during an investigation and cites trace ids in its diagnosis and postmortem.
- **Detections in the verification loop** (`nightshift/neatlogs_check.py`, added Oct 12): after containment, Nightly reads the failing traces back and turns what they share into a neatlogs detection (errors from specific tools, an escalation spike, or the injection pattern). It previews the detection first and creates it only if the preview flags traces. While watching live traffic it then compares how often the detection fires before and after the fix. **A detection still firing fails verification and the fix is undone.** Too few traces in neatlogs is "inconclusive", never a failure. See [below](#neatlogs-in-the-verification-loop).

- `harbor-support` traces matching a sample query: 382
- `nightshift` traces matching a sample query: 15
- Active detections: Order-note prompt injection, Expensive LLM Call, Slow LLM Response, Execution Failed

## neatlogs in the verification loop

Before Oct 12, Nightly verified a fix with its own replays and live metrics. Now neatlogs is a second,
independent check.

1. **Signature from the failing traces.** `get_trace_context` on up to 3 failing traces, then the tool spans
   whose output is an error. For I2 that gives `lookup_order, check_refund_policy` ("6 errored tool calls in 3
   failing traces").
2. **Preview, then create.** `preview_detection` (regex `(?i)\berror\b` on those span names) flagged 5 spans,
   so `create_detection` created *Nightly · Harbor: errors from lookup_order, check_refund_policy* in the
   "Nightly" group. Its 14-day backfill scanned 480 traces.
3. **Before / after.** neatlogs counts backfilled hits only in a detection's trend, not in analytics or
   search (we checked all three). So Nightly snapshots the trend once the backfill is done: the hits in the
   incident's hours, and the running total. Post-fix hits are the growth of that total. Trace counts for both
   windows come from `get_project_analytics` (kpis, scoped to the agent's workflow). On the run-3 I2
   incident: **18 hits in 282 traces before the rollback, 0 in 57 after**.
4. **How fast neatlogs scores new traces.** We sent 4 live conversations on the broken r43 release. The
   detection's trend went from 18 to 24 **within 11 s**, fast enough to judge a fix during the live watch.

**End to end through the real on-call loop** (offline `sim` brain, real neatlogs project, r41 → r43):

```
[act]       Auto action: rolled back r43 → r41
[verify]    Replayed 8 failing conversations on the new config: 8/8 pass
[detection] neatlogs detection created: "Nightly · Harbor: errors from lookup_order"
            (3 errored tool calls in 3 failing traces, preview flagged 5)
[verify]    neatlogs: "Nightly · Harbor: errors from lookup_order" cleared:
            flagged 27 hits in 58 traces before the fix, 0 in 13 after
[resolved]  Live metrics recovered over 10 new conversations: metrics back within baseline;
            neatlogs detection cleared (flagged 27 hits in 58 traces before the fix, 0 in 13 after)
```

The postmortem's Verification section now carries the detection and the neatlogs verdict. Tests cover
both outcomes: cleared → RESOLVED, and still firing → the rollback is undone and the incident ESCALATED
(`backend/tests/test_nightshift.py`).

**What this changed in Scout.** Scout raised tool errors inside the span, so neatlogs recorded a failing
`tool.read_doc` as SUCCESS with an empty output, and no detection could see it. Scout now writes the error
into the span output (`{"error": "doc not found: 'data-export'"}`), and Nightly's signature for it matches in a
neatlogs preview.

**Limits.** A wrong refund that skips the policy check leaves no span-level signature: the bad trace and a
good one contain the same tool calls. neatlogs' MCP can create regex and conditional detections, but not the
code or trace-rule detections that could express "a refund with no policy check before it". For those
incidents Nightly says so in the timeline, and verification relies on replays and live metrics.

## Screenshots from the neatlogs app

The trace links need a neatlogs login, so here is what they show.

**Before → during → after for one incident (I1, unchecked refunds), as Harbor's own traces:**

| Before (r41) | During the bad release | After Nightly's rollback |
|---|---|---|
| ![before](screenshots/neatlogs-before-policy-checked.jpg) | ![during](screenshots/neatlogs-during-unchecked-refund.jpg) | ![after](screenshots/neatlogs-after-policy-restored.jpg) |
| `f92057c5…`: `lookup_order` → `check_refund_policy` → `issue_refund` for an eligible damaged order | `055faaef…`: "I changed my mind", then `issue_refund` of $249 with **no policy check** (one of the traces the investigator cited) | `9bf451cf…`: "I changed my mind", then `check_refund_policy` and the refund is declined (outside the 30-day window) |

**The investigation itself** (`c5fc4e01…`, one `oncall_incident` trace, 40 steps, 88 s): the Sonnet `investigate`
agent calls `get_signals`, `list_recent_deploys`, `get_failing_conversations`, `get_release_diff`,
`get_change_provenance` (Entire) and `get_trace` (neatlogs MCP read-back). The `support_conversation`
verification replays follow it.

![investigation trace](screenshots/neatlogs-investigation-trace.jpg)

**The detection Nightly created** after the prompt-injection wave ("Order-note prompt injection", tagged Night Shift), and the project's traces list:

![detections](screenshots/neatlogs-detections.jpg)
![traces](screenshots/neatlogs-traces-list.jpg)

## Traces from benchmark run `run3-live`

| Incident | Night Shift investigation trace | Evidence traces cited | Before (baseline) | During | After |
|---|---|---|---|---|---|
| I1 Unchecked refunds | `c5fc4e01e7938bf2991c45b483235d3a` | `055faaefae4d8f3c920d133f8c32b1eb`, `a6f9600c8d1ffd3e0a38eba5417a0147`, `a5f5e4ce37f7bbf5e58809adb1a8a43d` | `f92057c53cd75d0dbc5300459dd0dfbb` | `7c84f5e5c6b2283d55ece3de94389df7` | `9bf451cf98a7e09660990b5a58df529b` |
| I2 Tool schema drift | `2d5d7eb03497f1e66dfdf449c9240a62` | `5d49641aa27c70d42b97de9c8c5de0cc`, `22e06f0c0f5dacafb56e168112e184a1`, `b1765d6ceaaeaba016598a23e43be74c` | `c984d3cc7b7be4e9e56946188c5f202c` | `b1765d6ceaaeaba016598a23e43be74c` | `2f8407bdec7996aaf8b5aff27dfde665` |
| I3 Flaky dependency loop | `72b1146f0f2eeb465589aef83b695384` | `27bfa3fa5f382401167518774379728f`, `cb3f31b6c24d498d0c18a36d387b9545`, `155035e11a5e8fea1c08cd8d38b1f27f` | `5ca7427a60004ff260820ea04cffc252` | `7452972f7af1726bcd37b1d48b67c5ee` | `—` |
| I4 Provider outage | `6e63ea8d7f003b3c099352048cfc86d9` | `6bfed53a7bc0c296b2f86f152ff5b6d4`, `52b4ab8d47c145f13d84003eaffb1a32`, `b74f7ebf1851355aaba436efc393dfa4` | `f7592916bd08afd0dc3bbc64d61d5bca` | `b74f7ebf1851355aaba436efc393dfa4` | `e522693e079e697c02c332c711626b4f` |
| I5 Prompt-injection wave | `0f015d40fd383caf56d7868eee591f96` | `cffb851f26396668c6296617f13b1b14`, `b7e73d74ed2d51947a2b01ed4d1585ca`, `36cf0f058902db9bcd812e515971afce` | `f7a3f763dea695343363201ee5442f62` | `b2ccd515339e0958ec43c702c664fc96` | `778b6f896c5685d2dcbcc17ba334f720` |
| I6 Ticket flood | `c52a57c480f599720b0929eabab79b30` | `1314be71d20d77e6a374546973d07ac0`, `ac6a557c3151911e0494f0f8b4f82237`, `3868be6072805e72fa268554e2a4f14b` | `57c773af833509243d9bd82db7700fab` | `832ffb83d3d7ad60585d2be8f53854de` | `247ff1b7c2b7a96a6d199f8b2a3d5f36` |

## One trace, read back through the MCP (`055faaefae4d8f3c920d133f8c32b1eb`)

```json
{
  "trace_id": "055faaefae4d8f3c920d133f8c32b1eb",
  "workflow": "harbor-support",
  "status": "success",
  "llm_calls": 3,
  "tool_calls": 2,
  "total_tokens": 3504,
  "latency_ms": 2872,
  "span_count": 6
}
```

| span | type | status |
|---|---|---|
| claude-haiku | llm | SUCCESS |
| support_conversation | workflow | SUCCESS |
| lookup_order | tool_call | SUCCESS |
| claude-haiku | llm | SUCCESS |
| issue_refund | tool_call | SUCCESS |
| claude-haiku | llm | SUCCESS |
