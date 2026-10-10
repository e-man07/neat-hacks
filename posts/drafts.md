# #neatHack build-in-public drafts

Drafts only — Aman reviews, edits and posts. Replace bracketed bits with real links.

## 1 — the idea
Building Night Shift for #neatHack: the on-call engineer for AI agents.

At 3 AM a "harmless" prompt change starts paying refunds it shouldn't. Every request still returns 200.
Night Shift catches it, finds the change *and the coding-agent prompt behind it*, prices the damage,
rolls back within a pre-approved policy, proves the fix, and only then pages you.

Stack: @neatlogs traces · Entire checkpoints · cfo.ai economics. [repo link]

## 2 — the bad releases are real
Every bad release in our benchmark was written by a real Claude Code session with a realistic dev
request — "make refunds one step, payments already validates them". Entire checkpointed each one.

Best part: the coding agent *warned* about the risk every time. Night Shift surfaces that warning in
the postmortem. Nobody reads it at 5 PM; Night Shift reads it at 3 AM. #neatHack [screenshot]

## 3 — first live benchmark
Ran 6 staged incidents on live models (Haiku agent, Sonnet investigator), all traced in neatlogs.
Run 1: the investigator found an API-drift bug instantly (KeyError in the v2 adapter, exact commit +
prompt) — then rated itself 0.5 confident, so policy refused to act alone. Fixed calibration.
Run 2: [results]. Investigations cost ~$0.09 each. #neatHack [link to evidence/benchmark]

## 4 — it chose not to wake me
A release made the agent retry a flaky carrier API. Night Shift diagnosed it, priced it at $8 until
morning, and deferred it with the fix attached instead of paging me. Judgment > alerts. #neatHack

## 5 — demo
Night Shift demo (3 min): [video link]. Deploy a bad release → detected → traced to the prompt →
priced → rolled back → verified → one page on my phone. Repo + evidence: [link] #neatHack
