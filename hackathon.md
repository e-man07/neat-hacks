# neatHack build log — Night Shift

## Project
**Night Shift** — the on-call engineer for AI agents. It detects incidents in a production LLM agent,
traces them to the change and the coding-agent prompt that caused them, prices the damage, takes
reversible containment actions from a pre-approved policy, verifies the fix by replaying failed
conversations, and pages a human only for irreversible decisions.

Problem: agent failures (prompt regressions, tool API drift, retry loops, provider outages, prompt
injection) return HTTP 200 and go unnoticed until money is lost; nobody is awake at 3 AM.

## Team
Aman (handle to be confirmed by Aman).

## Stack
- Python 3.13, FastAPI, SQLite; Next.js + Tailwind (web)
- LLMs via the neatHack LiteLLM gateway (Claude Haiku for the production agent, Claude Sonnet for investigation, Nova Lite as backup)
- neatlogs (SDK tracing + MCP read-back and detections)
- Entire (checkpoints on every commit; provenance lookups at runtime)
- cfo.ai (business model and plan; unit economics used to price incidents)

## Build log

### 2026-10-11 ~01:30 IST — planning and spikes (completed)
- Chose the concept after reviewing the rules and ~12 public competitor repos (notes in chat; summary in `docs/ARCHITECTURE.md`).
- Spikes recorded in `docs/SPIKES.md`: neatlogs ingest PASS, read-back via MCP PASS (REST needs a service-account token), Entire checkpoints PASS with redaction verified, cfo.ai MCP supports device login (pending human approval), LiteLLM budget $20 / 60 rpm.
- Pending (human): GitHub write access for pushing branches/PRs; cfo.ai login approval.

### 2026-10-11 ~01:45–03:00 IST — production agent + Night Shift core (completed)
- Harbor support agent (Claude Haiku through the LiteLLM gateway, OpenAI-style tool calling), sandbox orders API v1/v2, refund policy, ledger, grader priced with `business/unit_economics.yaml`.
- Live smoke test: 10/10 conversations correct on the baseline release, ~$0.005/conversation, traces visible in neatlogs.
- Night Shift: detector, neatlogs MCP client, provenance (git → Entire checkpoint → prompt), Sonnet investigator with tools, impact pricing, autonomy policy, reversible actions with undo, replay verification, ntfy paging, postmortems, regression evals. 16 unit tests pass (sim brain).

### 2026-10-11 ~03:00–04:30 IST — incidents and live benchmark (completed)
- Bad releases r42–r46 written by separate `claude -p` sessions with realistic developer requests; each commit carries its own Entire checkpoint. The coding agent warned about the risk in every session; Night Shift surfaces that note.
- First attempt at r42 reused this session's id (env inheritance) — Entire recorded the wrong transcript. Fixed by clearing the session env for child sessions; deleted the bad checkpoint and re-ran.
- Live finding: Haiku kept checking policy under r42 ("shorter replies"), so it caused a ticket flood instead of wrong refunds. Kept it as I6 (new escalation signal) and added r46 (developer removes the policy tool on a false assumption) as the money-loss incident.
- Benchmark run 1 (live): I1, I4, I5, I6 resolved autonomously. I2: investigator found the exact bug but self-reported confidence 0.5 → policy refused to act. I3: live Haiku gave up on the flaky API instead of looping, so impact was $8 → it paged a human at 3 AM, which is wrong.
- Fixes from run 1: confidence calibration + reject diagnoses without confidence; low-impact incidents deferred to the morning; impact priced from post-change conversations; neatlogs `get_trace_context` selective fields are disabled server-side → use full context.
- Evidence: `evidence/benchmark/run1-live/`, and the comparison in `evidence/before-after.md`.

### 2026-10-11 ~03:30–05:00 IST — API, console, business (completed)
- FastAPI runtime with SSE; Next.js console (live traffic, money counter, incident timeline with provenance, phone pages, demo controls), landing, incidents, benchmark, business pages. UI style inspired by maritime.sh (not copied).
- entire-graph plugin installed; semantic change lists added to provenance.
- cfo.ai MCP: device-code login verified (registration + device authorization work); token exchange needs Aman to approve → `backend/scripts/cfo_login.py`.
- Business plan draft computed from measured costs (`business/model.py` → `business/PLAN.md`), to be rebuilt in cfo.ai.

### 2026-10-11 ~05:00–06:00 IST — benchmark run 3 and evidence (completed)
- Run 3 (live, after the run-1 fixes): 6/6 incidents handled correctly — I1, I2, I4, I5, I6 contained autonomously 14–21 s after detection with 4–5/5 replays passing and live recovery confirmed; I3 (low impact) deferred to the morning. Investigations cost $0.05–0.15 each. `evidence/benchmark/run3-live/`, comparison in `evidence/before-after.md` (4/6 → 6/6 under the same scoring).
- Run 2 was stopped part-way (it was still running the old code for later incidents) and discarded.
- entire-graph semantic change lists added to provenance; `evidence/entire.md` and `evidence/neatlogs.md` generated from live data (Entire CLI, neatlogs MCP).
- Secret hygiene: a scan found an 11-character fragment of the gateway key inside local Entire checkpoint transcripts (it came from my own leak-scan commands; full keys were already redacted). Widened the local redaction rules and rewrote the affected local checkpoint refs; re-scan shows 0 hits. Nothing had been pushed.
- Gateway spend so far: $3.28 of $20.

## Demo
Script in `docs/DEMO_SCRIPT.md`. Run locally with `scripts/dev.sh`.

## Known limitations and next steps
- Incidents are staged on purpose (bad releases and injected faults) to make the benchmark reproducible.
- Production traffic is simulated customers; tools act on a sandbox ledger.

## Submission
- Confirmed: public repo, commits dated in the window, 3-minute demo, neatlogs + Entire + cfo.ai evidence, cfo.ai plan included, #neatHack posts, quote-post submission on X (Oct 12, 7:00–11:55 PM IST planned; final cutoff announced on Discord).
- Outstanding: everything in `docs/PLAN.md` "Human-only steps".
