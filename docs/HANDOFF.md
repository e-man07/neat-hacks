# neatHack Handoff: Self-Managing Agent Company

Working title: TBD. Owner: Aman. Audience: Claude Code (builder) and Aman (validator).
Status: PRE-BUILD. Nothing below has been built. Validate the "Go / no-go spikes" section before writing any product code.

Legend used in this doc:
- VERIFIED = read on an official page during research on 2026-10-10.
- UNVERIFIED = came from a secondary source (a competitor's public README, a search snippet) or is my inference. Confirm before relying on it.
- DECISION = needs Aman's answer.

---

## 1. One-paragraph mission

Build a lean team of 3-4 AI agents that run a tiny "company" through one real, checkable goal, managed through neatlogs traces. The CFO agent has real budget authority: it reads per-run cost/failure data from neatlogs and throttles or reroutes the other agents. The headline demo is a planted failure (an agent loops and burns tokens), the CFO agent catches it from the traces, the system recovers, and two tagged neatlogs runs (before/after) show the numbers. neatlogs and Entire support building and improving the agents; cfo.ai plans the business. Positioning line: "an agent company that manages itself through its own observability, and can't overspend itself to death."

Do NOT claim we are "building neatlogs". Claim: the agent team is run on neatlogs.

Honesty rule for all copy, README and demo: say "autonomous within budgets, human approves publishing and deploys." Do not say "fully autonomous."

---

## 2. Event facts and rules (VERIFIED from https://neatlogs.com/hackathon)

- Event: neatHack, online, Oct 10-12, 2026. Hacking starts Sat Oct 10, 12:30 PM IST. Kickoff call 9:00 AM IST same day.
- Team size 1-4. Every member registers on Luma with the same team name. Each person joins only one team.
- One track: "Build an agent that works (literally)". Agent or multi-agent system completing a substantial task start to finish.
- Code must be written during the event. Planning ahead is allowed. Commits must be dated within the window and publicly checkable. A first commit holding only plans/docs is fine. Do NOT commit product code before 12:30 PM IST Oct 10.
- Mandatory: the project must use neatlogs, Entire and cfo.ai, and the demo must cover all three (architecture, implementation, runtime, reasoning, result for each).
- Submission: Mon Oct 12, 7:00-11:55 PM IST, on X, as a public quote post of the official neatlogs submission post, including team, name, project, public repo and demo link. The "Submit on X" button only appears in that window. Opening the draft is not submitting. Late submissions are not judged. neatlogs and cfo.ai engage with the first 50 quote tweets.
- Demo video: 3 minutes max. Public code repo required.
- Winners announced Oct 16.
- Conduct: respectful; harassment, spam, plagiarism = removal. Bought likes or bot activity = disqualification (community award).

### Judging (VERIFIED)
| Category | Weight |
|---|---|
| The agent (substantial task, start to finish) | 30% |
| Use of neatlogs, Entire and cfo.ai | 25% |
| Demo video | 20% |
| Building in public (#neatHack) | 15% |
| Usefulness and originality | 10% |

### Evidence judges can check (VERIFIED)
- Agent improved: a run before a change and a run after, e.g. two neatlogs traces, with the numbers compared.
- Used neatlogs: links to traces or screenshots.
- Used Entire: checkpoints or entire-graph output from the repo.
- Used cfo.ai: a business plan covering pricing, costs, revenue, runway.
- Recovers from failures: a run where an action failed, showing what the agent did next.
- Built in public: links to posts tagged #neatHack.
- Code written during the hackathon: public repo with commits dated in the window.

### Prizes (VERIFIED)
1st $2,000 + $5,000 Dodo credits; 2nd $1,000 + $3,000; 3rd $500 + $1,000; each winner gets 3 months of neatlogs Pro. Separate $500 community winner (judged on genuine engagement and quality of launch/content; follower count does not decide). Crustdata 5,000 credits for everyone. AWS $25 per team for the first 350 teams to complete web check-in.

---

## 3. Concept

### 3.1 Agents (keep it to 4 max)
| Agent | Real output (must be verifiable) | Notes |
|---|---|---|
| Planner / CEO | Task graph + persisted state, assigns work, handles replanning after failures | State must survive crashes (the rubric lists state, recovery, verification). |
| Engineer | Code, tests, commits | Every commit gets an Entire checkpoint. This is the agent that gets the planted failure. |
| CFO | Budget decisions with numbers: throttle / reroute / stop | Reads cost and failures from neatlogs; business plan built in cfo.ai from the same measured costs. |
| Marketer | Drafts #neatHack build-in-public posts | HUMAN approves and publishes. Never auto-post. |

### 3.2 The goal the agents pursue
DECISION (Aman): pick one small, concrete deliverable the Engineer can actually ship and test in about a day. Preferred direction: a small tool useful to neatlogs users (for example a trace-cost / failure watchdog built on the neatlogs Public API/CLI), because it scores on usefulness and keeps the story coherent. Fallback: any small web tool with tests and a deployed URL. The goal must produce a checkable artifact (passing tests, a URL), not a simulated company.

### 3.3 The core loop (this is the product)
1. Planner decomposes goal into tasks and assigns them.
2. Engineer works; every model/tool call is traced in neatlogs, tagged with run id, variant and git sha.
3. CFO polls neatlogs (CLI or Public API) for per-run cost, tokens, retries, failure rate. It applies budget rules and acts.
4. Planted failure: the Engineer enters a loop or repeated failing tool call and burns tokens (inject deliberately and reproducibly with a flag like `--inject loop`).
5. CFO detects the anomaly from trace data, throttles or reroutes (for example cap retries, switch to a cheaper model, or stop and escalate), and the Planner replans.
6. System recovers and completes the task.
7. Compare two neatlogs-tagged runs: `variant:before` (no CFO enforcement) vs `variant:after` (CFO active). Record cost, tokens, retries, success.

### 3.4 Business plan (cfo.ai)
Use measured per-run cost from the neatlogs "after" run as inputs. Cover pricing, costs, revenue, runway. Export the plan and commit it under `business/`.

---

## 4. Resources (read before building)

### 4.1 neatlogs (observability)
| Resource | Link | Status |
|---|---|---|
| App / dashboard | https://app.neatlogs.com | VERIFIED |
| Docs home | https://docs.neatlogs.com | VERIFIED |
| Python SDK install and init | `pip install -U neatlogs`, then `import neatlogs; neatlogs.init()` (docs also show `neatlogs.wrap(OpenAI())` and `@neatlogs.span` in the SDK reference; `init` accepts workflow_name, `flush()`, `shutdown()`) | VERIFIED (basics); confirm exact arg names in SDK reference |
| Setup wizard | `npx @neatlogs/wizard` auto-detects stack and instruments | VERIFIED |
| Official AI skill (for the coding agent) | `npx skills add neatlogs/skills --skill "neatlogs-py"`; repo github.com/neatlogs/skills | VERIFIED (from GitHub README) |
| GitHub | https://github.com/NeatLogs/neatlogs | VERIFIED |
| Public API base | `https://app.neatlogs.com/api/v1/public` | VERIFIED |
| API auth | Bearer service-account token + `x-project-id: <project-uuid>` header | VERIFIED |
| API quickstart / auth / endpoints | https://docs.neatlogs.com/api-reference/quickstart , /authentication , /endpoints | VERIFIED exists; read before use |
| OpenAPI JSON | https://docs.neatlogs.com/openapi/public-api.json | VERIFIED link listed |
| CLI | `npm install --global neatlogs-cli@0.2.0` (Node 22 or 24), `neatlogs auth login`, `neatlogs projects list`, `neatlogs traces list --limit 5`, `neatlogs traces get <id> --json`, `neatlogs traces spans list <id> --json`, `neatlogs traces list --all --max-items 500 --json` | VERIFIED |
| CLI for agents / CI | service-account tokens: https://docs.neatlogs.com/cli/automation | VERIFIED exists; read before use |
| MCP | https://docs.neatlogs.com/integrations/mcp ; also `neatlogs mcp` CLI group | VERIFIED listed; read before use |
| Features worth using | Traces, Detections, Investigate (AI search over traces), Analytics, Fixes, Experiments, Alerts, Sessions | VERIFIED listed |
| Hackathon build-log skill | https://neatlogs.com/hackathon/skill (name: neathack) | VERIFIED, see 4.5 |

Open questions to settle in spikes: exact trace fields for cost and tokens (Public API vs CLI output); whether tags/session ids set in the SDK are filterable via API; ingest-to-queryable latency (matters for a CFO agent that polls).

### 4.2 Entire (checkpoints and code graph)
| Resource | Link | Status |
|---|---|---|
| Home | https://entire.io | VERIFIED |
| Docs | https://docs.entire.io (index at https://docs.entire.io/llms.txt) | VERIFIED |
| CLI install | `curl -fsSL https://entire.io/install.sh | bash` (open source, MIT; repo github.com/entireio/cli) | VERIFIED (from entire.io) |
| What it does | Every commit an agent makes becomes a checkpoint: code change paired with prompt, reasoning, tool calls. Secrets redacted before leaving the machine. Works with Claude Code. | VERIFIED |
| entire-graph | Semantic code graph (github.com/entireio/entire-graph); claims lower token spend | VERIFIED exists; read its README |
| Enable command | `entire enable --agent claude-code ...` appeared in a competitor's README; confirm exact flags in https://docs.entire.io/cli-reference | UNVERIFIED |
| Checkpoint commands | `entire checkpoint list`, `entire checkpoint explain HEAD`, `entire graph search`, `entire graph impact` appeared in competitor READMEs | UNVERIFIED, confirm in CLI reference |
| Capture first checkpoint guide | https://docs.entire.io/guides/checkpoints/capture-checkpoints | VERIFIED link listed |
| Security and privacy | https://docs.entire.io/security | VERIFIED link listed |

Caution (from the hackathon skill and a competitor note): never commit secrets, and do not let secrets land in Entire session transcripts or any committed evidence.

### 4.3 cfo.ai (business plan, and possibly the CFO agent's brain)
| Resource | Link | Status |
|---|---|---|
| neatHack signup | https://cfo.ai/neathacks | VERIFIED. Card required at signup. Cancel subscription immediately in Settings > Billing; the neatHack team provides credits directly. |
| Product | Ari, an AI CFO that builds and updates a financial model (Models, Variables, Dimensions, Scenarios, Pages) | VERIFIED |
| Docs | https://docs.cfo.ai (index at https://docs.cfo.ai/llms.txt) | VERIFIED |
| MCP access | Landing page says you can "ask from your own terminal over MCP" | UNVERIFIED for our use: confirm in docs what the MCP server exposes, auth, and whether another agent can call it programmatically |
| Integrations | Stripe, Salesforce, Rippling, NetSuite, QuickBooks, Sheets, etc. Shown as read-only on the site. | VERIFIED (marketing page) |
| Scenarios feature | Test a change without altering Main, compare outcomes | VERIFIED (docs card) |
| Export of plan | Needed for submission. Pages can be shared read-only; find the export path (xlsx / PDF / share link). | UNVERIFIED, confirm |

Important: the rules say to use cfo.ai "to plan its business" and to include the plan in the submission. Treat that as the guaranteed path. Using cfo.ai as the live decision-making CFO via MCP is a stretch goal. Design so the CFO agent works from neatlogs data with simple, auditable rules first; add cfo.ai (Ari via MCP) as an advisor/what-if layer only if the spike passes.

### 4.4 Other partner resources
| Resource | Details | Status |
|---|---|---|
| Crustdata | 5,000 credits for all participants; API docs https://www.crustdata.com/api-documentation ; credits transferred at hackathon start | VERIFIED. A promo code (`NEATLOGS-OCT2026`) appeared in a competitor's public README; UNVERIFIED, confirm in Discord/Luma before using. Optional for us (company/people data); only use if it serves the goal. |
| AWS | $25 allowance per team, first 350 teams to complete web check-in at https://neatlogs.com/hackathon/check-in/aws ; EC2, Lambda, IAM, load balancers in us-east-1; Bedrock NOT included; model API calls use our own keys billed separately | VERIFIED. Optional; only if we need hosting. |
| Dodo Payments | Winner credits only (top 3) | VERIFIED. Not needed to build. |
| Event links | Luma https://luma.com/s5blr882 ; Discord https://neatlogs.com/discord ; web check-in https://neatlogs.com/hackathon/check-in ; hackathon page https://neatlogs.com/hackathon | VERIFIED |

### 4.5 The hackathon build-log skill (adopt this)
Source: https://neatlogs.com/hackathon/skill (VERIFIED). It tells the coding agent to:
- Read https://neatlogs.com/hackathon and https://luma.com/s5blr882 for current rules; record anything unannounced as pending; never invent weights, prizes, deadlines or links.
- Maintain `hackathon.md` at the repo root, preserving existing entries, with sections: Project, Team (only what Aman chooses to publish), Stack, Build log (dated changes, experiments, failures, fixes, evidence), Demo, Known limitations and next steps, Submission.
- After each work session, append a concise dated entry; distinguish planned vs completed; record tests that actually ran and failures that remain; link only sanitized, shareable evidence.
- Never include API keys, .env contents, personal data, private traces, tokens or customer info. Never fabricate results.
- Never register, publish, deploy or submit on Aman's behalf without explicit instruction.

Install it as `.claude/skills/neathack/SKILL.md` (competitors do the same).

### 4.6 Models and keys Aman must supply
DECISION: which model provider(s) the agents use (OpenAI / Anthropic / other) and the keys. AWS credits do not cover model calls. Keep a `.env.example`; real `.env` is gitignored and never committed.

---

## 5. Go / no-go spikes (do these BEFORE committing to the design)

Time-box each. Accounts, keys and reading docs can happen before 12:30 PM IST; do not write product code before the start time. Spikes that need code run right after the start and should take under about 90 minutes in total. Record each result in `hackathon.md`.

| # | Question | How to check | Pass condition | If it fails |
|---|---|---|---|---|
| S1 | Can we trace a toy agent in neatlogs and see model + tool spans with cost/tokens? | Install SDK, run a 10-line agent, open trace in app | Trace visible with token/cost fields | Use span attributes we compute ourselves; ask in Discord |
| S2 | Can a script read those traces back programmatically? | Create a service account, call `GET /api/v1/public/traces` (or CLI `neatlogs traces list --json`) | Returns cost/tokens/status for our run within seconds-minutes | If latency is high, CFO agent reads our own local span log in parallel and neatlogs remains the system of record |
| S3 | Are tags / session ids from the SDK filterable (to separate `variant:before` vs `variant:after`)? | Tag two toy runs, filter via CLI/API | Can pull each variant separately | Encode variant in `workflow_name` or session id |
| S4 | Entire checkpoints actually appear on agent commits for Claude Code? | Install CLI, enable for the repo, make 1-2 commits, list checkpoints | Checkpoints listed and linkable | Read docs/CLI reference; ask in Discord |
| S5 | Can we produce shareable Entire evidence (checkpoint link/ID, entire-graph output) without leaking secrets? | Inspect what is stored/pushed | Evidence folder generated, secrets redacted | Screenshots plus sanitized text |
| S6 | cfo.ai: can we create the account via the neatHack link, cancel billing, and export a plan? Does the MCP exist and is it usable by another agent? | Sign up, cancel billing right away, build a toy model, find export path, read docs.cfo.ai MCP page | Plan export works (required). MCP callable (stretch). | Skip MCP; CFO agent uses own rules; cfo.ai used for the plan only |
| S7 | Planted failure is reproducible on demand | Add `--inject loop`, run twice | Same failure pattern each time, visible in trace | Tighten the injection |
| S8 | Model API limits and cost for the full loop | One end-to-end dry run with small budget | Under our budget | Cheaper model for Engineer retries |

Go criteria: S1, S2, S4 and the cfo.ai plan export from S6 must pass. If S3 fails, use the workaround. Everything else has a fallback.

---

## 6. Architecture sketch

- Orchestrator process (Python 3.12, `uv` recommended): runs agents with a shared persisted state store (SQLite or JSON on disk) so runs resume after failure.
- Each agent = a role prompt + tools + budget. All LLM and tool calls are traced via neatlogs (`init`, `wrap`, `@span`), tagged `run:<id>`, `variant:<before|after>`, `sha:<commit>`, `inject:<fault>`.
- CFO agent loop: pull run metrics from neatlogs (CLI/API) every N seconds, apply rules (retry cap, per-task token budget, cost-per-success ceiling), write decisions to state, emit decision spans (`cfo:throttle`, `cfo:reroute`, `cfo:stop`) so decisions are themselves visible in traces.
- Planner reads state and CFO decisions, replans (`planner:replan` span).
- Verification step: tests must pass or the URL must respond before a task is marked done (rubric lists verification).
- Marketer writes drafts to `posts/drafts/*.md`; Aman approves and publishes manually.
- Keep each agent's output checkable on disk (task graph JSON, commits, decision log, drafts).

Suggested repo layout:
```
/ HANDOFF.md            (this file)
/ hackathon.md          (build log, maintained per the neathack skill)
/ README.md
/ .claude/skills/neathack/SKILL.md
/ agents/               (planner, engineer, cfo, marketer)
/ orchestrator/
/ product/              (the thing the Engineer builds)
/ evidence/             (traces.md, entire/, before-after.md, recovery.md)
/ business/             (cfo.ai plan export, inputs.md, unit_costs.md)
/ posts/                (build-in-public drafts + links to published posts)
/ scripts/              (inject faults, pull metrics, compare runs)
/ .env.example
```

---

## 7. Build plan (target about one day of focused work, plus buffer)

1. Setup and spikes S1-S8 (above). Record results.
2. Orchestrator + state + Planner + Engineer on a trivial task, fully traced. First Entire checkpointed commits.
3. CFO agent reading neatlogs data with simple rules; add decision spans.
4. Fault injection + `variant:before` run (no CFO enforcement). Save trace links and numbers.
5. Enable CFO enforcement, run `variant:after`. Save trace links and numbers. Write `evidence/before-after.md`.
6. Marketer drafts; Aman posts #neatHack updates throughout (start at hour one).
7. cfo.ai business plan from measured costs; export into `business/`.
8. Record the 3-minute demo; finalize evidence and README; submit Oct 12, 7:00-11:55 PM IST (aim well before 11:55).

Do not leave the demo and evidence to the last hour. Video (20%) plus building in public (15%) are 35% of the score.

---

## 8. Rubric to artifact map (fill in as we go)

| Claim | Artifact |
|---|---|
| Agent completes a substantial task | Deployed URL / passing tests + task graph + commit history |
| Agent improved | `evidence/before-after.md` with two tagged neatlogs trace links and the compared numbers |
| Recovers from failure | `evidence/recovery.md`: injected failure trace, CFO decision span, recovery trace |
| Used neatlogs | Trace links/screenshots, Investigate or Detections screenshot, API/CLI usage by the CFO agent |
| Used Entire | `evidence/entire/` checkpoint list/IDs/links and entire-graph output |
| Used cfo.ai | `business/` plan export with pricing, costs, revenue, runway built from measured costs |
| Built in public | `posts/published.md` with links to #neatHack posts |
| Code written during hackathon | Public repo, commits dated Oct 10-12 |

---

## 9. Demo outline (3 minutes max)

1. 0:00-0:20 Hook and one-line pitch. Who the agents are.
2. 0:20-1:00 Architecture: orchestrator, four agents, neatlogs as the management layer, Entire checkpoints, cfo.ai plan.
3. 1:00-2:10 Live loop: failure injected, CFO catches it in the traces, throttles, system recovers. Show before vs after neatlogs numbers.
4. 2:10-2:40 Entire checkpoint on the Engineer's commit and entire-graph usage; cfo.ai business plan built from the measured costs.
5. 2:40-3:00 Result, limits stated honestly (human approves posts/deploys), call to action.

The video must explicitly cover neatlogs, Entire and cfo.ai (architecture, implementation, runtime, reasoning, result).

---

## 10. Working agreements for Claude Code

- Read this file and `hackathon.md` at the start of every session. Re-check https://neatlogs.com/hackathon for rule changes; record anything unannounced as pending.
- No product code before 12:30 PM IST Oct 10. Doc/plan commits are fine.
- Commit small and often so each change gets an Entire checkpoint.
- Never commit secrets or `.env`. Mask secrets before sending anything to neatlogs. Check that no secrets appear in committed evidence or Entire transcripts.
- Never publish, deploy, post, register or submit anything without Aman's explicit instruction.
- Never fabricate results. Mark each item in `hackathon.md` as planned, in progress, done, or failed, and log tests that actually ran.
- If a spike fails, take the fallback in section 5 and log it; do not silently change the design.
- Keep scope small: 4 agents max, one goal, one loop. Depth beats breadth in this rubric.
- Ask Aman before spending money or using paid services beyond the provided credits.

---

## 11. Decisions Aman needs to make before build

1. The concrete goal/deliverable the Engineer ships (section 3.2).
2. Solo or team (1-4); if team, who owns demo, posts, and evidence.
3. Model provider(s) and keys; spending ceiling.
4. Project name and public repo name/owner.
5. Whether to attempt the cfo.ai MCP stretch goal, or use cfo.ai for the plan only.
6. Which posts and handles to publish for building in public (the Marketer only drafts).

## 12. Known risks

- Time and scope: a multi-role company is easy to over-build. Hold the line at one loop.
- Evidence gap: strong competitors already show before/after traces and recovery evidence; ours must too.
- neatlogs read-back latency or missing fields could weaken the CFO loop (see S2/S3).
- cfo.ai as a live decision-maker is unconfirmed (S6); the plan export is the must-have.
- Credibility: any "fully autonomous" claim that the evidence does not support will cost points.
- Community award: no bought engagement, no bot posting.
