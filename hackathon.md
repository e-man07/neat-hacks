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

## Demo
Pending.

## Known limitations and next steps
- Incidents are staged on purpose (bad releases and injected faults) to make the benchmark reproducible.
- Production traffic is simulated customers; tools act on a sandbox ledger.

## Submission
- Confirmed: public repo, commits dated in the window, 3-minute demo, neatlogs + Entire + cfo.ai evidence, cfo.ai plan included, #neatHack posts, quote-post submission on X (Oct 12, 7:00–11:55 PM IST planned; final cutoff announced on Discord).
- Outstanding: everything in `docs/PLAN.md` "Human-only steps".
