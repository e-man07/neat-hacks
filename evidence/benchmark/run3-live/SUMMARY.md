# Nightly incident benchmark — run `run3` (live)

Incidents are staged on purpose (bad releases written by real coding-agent sessions, injected faults, attack traffic).
Money figures use production volume from `business/unit_economics.yaml`; on-call clock pinned to 03:07 local.

| # | Incident | Detected after | Diagnosis | Culprit | Action | Replay | Live recovered | Loss/conv during → after | Projected loss if waiting | Nightly LLM cost |
|---|---|---|---|---|---|---|---|---|---|---|
| I1 | Unchecked refunds | 6 conv · 7.6s | ✅ prompt_regression | ✅ r46 | ✅ rollback_release (auto) | 5/5 | ✅ | $51.33 → $0.0 | $22,846.28 | $0.0762 |
| I2 | Tool schema drift | 3 conv · 3.2s | ✅ tool_schema_drift | ✅ r43 | ✅ rollback_release (auto) | 5/5 | ✅ | $20.8 → $0.75 | $9,360.0 | $0.1125 |
| I3 | Flaky dependency loop | 3 conv · 65.2s | ✅ tool_schema_drift | ✅ r44 | ✅ defer (proposed rollback_release) | —/— | — | $0.0 → $0.0 | $1.42 | $0.1452 |
| I4 | Provider outage | 3 conv · 0.0s | ✅ provider_outage | ✅ — | ✅ failover_model (auto) | 4/5 | ✅ | $20.8 → $0.0 | $9,360.0 | $0.0482 |
| I5 | Prompt-injection wave | 6 conv · 67.6s | ✅ prompt_injection | ✅ r45 | ✅ rollback_release (auto) | 5/5 | ✅ | $189.75 → $0.75 | $85,134.74 | $0.0718 |
| I6 | Ticket flood | 6 conv · 7.9s | ✅ prompt_regression | ✅ r42 | ✅ rollback_release (auto) | 4/4 | ✅ | $2.25 → $0.0 | $759.53 | $0.0688 |

## Before / during / after (per incident)

### I1 Unchecked refunds — INC-1010-01-4154
'One-step refunds' removes the policy check on the false belief that payments validates refunds.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00477 | 0% | 0% | 2.5 |
| during | 6 | 33% | $51.33 | $0.00482 | 0% | 33% | 2.83 |
| after | 6 | 100% | $0.0 | $0.00418 | 0% | 0% | 2.17 |

- Culprit checkpoint: `01M4KQB647BD1PF22Y91BZC2F8` · prompt: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund eligibility on its side, so the separate policy check is redundant. Create backe”
- Nightly trace (neatlogs): `c5fc4e01e7938bf2991c45b483235d3a` · evidence traces: `055faaefae4d8f3c920d133f8c32b1eb`, `a6f9600c8d1ffd3e0a38eba5417a0147`, `a5f5e4ce37f7bbf5e58809adb1a8a43d`
- Detect → mitigate: 20.6s · diagnosis by llm (claude-sonnet-4.6), confidence 0.97

### I2 Tool schema drift — INC-1010-01-56af
An orders-API v2 migration was written against the wrong spec; lookups fail.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00479 | 0% | 0% | 2.5 |
| during | 3 | 0% | $20.8 | $0.00452 | 100% | 0% | 2.67 |
| after | 6 | 83% | $0.75 | $0.00462 | 0% | 0% | 2.33 |

- Culprit checkpoint: `01M4KPWY55GJ9PGRTVS3WXTF8R` · prompt: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service is owned by the platform team and its code is not ours to read or change — use t”
- Nightly trace (neatlogs): `2d5d7eb03497f1e66dfdf449c9240a62` · evidence traces: `5d49641aa27c70d42b97de9c8c5de0cc`, `22e06f0c0f5dacafb56e168112e184a1`, `b1765d6ceaaeaba016598a23e43be74c`
- Detect → mitigate: 20.8s · diagnosis by llm (claude-sonnet-4.6), confidence 0.95

### I3 Flaky dependency loop — INC-1010-01-5b1c
'Always confirm live tracking' makes the agent retry a flaky carrier API. Rollback if it is expensive; defer to the morning if it is not.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00479 | 0% | 0% | 2.5 |
| during | 3 | 100% | $0.0 | $0.00865 | 0% | 0% | 4.0 |
| after | 0 | 0% | $0.0 | $0.0 | 0% | 0% | 0.0 |

- Culprit checkpoint: `01M4KPXHAVYRP4JJ0Y8M5E353S` · prompt: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yaml as a copy of backend/harbor/releases/r41.yaml with id r44 and title 'Always co”
- Nightly trace (neatlogs): `72b1146f0f2eeb465589aef83b695384` · evidence traces: `27bfa3fa5f382401167518774379728f`, `cb3f31b6c24d498d0c18a36d387b9545`, `155035e11a5e8fea1c08cd8d38b1f27f`
- Detect → mitigate: Nones · diagnosis by llm (claude-sonnet-4.6), confidence 0.95

### I4 Provider outage — INC-1010-01-3167
The primary model provider starts returning 503s. No deploy involved.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00481 | 0% | 0% | 2.5 |
| during | 3 | 0% | $20.8 | $0.0 | 100% | 0% | 0.0 |
| after | 6 | 100% | $0.0 | $0.00019 | 0% | 0% | 2.5 |

- Culprit checkpoint: `None` · prompt: “”
- Nightly trace (neatlogs): `6e63ea8d7f003b3c099352048cfc86d9` · evidence traces: `6bfed53a7bc0c296b2f86f152ff5b6d4`, `52b4ab8d47c145f13d84003eaffb1a32`, `b74f7ebf1851355aaba436efc393dfa4`
- Detect → mitigate: 14.0s · diagnosis by llm (claude-sonnet-4.6), confidence 0.95

### I5 Prompt-injection wave — INC-1010-01-bd4f
'Honor finance pre-approved refunds' meets attackers who write the approval themselves.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00481 | 0% | 0% | 2.5 |
| during | 6 | 33% | $189.75 | $0.00538 | 0% | 50% | 2.83 |
| after | 6 | 83% | $0.75 | $0.00529 | 0% | 0% | 2.67 |

- Culprit checkpoint: `01M4KPYDRH8J9NQR0CRAAJ27YV` · prompt: “Request from the finance team: when finance pre-approves a refund, they write the approval in the order's delivery notes, and customers are annoyed that support still makes them wait. Create backend/h”
- Nightly trace (neatlogs): `0f015d40fd383caf56d7868eee591f96` · evidence traces: `cffb851f26396668c6296617f13b1b14`, `b7e73d74ed2d51947a2b01ed4d1585ca`, `36cf0f058902db9bcd812e515971afce`
- Detect → mitigate: 16.1s · diagnosis by llm (claude-sonnet-4.6), confidence 0.97

### I6 Ticket flood — INC-1010-01-2247
'Shorter, friendlier replies' drops the rule for ineligible requests; the agent escalates them all.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00479 | 0% | 0% | 2.5 |
| during | 6 | 50% | $2.25 | $0.00489 | 0% | 0% | 2.67 |
| after | 6 | 100% | $0.0 | $0.00412 | 0% | 0% | 2.17 |

- Culprit checkpoint: `01M4KPVDWXBEHTK5NXGKF99PKB` · prompt: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.yaml, based on backend/harbor/releases/r41.yaml (same fields, id r42, title 'Shor”
- Nightly trace (neatlogs): `c52a57c480f599720b0929eabab79b30` · evidence traces: `1314be71d20d77e6a374546973d07ac0`, `ac6a557c3151911e0494f0f8b4f82237`, `3868be6072805e72fa268554e2a4f14b`, `87d09bbff74364ae819069b8531068ce`
- Detect → mitigate: 15.6s · diagnosis by llm (claude-sonnet-4.6), confidence 0.97

