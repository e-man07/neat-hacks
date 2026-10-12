# Blind incident: a change nobody planned

Every other incident in this repo was designed by us, so Nightly was tested on failures we knew in
advance. This one wasn't.

## Setup (Oct 12, 2026)

1. **The change.** A fresh Claude Code session (Sonnet 5.5, run with `claude -p` in a separate worktree, no
   knowledge of Nightly) got one realistic request: *"Our finance lead flagged that Scout costs too much per
   answer, and we want a cheaper release live today. Create `agents/scout/releases/s4.yaml`, starting from
   s2, that cuts the cost per answer as much as you reasonably can."* It chose the change itself and
   committed it as `cc9b8b9` with Entire checkpoint `01M4QSS28K20HPAQTQK0RJHE8K`
   ([PR #34](https://github.com/e-man07/nightly/pull/34)).
2. **Unread.** We checked only which files the commit touched (one, `s4.yaml`), merged it and deployed it
   without reading it or the session's summary.
3. **Live.** Scout ran on the GCP VM against the hosted Nightly: live Claude Haiku, real neatlogs, Slack
   paging, about 10 questions a minute from its question bank. It ran 3 minutes on s2 (34 correct, 1
   escalated), then `scout.py deploy s4` at 10:21:31 UTC.

## What the session wrote, and what it warned (read after Nightly finished)

`top_k` 2 → 1, `max_steps` 6 → 4, replies "2-4 sentences" → "1-2 sentences" ([`s4.yaml`](../../../agents/scout/releases/s4.yaml)).
It did not run the eval, and it said so: *"The risk is `top_k: 1`. If the first hit is the wrong
section, Scout may answer wrongly or say it can't find the answer."*

## What Nightly did

| | |
|---|---|
| Detected | 10:26:46, **5 min 15 s after the deploy**: "30% of conversations handed to humans (baseline 5%): ticket flood" |
| Investigated | 27 s: signals, recent deploys, failing conversations, the s2 → s4 diff, Entire provenance for s4 and s2, one neatlogs trace |
| Diagnosis | "s4 top_k=1 + 1-2 sentence constraint causes refund policy retrieval failure → mass escalations" (prompt_regression, confidence 0.95) |
| Priced | $0.02/min, $0 at risk by morning (a handed-off question costs little; the customer still gets a human) |
| Decided | **Defer**: rollback is pre-approved and reversible, but $0 at risk is below the $25 bar for waking anyone. It left a rollback to s2 and a permanent fix for the morning. |
| Paged | One low-priority "🌙 For the morning" Slack message |
| Proposed fix | A regression eval for the refund question, a minimum `top_k` of 2 for the keyword retriever, and the full eval suite required for any cut to `top_k` or `max_steps` |

Full postmortem: [`POSTMORTEM.md`](POSTMORTEM.md).

## Ground truth

| Check | s2 | s4 |
|---|---|---|
| Live traffic during the test | 1 escalated of 35 (3%) | 6 escalated of 66 (9%); **all 6 the same question**, the annual-plan refund |
| Offline eval, 18 questions, live model ([s2](eval-s2.txt), [s4](eval-s4.txt)) | 18/18 | 17/18; the one miss is the annual-plan refund question |
| Cost per answer | $0.00329 | $0.00296 (10% cheaper) |

Which change breaks it? We asked the refund question 5 times on each variant (live model):

| Variant | Answered |
|---|---|
| s2 | 3/5 (already fragile) |
| s2 with only `top_k` 2 → 1 | 0/5 |
| s2 with only "1-2 sentences" and `max_steps` 4 | 0/5 |
| s4 (both) | 0/5 |

## Verdict

- **Right:** the release, the question it broke, and the two changes that break it. Each change is enough
  on its own, and Nightly named both. That matches the eval and the coding agent's own warning. The
  decision also holds up: one question type going to a human is not worth a 3 AM page, so it deferred
  with the fix attached.
- **Overstated:** the magnitude. "30% vs 5%" and "mass escalations" came from a short window. Over the
  whole run it was 9% vs 3%. The mechanism is also looser than stated. It says retrieval failure, but in 5 of
  the 6 escalations the model answered in one step without searching, so mostly the shorter-answer
  pressure made it skip the search.
- **Missed, and fixed here:** the provenance found the commit and checkpoint, but not the prompt or the
  coding agent's warning. The postmortem says "Prompt behind the change: —". Two bugs were behind it:
  1. Nightly's clone of an agent's repo was synced only when the agent was connected, so later releases
     were stale. It now re-syncs, at most once a minute, before reading provenance.
  2. The clone is blob-less, so checkpoint refs arrived without their files, and `entire checkpoint
     explain` failed with "checkpoint not found". Sync now fetches the missing objects. On a fresh
     blob-less clone, s4's prompt and the coding agent's note now resolve.

  Both fixes ship with this evidence. Without the bugs, the postmortem would have quoted the warning above.
