# #neatHack build-in-public drafts

Drafts only: Aman reviews, edits and posts. Each fits in one post (≤280 chars) except where marked
as a thread. Attach the suggested screenshot. Post 1–5 today, spaced a few hours apart, then 6 with
the demo, and the submission quote post in the window.

Links: repo https://github.com/e-man07/neat-hacks · live https://web-emrq.vercel.app

## 1 — the idea  (screenshot: landing page)
Building Nightly for #neatHack: the on-call engineer for your AI agents.

When an agent quietly breaks at 3 AM, it finds the change and the coding-agent prompt behind it,
prices the damage, rolls back within your policy, proves the fix, and only then wakes you.

@neatlogs · Entire · @cfo_ai

## 2 — the bad releases are real  (screenshot: incident provenance card)
Every bad release in our benchmark was written by a real Claude Code session from a realistic dev
request, and checkpointed by Entire.

The coding agent warned about the risk every time. Nobody reads that at 5 PM. Nightly reads it at
3 AM and quotes it in the postmortem. #neatHack

## 3 — it got better between runs  (screenshot: evidence/before-after.md table)
6 staged incidents on live models, every run traced in @neatlogs.

Run 1: 4/6. It found an API-drift bug in seconds, then rated itself 50% confident and refused to act.
We fixed calibration, pricing and paging.
Run 3: 6/6. ~9¢ per investigation. #neatHack

## 4 — it chose not to wake me  (screenshot: a DEFERRED incident)
A release made the agent retry a flaky API. Nightly diagnosed it, priced it with our @cfo_ai unit
economics at $1 until morning, and deferred it with the fix attached instead of paging me.

An on-call engineer needs judgment, not just alerts. #neatHack

## 5 — from demo to product  (screenshot: /app overview + Slack message)
Nightly is now a real product: GitHub sign-in, a 5-minute connect wizard, a zero-dependency
SDK, per-agent policies, and a Slack app with Approve / Undo buttons.

Our second agent, Scout, connects only through the SDK and @neatlogs traces. #neatHack
https://web-emrq.vercel.app

## 6 — thread: a live incident, end to end  (screenshots per post)
1/ A Claude Code session shipped a "get ready for the docs migration" change to Scout, our docs agent.
It even warned: "eval drops to 15/18, docs/v2 doesn't exist yet." It shipped anyway. #neatHack

2/ 1.5 min later Nightly saw tool errors in 30% of runs in @neatlogs, traced them to the commit,
the Entire checkpoint and that warning, and priced it at $11/min.

3/ The rollback is reversible and pre-approved, so it rolled back alone, then had Scout replay the
failed questions: 3/3 pass. Resolved in under 3 min. The permanent fix waits for my approval.

## 7 — what broke while building it  (honest-builder post)
Building Nightly for #neatHack I found that @neatlogs search returned ~25 traces for ~120 runs,
with 0 SDK export errors. So the SDK's outcome reports now carry run details, and traces add to them
when they land. An on-call tool can't go blind when a trace is missing.

(Post this only if you're comfortable with it, and maybe share it with the neatlogs team on Discord
first.)

## 8 — demo  (with the video)
Nightly demo, 3 min: a coding-agent change breaks a live agent → detected in @neatlogs → traced
through Entire to the prompt behind it → priced with @cfo_ai → rolled back → verified → one Slack
message. [video link]

Repo + evidence: https://github.com/e-man07/neat-hacks #neatHack

## Submission quote post  (Oct 12, in the window; quote the official neatlogs submission post)
Team: [team name]
Project: Nightly, the on-call engineer for your AI agents
Repo: https://github.com/e-man07/neat-hacks
Demo: [video link] · Live: https://web-emrq.vercel.app
#neatHack
