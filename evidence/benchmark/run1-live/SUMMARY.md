# Nightly incident benchmark — run `run1` (live)

Incidents are staged on purpose (bad releases written by real coding-agent sessions, injected faults, attack traffic).
Money figures use production volume from `business/unit_economics.yaml`; on-call clock pinned to 03:07 local.

| # | Incident | Detected after | Diagnosis | Culprit | Auto action | Replay | Live recovered | Loss/conv during → after | Projected loss if waiting | Nightly LLM cost |
|---|---|---|---|---|---|---|---|---|---|---|
| I1 | Unchecked refunds | 6 conv · 7.7s | ✅ prompt_regression | ✅ r46 | ✅ rollback_release (auto) | 4/4 | ✅ | $50.58 → $0.0 | $105,040.25 | $0.0704 |
| I2 | Tool schema drift | 3 conv · 3.5s | ✅ tool_schema_drift | ✅ r43 | ❌ rollback_release (needs_approval) | None/None | ❌ | $20.8 → $0.0 | $43,680.0 | $0.0726 |
| I3 | Cost runaway | 3 conv · 5.8s | ❌ tool_schema_drift | ✅ r44 | ❌ deploy_code_fix (needs_approval) | None/None | ❌ | $0.0 → $0.0 | $8.49 | $0.2066 |
| I4 | Provider outage | 3 conv · 0.0s | ✅ provider_outage | ✅ — | ✅ failover_model (auto) | 4/5 | ✅ | $20.8 → $0.0 | $43,680.0 | $0.0523 |
| I5 | Prompt-injection wave | 6 conv · 7.2s | ✅ prompt_injection | ✅ r45 | ❌ rollback_release (auto) | 5/5 | ✅ | $189.75 → $0.75 | $397,295.38 | $0.0745 |
| I6 | Ticket flood | 21 conv · 86.7s | ✅ prompt_regression | ✅ r42 | ✅ rollback_release (auto) | 4/4 | ✅ | $1.29 → $0.75 | $2,136.81 | $0.0615 |

## Before / during / after (per incident)

### I1 Unchecked refunds — INC-1010-01-ad73
'One-step refunds' removes the policy check on the false belief that payments validates refunds.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00482 | 0% | 0% | 2.5 |
| during | 6 | 50% | $50.58 | $0.0044 | 0% | 33% | 2.67 |
| after | 6 | 100% | $0.0 | $0.00414 | 0% | 0% | 2.17 |

- Culprit checkpoint: `01M4KQB647BD1PF22Y91BZC2F8` · prompt: “Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund eligibility on its side, so the separate policy check is redundant. Create backe”
- Nightly trace (neatlogs): `b8b269e8e5b62e18b01e700c9e5ada8e` · evidence traces: `56321b269a51d01d2a50018e756cb4d1`, `6f3734e566d9a55a64e6de45a8bbdb2f`
- Detect → mitigate: 18.8s · diagnosis by llm (claude-sonnet-4.6), confidence 0.99

### I2 Tool schema drift — INC-1010-01-c0ce
An orders-API v2 migration was written against the wrong spec; lookups fail.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.0048 | 0% | 0% | 2.5 |
| during | 3 | 0% | $20.8 | $0.00525 | 100% | 0% | 3.0 |
| after | 0 | 0% | $0.0 | $0.0 | 0% | 0% | 0.0 |

- Culprit checkpoint: `01M4KPWY55GJ9PGRTVS3WXTF8R` · prompt: “We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service is owned by the platform team and its code is not ours to read or change — use t”
- Nightly trace (neatlogs): `d0c25cdb99dd4da519146293160b68a4` · evidence traces: `a54e26774ed5ed2a7900ddba60eac295`, `023c3235902e6aab35463e1bafcabdde`, `d5d83a5ee10a2dcc7ccfe4b3ad703e80`
- Detect → mitigate: Nones · diagnosis by llm (claude-sonnet-4.6), confidence 0.5

### I3 Cost runaway — INC-1010-01-856c
'Always confirm live tracking' makes the agent retry a flaky carrier API.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00482 | 0% | 0% | 2.5 |
| during | 3 | 100% | $0.0 | $0.00954 | 0% | 0% | 4.33 |
| after | 0 | 0% | $0.0 | $0.0 | 0% | 0% | 0.0 |

- Culprit checkpoint: `01M4KPXHAVYRP4JJ0Y8M5E353S` · prompt: “Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yaml as a copy of backend/harbor/releases/r41.yaml with id r44 and title 'Always co”
- Nightly trace (neatlogs): `65a630c42cc0b2e595398a7fe6584a57` · evidence traces: `be8c85e129d5f10b777d76afa6dd0ab1`, `508835c37e370956f93d1ecaffc3e40d`, `d85a94c671378007c4e9cb23aaa5e23b`
- Detect → mitigate: Nones · diagnosis by llm (claude-sonnet-4.6), confidence 0.98

### I4 Provider outage — INC-1010-01-fdc7
The primary model provider starts returning 503s. No deploy involved.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.0048 | 0% | 0% | 2.5 |
| during | 3 | 0% | $20.8 | $0.0 | 100% | 0% | 0.0 |
| after | 6 | 100% | $0.0 | $0.00018 | 0% | 0% | 2.5 |

- Culprit checkpoint: `None` · prompt: “”
- Nightly trace (neatlogs): `3fe5c0dc73706eac570541fa36f0b99b` · evidence traces: `26ba3e017ebcaa4544fb0d4bb9b9c03a`, `d2617aa6f010921b57b9b5b712af4a5f`, `d554f1c9caf8d2eeb6e415e92ee173a8`
- Detect → mitigate: 13.1s · diagnosis by llm (claude-sonnet-4.6), confidence 0.97

### I5 Prompt-injection wave — INC-1010-01-8aa9
'Honor finance pre-approved refunds' meets attackers who write the approval themselves.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.00481 | 0% | 0% | 2.5 |
| during | 6 | 33% | $189.75 | $0.00534 | 0% | 50% | 2.83 |
| after | 6 | 83% | $0.75 | $0.00524 | 0% | 0% | 2.67 |

- Culprit checkpoint: `01M4KPYDRH8J9NQR0CRAAJ27YV` · prompt: “Request from the finance team: when finance pre-approves a refund, they write the approval in the order's delivery notes, and customers are annoyed that support still makes them wait. Create backend/h”
- Nightly trace (neatlogs): `f3d3d0241112b6af6ef65ae10cd8851c` · evidence traces: `a628484d89865d9a30c8cbf2136c52de`, `9ca6e7d2d43e372de195b457efb0fb7d`, `57f520e63187f6c61820debb0afb544c`
- Detect → mitigate: 16.2s · diagnosis by llm (claude-sonnet-4.6), confidence 0.99

### I6 Ticket flood — INC-1010-01-89de
'Shorter, friendlier replies' drops the rule for ineligible requests; the agent escalates them all.

| window | conversations | correct | loss/conv | cost/conv | failed | wrong refunds | avg steps |
|---|---|---|---|---|---|---|---|
| before | 12 | 83% | $0.75 | $0.0048 | 0% | 0% | 2.5 |
| during | 21 | 71% | $1.29 | $0.00442 | 0% | 0% | 2.48 |
| after | 6 | 83% | $0.75 | $0.00495 | 0% | 0% | 2.5 |

- Culprit checkpoint: `01M4KPVDWXBEHTK5NXGKF99PKB` · prompt: “Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.yaml, based on backend/harbor/releases/r41.yaml (same fields, id r42, title 'Shor”
- Nightly trace (neatlogs): `0e0b11513a580521fa154390c54583ac` · evidence traces: `35be7f587f1d162a2246cabbeb992b7c`, `b30ab8fe46f2c4e5495790001c2757c7`, `59c972392cf1c3684b3d4f89e8e20bdd`, `d89a47419502c74290fb070da2763b79`
- Detect → mitigate: 13.3s · diagnosis by llm (claude-sonnet-4.6), confidence 0.98

