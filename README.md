# Nightly

**The on-call engineer for your AI agents.** Built for neatHack 2026. (Called *Night Shift* during the build; older evidence files use that name.)

It stops the bleeding by itself, and only wakes you for decisions that can't be undone.

**Live:** https://web-emrq.vercel.app · sign in with GitHub · [SDK docs](https://web-emrq.vercel.app/docs) ·
[sandbox demo, no account needed](https://web-emrq.vercel.app/sandbox)

At 3 AM, a "harmless" change to a production AI agent starts failing. Maybe it pays refunds it
shouldn't, or reads docs from a folder that doesn't exist yet. Every request still returns HTTP 200.
Nightly notices from the agent's neatlogs traces and the outcomes the agent reports. It then
investigates like a senior SRE: traces, deploy log, diff, and the **Entire checkpoint with the prompt
the coding agent was given**. It prices the damage with the **cfo.ai** unit economics, applies the
reversible fix your policy pre-approves, and proves the fix by having your agent replay the failed
runs. Then it pages you once: *handled, here's what it cost, and a permanent fix is waiting for your
approval in Slack.*

> Autonomous within a policy you set. A human approves anything irreversible (code-fix PRs, refunds,
> contacting customers, deleting data). Benchmark incidents are staged on purpose so they're
> reproducible; the Scout incidents ran live through the product.

## For judges: 60 seconds

| neatHack evidence | Where |
|---|---|
| **The agent completes a substantial task** | The whole incident lifecycle: detect → investigate → price → decide → contain → verify → report. Live on two agents: Harbor ([6/6 benchmark](evidence/benchmark/)) and Scout ([two live incidents](evidence/scout/)) |
| **Agent improved (before/after with numbers)** | [`evidence/before-after.md`](evidence/before-after.md): run 1 → run 3, from 4/6 to 6/6 handled correctly, after fixes based on what run 1 showed |
| **Recovers from failures** | Every incident is a failure it recovers from. If a fix fails verification, Nightly undoes it ([`runner.py`](backend/nightshift/runner.py), test `test_failed_verification_undoes_action`). It survived neatlogs losing most of Scout's traces ([`evidence/scout/`](evidence/scout/README.md#what-we-learned-and-changed)) |
| **Used neatlogs** | Every agent run and every investigation is traced. Nightly reads traces back over the neatlogs MCP during investigations, and creates a neatlogs detection after an attack. [`evidence/neatlogs.md`](evidence/neatlogs.md) |
| **Used Entire** | Every bad release was written by a separate Claude Code session with an Entire checkpoint. Nightly resolves commit → checkpoint → prompt → the coding agent's own warning, plus entire-graph change lists. [`evidence/entire.md`](evidence/entire.md) |
| **Used cfo.ai** | [Business plan in cfo.ai](https://app.cfo.ai/s/CsWafbQfu2U1y94W) (pricing, costs, revenue, runway: break-even M08, runway > 24 months) and [customer unit economics in cfo.ai](https://app.cfo.ai/s/fHcCAy2lG_aXs3Qt), which Nightly uses to price every incident. [`business/PLAN.md`](business/PLAN.md) |
| **Built in public** | #neatHack posts, drafted in [`posts/`](posts) |
| **Code written during the hackathon** | Commit history (first commit is the plan only), build log in [`hackathon.md`](hackathon.md) |

## The product

| | |
|---|---|
| **Connect an agent** | A 5-step wizard: name it → add the SDK → paste your neatlogs key (Nightly finds your traces) → what a bad run costs → go live |
| **SDK** (`pip install nightly-sdk`) | Zero dependencies and fails open. Your agent reads its release, model, step cap and kill switches from Nightly. It reports deploys and graded outcomes, and runs verification replays. [`sdk/python/`](sdk/python) |
| **Agent page** | Live metrics, the control plane Nightly steers, deploys (one-click redeploy), traces, a versioned policy editor, economics, credentials |
| **Incident inbox** | Timeline of the investigation, root cause → commit → Entire checkpoint → prompt, $ at risk, replay results, Approve and Undo, and the postmortem Nightly writes |
| **Slack app** | One message per incident, updated as it works, with **Approve fix** and **Undo** buttons. Approving a code fix opens a revert PR on your repo with the postmortem and a regression eval |
| **Policy** | YAML per agent: confidence and money gates, which reversible actions it may take alone, and what always needs a human. The API rejects any "auto" action that isn't reversible |

## How it works

```
 your agent ──(neatlogs SDK traces)──► neatlogs ◄──(MCP read-back)───┐
     │  ▲                                                             │
     │  └── nightly-sdk: release · model · flags · step cap        │
     └────► outcomes, deploys, replay results ──► NIGHT SHIFT ────────┘
                                                   1 WATCH       failures, tool errors, escalations, loops, cost
                                                   2 INVESTIGATE Claude Sonnet + tools: traces, deploy log, diff,
                                                                 Entire checkpoint → prompt, entire-graph
                                                   3 PRICE       $/min × minutes until a human answers (cfo.ai)
                                                   4 DECIDE      your policy: reversible? confident? worth waking you?
                                                   5 CONTAIN     roll back · fail over model · kill switch · cap steps
                                                   6 VERIFY      your agent replays the failed runs; live metrics; auto-undo
                                                   7 REPORT      Slack/ntfy/webhook · postmortem · regression eval · fix PR on approval
```

Spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md) ·
demo script: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

## Results

- **Harbor benchmark** ([`evidence/benchmark/run3-live`](evidence/benchmark/)): six staged incidents
  (unchecked refunds, tool schema drift, flaky-dependency loop, provider outage, prompt-injection
  wave, ticket flood). All six were handled correctly. Five were contained autonomously 13–21 s after
  detection and verified by replay; the low-impact one was deferred to the morning without paging
  anyone. Each investigation cost $0.05–0.15.
- **Scout, live through the product** ([`evidence/scout/`](evidence/scout/)): a bad release written by
  a Claude Code session. Detected about 1.5 min after deploy, rolled back automatically, verified by
  replays Scout ran itself (3/3), resolved in under 3 min. The postmortem quotes the coding agent's
  ignored warning, found through Entire.

## Run it locally

```bash
cp .env.example .env            # LITELLM_API_KEY, NEATLOGS_API_KEY
scripts/dev.sh                  # API on :8000 + web on :3000 (local dev mode, no sign-in)
scripts/dev.sh sim              # offline deterministic brain, no keys needed

cd backend && uv run pytest     # 26 tests
uv run python -m bench.benchmark --brain live           # incident benchmark (~$1.5 of gateway credit)
uv run --project backend python agents/scout/scout.py eval --release s3   # Scout's offline eval
```

Entire checkpoints are on GitHub as `_entire/*` branches (the build sandbox could only push
branches). `scripts/restore_entire_refs.sh` moves them to `refs/entire/*`.

## Repo map

| Path | What |
|---|---|
| `backend/nightshift/` | Detector, investigator, provenance (git + Entire + entire-graph), impact, policy, actions, verifier, reporter, adapters, neatlogs sources |
| `backend/product/` | Workspaces, agents, encrypted secrets, Slack app, paging, GitHub fix PRs, repo clones |
| `backend/api/` | FastAPI: product API, SDK endpoints, Slack endpoints, sandbox, SSE |
| `sdk/python/` | `nightly-sdk` |
| `backend/harbor/` | Harbor, the refunds support agent (releases r42–r46 written by coding-agent sessions) |
| `agents/scout/` | Scout, the docs assistant, connected only through the SDK and neatlogs |
| `web/` | Next.js: site, app, docs, sandbox |
| `business/` | Unit economics, business plan (mirrors cfo.ai), Ari prompts |
| `deploy/` | GCP VM (Caddy HTTPS), Vercel env, Slack manifest |
| `evidence/` | Benchmark runs, before/after, Scout incidents, neatlogs and Entire evidence |

## Honest limitations

- Harbor's customers are simulated from a scenario bank, and its tools act on a sandbox ledger. Scout
  answers questions from a fixed bank about a fictional product.
- Harbor's provider outage is injected in our gateway client, and the prompt-injection traffic is generated.
- The `sim` brain exists for offline demos and tests and is never used for evidence.
- Permanent fixes are proposed as PRs, never merged by Nightly: shipping code is a human decision by design.
- Nightly currently ships a Python SDK only; other agents can call the HTTP API directly.
