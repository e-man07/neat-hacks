# Phase PRs (stacked)

Each phase branch is stacked on the previous one. Merge in order.

| PR | Head → base | Title | Description |
|---|---|---|---|
| 1 | `nightshift/p0-specs` → `main` | Phase 0: architecture, plan and spikes | Architecture spec, build plan, spike results, build log, neathack skill. |
| 2 | `nightshift/p1-harbor` → `nightshift/p0-specs` | Phase 1: Harbor production agent | Support agent on Claude Haiku with tools, releases, grader, traffic; traced in neatlogs. |
| 3 | `nightshift/p2-oncall` → `nightshift/p1-harbor` | Phase 2: Nightly on-call agent | Detection, Sonnet investigator, Entire provenance, pricing, policy, reversible actions, replay verification. |
| 4 | `nightshift/p3-incidents` → `nightshift/p2-oncall` | Phase 3: incidents and live benchmark | Bad releases written by separate Claude Code sessions; benchmark runs 1 and 3 (4/6 → 6/6). |
| 5 | `nightshift/p4-api` → `nightshift/p3-incidents` | Phase 4: API runtime | FastAPI runtime, SSE stream, demo controls. |
| 6 | `nightshift/p5-web` → `nightshift/p4-api` | Phase 5: console UI | Next.js landing, live console, incidents, benchmark and business pages. |
| 7 | `nightshift/p6-launch` → `nightshift/p5-web` | Phase 6: launch kit | Judge README, business plan, cfo.ai login, demo script, post drafts. |

`claude/beautiful-carson-sc2jqe` points at the tip of phase 6.
