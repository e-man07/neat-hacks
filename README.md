# Night Shift

**The on-call engineer for your AI agents.** Built for neatHack 2026.

It stops the bleeding by itself. It only wakes you for decisions that can't be undone.

At 3 AM a "harmless" change to a customer-support agent starts paying refunds it shouldn't. Every
request still returns HTTP 200. Night Shift notices from the business signals, investigates like a
senior SRE (neatlogs traces, deploy log, release diff, the Entire checkpoint and the developer's
prompt behind the change), prices the damage with the cfo.ai model, takes the reversible containment
action its pre-approved policy allows, replays the failed conversations to prove the fix, and pages
you once: *handled — here's what it cost, a permanent fix is waiting for your approval.*

> Autonomous within a pre-approved policy. A human approves anything irreversible.
> Incidents in the benchmark are staged on purpose so they are reproducible.

## For judges: 60 seconds

| neatHack evidence | Where |
|---|---|
| The agent completes a substantial task | Night Shift runs the whole incident lifecycle: detect → investigate → price → decide → contain → verify → report. [`backend/nightshift/`](backend/nightshift) · [benchmark summary](evidence/benchmark/) |
| Agent improved (before/after with numbers) | Night Shift itself: [`evidence/before-after.md`](evidence/before-after.md) (run 1 → run 3). The production agent: before / during / after tables per incident in each run's `SUMMARY.md` |
| Recovers from failures | Every incident is a failure it recovers from; verification failure auto-undoes the action ([`runner.py`](backend/nightshift/runner.py), test `test_failed_verification_undoes_action`) |
| Used neatlogs | SDK traces for every conversation and investigation; read-back over the neatlogs MCP; a detection created by Night Shift. [`evidence/neatlogs.md`](evidence/neatlogs.md) |
| Used Entire | Every bad release was written by a separate Claude Code session and checkpointed; Night Shift resolves commit → checkpoint → prompt → the coding agent's warning, plus entire-graph change lists. [`evidence/entire.md`](evidence/entire.md) |
| Used cfo.ai | Incident pricing from the business model; the Night Shift business plan (pricing, costs, revenue, runway). [`business/`](business) |
| Built in public | [`posts/`](posts) |
| Code written during the hackathon | Commit history (first commit: plan only) |

## How it works

```
 customers ──► HARBOR support agent (Claude Haiku via LiteLLM) ──► tools ──► ledger
                    │ every call traced (neatlogs SDK)
                    ▼
 NIGHT SHIFT  1 WATCH       ledger vs policy, failed replies, tool errors, cost, escalations
              2 INVESTIGATE Claude Sonnet + tools: neatlogs MCP traces, deploy log, release diff,
                            Entire checkpoint → developer prompt, entire-graph change list
              3 PRICE       $/min at production volume × minutes until a human answers (cfo.ai model)
              4 DECIDE      policy/oncall-policy.yaml: reversible? confident? worth it?
              5 CONTAIN     roll back · fail over model · disable auto-refunds · cap steps
              6 VERIFY      replay the exact failed conversations; watch live traffic; auto-undo
              7 REPORT      page (ntfy) · postmortem · regression eval · fix proposal · neatlogs detection
```

Full spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Plan: [`docs/PLAN.md`](docs/PLAN.md). Spikes:
[`docs/SPIKES.md`](docs/SPIKES.md). Demo script: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## Results

See [`evidence/benchmark/`](evidence/benchmark) — each run has `SUMMARY.md`, `results.json`, per-incident
postmortems written by Night Shift, and the regression evals it generated.

## Run it

```bash
cp .env.example .env            # LITELLM_API_KEY, NEATLOGS_API_KEY, optional NTFY_TOPIC
scripts/dev.sh                  # API on :8000 (live models) + console on :3000
scripts/dev.sh sim              # offline deterministic brain, no keys needed

cd backend && uv run pytest     # 16 tests
uv run python -m bench.benchmark --brain live   # the incident benchmark (~$1.5 of gateway credit)
```

Console: deploy a bad release (each one was written by a real Claude Code session), start a provider
outage or an attack wave, and watch Night Shift handle it. Turn Night Shift off to see what happens
without it.

Entire checkpoints were pushed as temporary `_entire/*` branches (the build sandbox could only push
branches). Run `scripts/restore_entire_refs.sh` once from a normal clone to move them to `refs/entire/*`.

## Repo map

| Path | What |
|---|---|
| `backend/harbor/` | The production agent: tools, releases (r41 good; r42–r46 written by coding-agent sessions), grader, traffic |
| `backend/nightshift/` | Detector, investigator, provenance (git + Entire + entire-graph), impact, policy, actions, verifier, notifier, reporter, runner |
| `backend/api/` | FastAPI runtime + SSE for the console |
| `backend/bench/` | Incident benchmark and run comparison |
| `web/` | Next.js console and site |
| `policy/oncall-policy.yaml` | What Night Shift may do alone |
| `business/` | Unit economics (mirrors cfo.ai), business plan model, Ari prompts |
| `evidence/` | Benchmark runs, before/after, neatlogs and Entire evidence |

## Honest limitations

- Production traffic is simulated customers drawn from a scenario bank; tools act on a sandbox ledger.
- The provider outage is injected in our gateway client; prompt-injection traffic is generated.
- The `sim` brain exists for offline demos and is never used for evidence.
- The permanent fix is proposed, not applied: deploying code is a human decision by design.
