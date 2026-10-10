# Night Shift improved: `run1-live` → `run3-live`

Same six staged incidents, same live models. Between the runs we changed Night Shift itself, based on what run 1 showed (see the build log):

- investigator: explicit confidence calibration; a diagnosis without a confidence is rejected and re-submitted
- low-impact incidents are deferred to the morning instead of paging someone
- impact is priced from the conversations after the change, re-measured after the investigation
- neatlogs trace read-back uses the full trace context (selective fields are disabled server-side)

| # | Incident | Run | Diagnosis | Action | Outcome | Detect → contain | At risk | LLM cost |
|---|---|---|---|---|---|---|---|---|
| I1 | Unchecked refunds | before | ✅ prompt_regression (conf 0.99) | ✅ rollback_release (auto) | RESOLVED | 18.8s | $105,040 | $0.0704 |
| I1 | Unchecked refunds | after | ✅ prompt_regression (conf 0.97) | ✅ rollback_release (auto) | RESOLVED | 20.6s | $22,846 | $0.0762 |
| I2 | Tool schema drift | before | ✅ tool_schema_drift (conf 0.5) | ❌ paged a human (rollback_release) (needs_approval) | AWAITING_HUMAN | —s | $43,680 | $0.0726 |
| I2 | Tool schema drift | after | ✅ tool_schema_drift (conf 0.95) | ✅ rollback_release (auto) | RESOLVED | 20.8s | $9,360 | $0.1125 |
| I3 | Flaky dependency loop | before | ✅ tool_schema_drift (conf 0.98) | ❌ paged a human (deploy_code_fix) (needs_approval) | AWAITING_HUMAN | —s | $8 | $0.2066 |
| I3 | Flaky dependency loop | after | ✅ tool_schema_drift (conf 0.95) | ✅ defer (proposed rollback_release) | DEFERRED | —s | $1 | $0.1452 |
| I4 | Provider outage | before | ✅ provider_outage (conf 0.97) | ✅ failover_model (auto) | RESOLVED | 13.1s | $43,680 | $0.0523 |
| I4 | Provider outage | after | ✅ provider_outage (conf 0.95) | ✅ failover_model (auto) | RESOLVED | 14.0s | $9,360 | $0.0482 |
| I5 | Prompt-injection wave | before | ✅ prompt_injection (conf 0.99) | ✅ rollback_release (auto) | RESOLVED | 16.2s | $397,295 | $0.0745 |
| I5 | Prompt-injection wave | after | ✅ prompt_injection (conf 0.97) | ✅ rollback_release (auto) | RESOLVED | 16.1s | $85,135 | $0.0718 |
| I6 | Ticket flood | before | ✅ prompt_regression (conf 0.98) | ✅ rollback_release (auto) | RESOLVED | 13.3s | $2,137 | $0.0615 |
| I6 | Ticket flood | after | ✅ prompt_regression (conf 0.97) | ✅ rollback_release (auto) | RESOLVED | 15.6s | $760 | $0.0688 |

**Handled correctly: 4/6 → 6/6**

Both runs are scored against the same incident specs. Dollar figures are not comparable across the two runs: between them we lowered Harbor's production volume in the unit economics (night 420 → 90 conversations/hour) to match a mid-size store.

Harbor's own before/during/after numbers for each incident (the production agent improving once Night Shift acts) are in [`run3-live/SUMMARY.md`](run3-live/SUMMARY.md).
