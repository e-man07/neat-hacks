# Night Shift — Build Plan

Event window: Oct 10 12:30 IST → Oct 12 submission (7:00–11:55 PM IST, final cutoff on Discord).
Each phase is one branch and one PR, stacked on the previous phase.

| Phase | Branch | Scope | Done when |
|---|---|---|---|
| P0 | `nightshift/p0-specs` | Architecture, plan, spike results, build log, env template, neathack skill | Docs reviewed |
| P1 | `nightshift/p1-harbor` | Harbor agent, tools, releases, control plane, traffic sim, grader, neatlogs tracing, ops store | A live conversation runs end to end and shows up in neatlogs; tests pass |
| P2 | `nightshift/p2-oncall` | Detector, neatlogs MCP client, provenance (git + Entire), investigator, impact, policy, actions, verifier, notifier, reporter, runner | A staged incident is detected, diagnosed, contained and verified in tests |
| P3 | `nightshift/p3-incidents` | Bad releases authored by separate Claude Code sessions (real Entire checkpoints), fault injection, benchmark harness, live evidence | Benchmark table with trace ids in `evidence/` |
| P4 | `nightshift/p4-api` | FastAPI runtime + SSE + demo controls | Console can drive a full incident |
| P5 | `nightshift/p5-web` | Next.js UI: landing, console, incidents, benchmark, business | UI runs against the API; screenshots |
| P6 | `nightshift/p6-launch` | cfo.ai model inputs + device-login sync script, README for judges, demo script, post drafts, build log | Submission checklist green except human-only steps |

## Human-only steps (Aman)
1. Grant the Claude GitHub App write access to `e-man07/neat-hacks` so branches and PRs can be pushed.
2. cfo.ai: approve the device login (`python scripts/cfo_login.py` prints a code), or connect the
   cfo.ai MCP in your own Claude Code and paste the prompt from `business/ARI_PROMPT.md`.
3. Optional: install the ntfy app and subscribe to the topic in `.env` to get the phone page on camera.
4. Post #neatHack updates (drafts in `posts/`), record the demo, submit on X.

## Risks and fallbacks
| Risk | Fallback |
|---|---|
| neatlogs ingest → MCP read-back latency | Detector uses the ops store; neatlogs is pulled during investigation and for evidence |
| LLM nondeterminism in live Harbor | Several conversations per window; graded outcomes, not single samples |
| $20 LiteLLM budget | Haiku for Harbor, Sonnet only for investigation; budget meter in the console |
| cfo.ai MCP auth needs a human | Unit economics mirrored in `business/unit_economics.yaml`; sync script once approved |
| Entire hooks installed mid-session | `entire session attach` per commit; release sessions run as fresh `claude -p` sessions |
