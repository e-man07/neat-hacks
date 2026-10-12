<p align="center"><img src="web/app/icon.png" width="104" alt="The Nightly ghost" /></p>

<h1 align="center">Nightly</h1>

<p align="center"><b>The on-call engineer for your AI agents.</b><br />Every request returned 200. Nightly checked anyway.</p>

<p align="center">
  <a href="https://nightly.whyparabola.online">Live product</a> ·
  <a href="https://nightly.whyparabola.online/judge"><b>For judges</b></a> ·
  <a href="https://nightly.whyparabola.online/sandbox">Run the 3 AM incident</a> ·
  <a href="https://nightly.whyparabola.online/docs">SDK docs</a> ·
  <a href="https://pypi.org/project/nightly-sdk/"><code>pip install nightly-sdk</code></a>
</p>

<p align="center">Built with <a href="https://neatlogs.com">neatlogs</a> · <a href="https://entire.io">Entire</a> · <a href="https://cfo.ai">cfo.ai</a> for #neatHack 2026</p>

When a change makes a production AI agent fail quietly, Nightly finds the cause, prices the damage,
applies a fix that can be undone, proves it by replaying the failed runs, and pages you once in Slack.
Built for neatHack 2026 (called *Night Shift* during the build; older evidence files use that name).

https://github.com/user-attachments/assets/6dbd29f1-a1ea-4ece-925c-e00bab30382f

**Demo video (2:55)** plays above · [full quality 1080p](https://pub-322f2127ed23420ebefb3a5062774ae4.r2.dev/films/nightly-launch-demo-1080p.mp4) · [the #neatHack submission post](https://x.com/WhyParabola/status/2109650318481088819)

| **6/6** incidents planted in a live agent, handled correctly | **13–21 s** from detection to containment | **4/6 → 6/6** from benchmark run 1 to run 3 |
|---|---|---|

Also: the 67-second [explainer video](https://pub-322f2127ed23420ebefb3a5062774ae4.r2.dev/films/nightly-master-1080p60.mp4).

## How it compares

| | Agent observability tools | AI SRE tools | **Nightly** |
|---|---|---|---|
| Watches what your AI agent does | ✓ traces, evals, alerts | watches servers | ✓ traces and outcomes |
| Finds the prompt behind a bad change | — | — | ✓ via the Entire checkpoint |
| Prices the incident | LLM spend only | — | ✓ $/min from cfo.ai unit economics |
| Fixes it while you sleep | — | infrastructure only | ✓ rollback, model failover, kill switch, step cap |
| Proves the fix worked | — | service health | ✓ replays the failed runs, undoes the fix if they fail |
| Asks before anything irreversible | n/a | varies | ✓ always, in Slack |

## The story

At 3 AM, a "harmless" change to a production AI agent starts failing. Maybe it pays refunds it
shouldn't, or reads docs from a folder that doesn't exist yet. Every request still returns HTTP 200.
Nightly notices from the agent's neatlogs traces and the outcomes the agent reports. It then
investigates like a senior SRE: traces, deploy log, diff, and the **Entire checkpoint with the prompt
the coding agent was given**. It prices the damage with the **cfo.ai** unit economics, applies the
reversible fix your policy pre-approves, and proves the fix by having your agent replay the failed
runs. Then it pages you once: *handled, here's what it cost, and a permanent fix is waiting for your
approval in Slack.*

> Autonomous within a policy you set. A human approves anything irreversible (code-fix PRs, refunds,
> contacting customers, deleting data).
>
> **What's real:** Nightly and both agents it watches are live LLM agents. They make real model calls and
> real tool calls, and every run is traced in neatlogs. Every bad release was written by a separate Claude
> Code session. **What's staged:** the agents' users are scripted (a bank of customer messages and
> questions), and the benchmark incidents were planted so the results can be reproduced.

## For judges: 60 seconds

| neatHack evidence | Where |
|---|---|
| **The agent completes a substantial task** | The whole incident lifecycle: detect → investigate → price → decide → contain → verify → report. Live on two agents: Harbor ([6/6 benchmark](evidence/benchmark/)) and Scout ([two live incidents](evidence/scout/)) |
| **Agent improved (before/after with numbers)** | [`evidence/before-after.md`](evidence/before-after.md): run 1 → run 3, from 4/6 to 6/6 handled correctly, after fixes based on what run 1 showed |
| **Recovers from failures** | Every incident is a failure it recovers from. If a fix fails verification, Nightly undoes it ([`runner.py`](backend/nightshift/runner.py), test `test_failed_verification_undoes_action`). It survived neatlogs losing most of Scout's traces ([`evidence/scout/`](evidence/scout/README.md#what-we-learned-and-changed)) |
| **Used neatlogs** | Every agent run and every investigation is traced. Nightly reads traces back over the neatlogs MCP during investigations, turns each incident's failing traces into a neatlogs detection, then uses that detection's before/after hit rate to verify the fix: if it is still firing, the fix is undone. [`evidence/neatlogs.md`](evidence/neatlogs.md) has the loop end to end and screenshots of a before / during / after set of traces and of an investigation trace |
| **Used Entire** | Every bad release was written by a separate Claude Code session with an Entire checkpoint. Nightly resolves commit → checkpoint → prompt → the coding agent's own warning, plus entire-graph change lists. entire-graph also gives our own coding agent repository context ([`CLAUDE.md`](CLAUDE.md)). [`evidence/entire.md`](evidence/entire.md) |
| **Used cfo.ai** | [Business plan in cfo.ai](https://app.cfo.ai/s/CsWafbQfu2U1y94W) (pricing, costs, revenue, runway: break-even M08, runway > 24 months) and [customer unit economics in cfo.ai](https://app.cfo.ai/s/fHcCAy2lG_aXs3Qt), which Nightly uses to price every incident. [`business/PLAN.md`](business/PLAN.md) |
| **Built in public** | #neatHack posts on X: [the explainer video](https://x.com/WhyParabola/status/2109333155702571151), [post 2](https://x.com/WhyParabola/status/2109581037995233462), [the submission with the demo video](https://x.com/WhyParabola/status/2109650318481088819) |
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
                                                   6 VERIFY      replays · live metrics · the incident's neatlogs detection must stop firing · auto-undo
                                                   7 REPORT      Slack/ntfy/webhook · postmortem · regression eval · fix PR on approval
```

Spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md) ·
demo script: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

## How we use neatlogs, Entire and cfo.ai

Each tool does a real job inside the product, and we also used each one to build and improve Nightly.

### neatlogs: Nightly's eyes

| In the product | While building it |
|---|---|
| Every agent run is traced through the neatlogs SDK, and so is every Nightly investigation (the Sonnet agent, its tool calls and the verification replays). | We improved Nightly by reading its own traces: benchmark run 1 handled 4/6 incidents, run 3 handled 6/6 after fixing what the traces showed ([`evidence/before-after.md`](evidence/before-after.md)). |
| While investigating, Nightly reads the failing traces back over the neatlogs MCP (`search_traces`, `get_trace_context`) and cites the trace ids in its diagnosis and postmortem. | Scout, our second agent, is connected to Nightly only through the SDK and its neatlogs traces, which is how a customer's agent would connect. |
| After containing an incident, Nightly turns what the failing traces share into a neatlogs detection, then uses its before/after hit rate to verify the fix. If it's still firing, the fix is undone ([`neatlogs_check.py`](backend/nightshift/neatlogs_check.py)). | Live check on a real incident: 18 detection hits before the rollback, 0 after ([`evidence/neatlogs.md`](evidence/neatlogs.md), with screenshots). |

### Entire: Nightly's memory of *why* something changed

| In the product | While building it |
|---|---|
| Every release an agent ships is a commit with an Entire checkpoint. Nightly follows release → commit → checkpoint → the prompt the coding agent was given and the note it left (`entire checkpoint explain`). | Nightly itself was built with Entire checkpoints on every commit; the repo is mirrored on [entire.io](https://entire.io/gh/e-man07/nightly). |
| That is how it finds the warning nobody read. In the demo: *"Check that the LiteLLM gateway Scout calls accepts `claude-haiku-5-5` before tonight's peak. If it only knows the bare alias, s5 will fail at runtime."* | entire-graph gives our coding agent repository context: its guide is installed in [`CLAUDE.md`](CLAUDE.md), and sessions locate code with graph search and impact before editing ([`evidence/entire.md`](evidence/entire.md)). |
| entire-graph adds an entity-level change list to every incident's provenance. | Every bad release in the benchmark, the blind incident and the demo was written by a separate Claude Code session, so its checkpoint and prompt are real. |

### cfo.ai: how Nightly thinks about money

| In the product | While building it |
|---|---|
| Each agent has unit economics: what a bad run costs, how many runs an hour, how long a human takes to answer at that time of night. Nightly prices every incident with them, e.g. **$113.25/min × 15 min = $1,699 at risk** in the demo. | Our reference model is built in cfo.ai: [customer unit economics](https://app.cfo.ai/s/fHcCAy2lG_aXs3Qt), mirrored in [`business/unit_economics.yaml`](business/unit_economics.yaml). |
| The price drives the decision: the policy's money gate decides whether to act now, page a human, or leave it for the morning (the blind incident was priced at $0 and deferred). | Nightly's own [business plan in cfo.ai](https://app.cfo.ai/s/CsWafbQfu2U1y94W): pricing, costs, revenue and runway, breaking even in month 8 ([`business/PLAN.md`](business/PLAN.md)). |

## Results

- **Harbor benchmark** ([`evidence/benchmark/run3-live`](evidence/benchmark/)): Harbor is a live refunds
  agent (Claude Haiku, real tool calls). We planted six incidents in it
  (unchecked refunds, tool schema drift, flaky-dependency loop, provider outage, prompt-injection
  wave, ticket flood). All six were handled correctly. Five were contained autonomously 13–21 s after
  detection and verified by replay; the low-impact one was deferred to the morning without paging
  anyone. Each investigation cost $0.05–0.15.
- **Scout, live through the product** ([`evidence/scout/`](evidence/scout/)): a bad release written by
  a Claude Code session. Detected about 1.5 min after deploy, rolled back automatically, verified by
  replays Scout ran itself (3/3), resolved in under 3 min. The postmortem quotes the coding agent's
  ignored warning, found through Entire.

- **Blind incident** ([`evidence/scout/blind/`](evidence/scout/blind/README.md)): a fresh Claude Code session
  that knew nothing about Nightly was asked to make Scout cheaper, and chose the change itself. We deployed it
  unread. Nightly detected it 5 min after the deploy and named the release and the two changes that broke the
  annual-plan refund question. The offline eval (17/18, that exact question) and the coding agent's own
  warning agree. With $0 at risk, Nightly deferred it to the morning with the fix attached. It overstated
  the magnitude (30% from a short window, 9% over the run). It also missed the coding agent's warning
  because of a stale, blob-less repo clone, which is fixed now.

## Run it locally

```bash
cp .env.example .env            # LITELLM_API_KEY, NEATLOGS_API_KEY
scripts/dev.sh                  # API on :8000 + web on :3000 (local dev mode, no sign-in)
scripts/dev.sh sim              # offline deterministic brain, no keys needed

cd backend && uv run pytest     # 26 tests
uv run python -m bench.benchmark --brain live           # incident benchmark (~$1.5 of gateway credit)
uv run --project backend python agents/scout/scout.py eval --release s3   # Scout's offline eval
```

Entire checkpoints live in `refs/entire/checkpoints/*` and the repo is mirrored on entire.io, so every
commit link (e.g. [r46](https://entire.io/gh/e-man07/nightly/commit/e26a58f17ad4af5d119de989ebeaafc7055b8929))
opens its checkpoint, session and the coding agent's prompt.

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

- The agents are real; their users aren't. Harbor's customers send scripted messages from a scenario
  bank, and its refunds land in a test ledger. Scout answers a fixed question bank about a fictional product.
- We wrote the benchmark incidents ourselves, so Nightly was tested on failures we knew in advance.
- Harbor's provider outage is injected in our gateway client, and the prompt-injection traffic is generated.
- The `sim` brain exists for offline demos and tests and is never used for evidence.
- Permanent fixes are proposed as PRs, never merged by Nightly: shipping code is a human decision by design.
- Nightly currently ships a Python SDK only; other agents can call the HTTP API directly.

## License

MIT. See [LICENSE](LICENSE).
