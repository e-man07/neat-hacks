# Demo script: 3:00 max

The story: a real coding-agent change breaks a live agent at night. Nightly catches it, traces it to
the prompt behind it, prices it, fixes what it's allowed to, proves the fix, and asks a human only for
the irreversible part. The demo shows each tool (neatlogs, Entire, cfo.ai) at work, not just named.

## Setup (10 minutes before recording)

1. Browser tabs: https://nightly.whyparabola.online/app (signed in), the Scout agent page, Slack (the channel
   connected under Paging), the neatlogs app (Scout traces), and the two cfo.ai links from `business/PLAN.md`.
2. Scout on s2 with steady traffic, so there's a healthy baseline (about 3 min, ~25 runs):
   ```bash
   cd agents/scout && export NIGHTLY_API_URL=https://api.34-14-135-119.sslip.io NIGHTLY_AGENT_TOKEN=nsa_...
   uv run --project ../../backend python scout.py deploy s2
   uv run --project ../../backend python scout.py serve --rate 10      # leave running
   ```
3. Record in one take, and speed up the waiting in editing (detection takes ~1.5 min, the fix ~1 min).
   On screen, show "≈ 90 s later" when you cut.

## Script

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Landing page | "AI agents run in production all night. When one quietly breaks, nobody's awake. Nightly is the on-call engineer for your AI agents: it fixes what's safe to fix by itself, and only wakes you for what can't be undone." |
| 0:15–0:35 | App → Scout agent page (green, traffic flowing) | "This is Scout, a docs assistant for a SaaS company, connected with our SDK in five minutes. Every answer is traced in **neatlogs**; Nightly reads those traces. The SDK lets Nightly steer the agent: release, model, kill switches." |
| 0:35–0:50 | Terminal: `scout.py deploy s3` → agent page shows s3 | "Now a release ships. A developer asked their Claude Code agent to prepare for a docs migration. The code is checkpointed by **Entire**." |
| 0:50–1:05 | Traces tab: tool errors appear (cut ≈ 90 s) | "Every request still returns 200, but the answers break: the new release reads docs from a folder that doesn't exist yet." |
| 1:05–1:40 | Incident page: timeline streaming, then the provenance card | "Nightly opens an incident and investigates like an SRE: it reads the failing traces back from neatlogs, sees the deploy, diffs it, and follows the commit to the **Entire checkpoint**. Here's the exact prompt the coding agent was given, and the warning it gave that nobody read: 'eval drops to 15/18, docs/v2 doesn't exist yet'." |
| 1:40–1:55 | Impact cards | "It prices the damage from the agent's unit economics (what one bad answer costs, set when you connect the agent; our reference model is built in **cfo.ai**): about $11 a minute, $3,000+ if it waits until a human wakes up. It's reversible and the policy pre-approves it, so it acts." |
| 1:55–2:15 | Slack message updating; replay 3/3 | "It rolls back to s2, then asks Scout to replay the failed questions on the new config: 3/3 pass. One Slack message tells me it's handled. The permanent fix is a PR waiting for my approval: that's irreversible, so it's my call." |
| 2:15–2:30 | Click **Approve fix** in Slack → GitHub PR | "Approve, and Nightly opens the fix PR with the postmortem and a regression test." |
| 2:30–2:45 | Benchmark page | "We also ran six staged incidents on a refunds agent: wrong refunds, API drift, a provider outage, a prompt-injection wave. After improving Nightly between runs, it went from 4/6 to 6/6 handled correctly, all with neatlogs trace ids." |
| 2:45–3:00 | Business page with cfo.ai links | "Each investigation costs about nine cents. The business plan (pricing, costs, revenue, runway) is built in **cfo.ai**: break-even in month 8. Go to sleep. It's handled." |

## The rubric for each tool: where the demo shows it
| | neatlogs | Entire | cfo.ai |
|---|---|---|---|
| Architecture | landing "how it works" | provenance card | business page |
| Implementation | SDK snippet on /docs | commit → checkpoint → prompt | unit economics in incident pricing |
| Runtime | traces flowing; MCP read-back in the timeline | checkpoint lookup during the investigation | $/min and $ at risk |
| Reasoning | investigator cites trace ids | the coding agent's warning drives the diagnosis | policy gate: "worth acting on" |
| Result | before/after traces | postmortem names prompt + checkpoint | plan: break-even M08 |

## Fallback
If the live run misbehaves, record the sandbox (https://nightly.whyparabola.online/sandbox → "r46
One-step refunds"). It shows the same lifecycle on Harbor.
