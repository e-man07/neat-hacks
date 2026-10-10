# Night Shift — Architecture

> The on-call engineer for your AI agents.
> It stops the bleeding by itself. It only waits for you on decisions that can't be undone.

## 1. Problem

Companies now put LLM agents in front of customers. Those agents fail in ways classic monitoring
does not see: a prompt edit that skips a policy check, a tool whose upstream API changed shape, a
retry loop that burns tokens, a model provider outage, a wave of prompt-injection attempts. Every
request still returns HTTP 200. Someone notices hours later, usually from the refund ledger.

Night Shift watches a production agent, detects the incident from business signals and traces,
finds the change (and the coding-agent prompt) that caused it, prices the damage, takes the
reversible containment action that its pre-approved policy allows, proves the fix by replaying the
failed conversations, and pages a human only for decisions that can't be undone.

## 2. System overview

```
                 ┌──────────────────────────── production ─────────────────────────────┐
 customers  ───► │ traffic sim ──► HARBOR support agent ──► tools (orders, refunds,    │
 (simulated)     │                 (LLM via LiteLLM)          escalate) ──► ledger DB  │
                 │                      │  every call traced                           │
                 └──────────────────────┼───────────────────────────────────────────────┘
                                        ▼
                 neatlogs (traces, detections) ◄──── MCP: search_traces, get_trace_context,
                                        │                 create_detection
 business signals (ledger invariants,   │
 outcomes, cost)  ──────────────────────┤
                                        ▼
            ┌──────────────────────── NIGHT SHIFT ────────────────────────────┐
            │ 1 WATCH      window metrics vs baseline → open incident          │
            │ 2 INVESTIGATE LLM agent + tools: neatlogs traces, deploy log,    │
            │              git diff, Entire checkpoint (the prompt behind it)  │
            │ 3 PRICE      $/min loss × minutes-to-human (unit economics from  │
            │              the cfo.ai model)                                   │
            │ 4 DECIDE     policy/oncall-policy.yaml: reversible + allowed?    │
            │ 5 ACT        rollback · model failover · disable tool flag       │
            │ 6 VERIFY     replay failing conversations on the new config;     │
            │              watch live metrics; auto-undo if worse              │
            │ 7 REPORT     push page · postmortem · regression tests · fix PR  │
            └──────────────────────────────────────────────────────────────────┘
                                        │ SSE
                                        ▼
                         Next.js console (live ops, incidents, benchmark)
```

## 3. Components

### 3.1 Harbor — the production agent (`backend/harbor/`)
A customer-support agent for a fictional store, Harbor Goods. It answers order questions and
handles refunds through tools. Real side effects happen in a sandbox SQLite ledger.

| Tool | Effect |
|---|---|
| `lookup_order(order_id)` | Reads the orders API (adapter v1 or v2, chosen by the release). |
| `check_refund_policy(order_id)` | Returns eligibility + max refundable amount (30-day window, no final-sale items, auto-refund cap $200). |
| `issue_refund(order_id, amount, reason)` | Writes a refund to the ledger. Irreversible money movement. |
| `escalate_to_human(reason)` | Opens a human ticket (costs ~$4). |

**Releases** (`backend/harbor/releases/*.yaml`) define the deployable behaviour: system prompt,
primary model, fallback model, max agent steps, retry policy, orders-adapter version, feature flags
(`auto_refund_enabled`, `injection_guard`). Releases are committed to git; each release file is
created by a coding-agent session, so Entire records the prompt and reasoning behind it.

**Control plane** (`ops.db: control`): which release is active, which model is forced, which flags
are overridden. Harbor reads it on every conversation, so changes are live and one-step reversible.

**Brains.** `live` uses the LiteLLM gateway (Claude Haiku as primary, Nova Lite as fallback) with
OpenAI-style tool calling. `sim` is a deterministic stand-in that reproduces each release's
behaviour without model calls; it exists so the UI runs offline and is always labelled `SIM`.
Evidence in `evidence/` comes from `live` runs only.

### 3.2 Traffic + grader (`backend/harbor/traffic.py`, `grader.py`)
A scenario bank of customer conversations with ground truth (order, intent, correct outcome).
The grader scores every conversation: `correct`, `wrong_refund` (loss = amount wrongly paid),
`missed_refund` (churn cost), `failed` (error/timeout, churn cost), `escalated` (ticket cost).
Attack traffic (prompt injection) can be mixed in on demand.

### 3.3 Telemetry
- **neatlogs SDK** traces every conversation (`workflow=harbor-support`, tags `release:<id>`,
  `model:<id>`), every LLM call (auto-instrumented OpenAI client) and every tool call
  (`@neatlogs.span(kind="TOOL")`). Night Shift's own investigation is traced too
  (`workflow=nightshift`).
- **Ops store** (`ops.db`): one row per conversation (release, model, tokens, cost, outcome, loss,
  trace id) — the company's own business metrics, i.e. what a real team has in its warehouse.
- **Read-back** goes through the **neatlogs MCP server** (`https://ingest.neatlogs.com/mcp`, project
  key as bearer): `search_traces`, `get_trace_context`, `list_detections`, `create_detection`.
  Spike S2 showed the Public REST API needs a service-account token; the MCP accepts the project key.

### 3.4 Night Shift (`backend/nightshift/`)
| Module | Responsibility |
|---|---|
| `detector.py` | Sliding window over the ops store; compares error rate, wrong-action rate, cost/conversation, tool-error rate, escalation rate with the baseline; opens an incident with the triggering signals. |
| `neatlogs_mcp.py` | Minimal Streamable-HTTP MCP client for the neatlogs server. |
| `provenance.py` | Deploy log → release file → commit (`git log`) → `Entire-Checkpoint` trailer → `entire checkpoint explain` → the coding-agent prompt. Also `git diff` between releases. |
| `investigator.py` | Tool-using LLM agent (Claude Sonnet via LiteLLM). Tools: metrics window, recent deploys, release diff, neatlogs trace search/context, Entire checkpoint explain, provider health. Returns a structured diagnosis (type, culprit, evidence trace ids, confidence). Deterministic fallback when no LLM is available. |
| `impact.py` | Loss rate in $/min from graded outcomes + token waste; projected loss = rate × minutes until a human would respond (from the on-call schedule); uses `business/unit_economics.yaml`, the numbers mirrored from the cfo.ai model. |
| `policy.py` | Loads `policy/oncall-policy.yaml`; decides `auto` vs `needs_approval` per action using reversibility, confidence, projected loss and blast radius. |
| `actions.py` | Actuators on the control plane: `rollback_release`, `failover_model`, `disable_flag`, `cap_steps`, plus `undo(action)`. |
| `verifier.py` | Replays the failing conversations (customer messages from the traces) against the post-action config with side effects disabled; grades them; then watches live metrics for a recovery window; undoes the action if things got worse. |
| `notifier.py` | Push page via ntfy.sh (no account needed) and optional Telegram; console fallback. |
| `reporter.py` | Postmortem markdown, regression tests (`harbor/evals/regressions/INC-*.yaml`), permanent-fix proposal (revert patch) that waits for approval. |
| `runner.py` | The on-call loop and incident state machine: `OPEN → INVESTIGATING → MITIGATING → VERIFYING → RESOLVED / ESCALATED`. Every step is persisted (`ops.db: incidents, incident_events`) so a crash resumes mid-incident. |

### 3.5 Autonomy policy (`policy/oncall-policy.yaml`)
Approved by a human ahead of time, version-controlled and Entire-checkpointed.
- **Auto (reversible, containment):** roll back to last known-good release, fail over to backup
  model, disable a tool flag (e.g. auto-refunds → human queue), cap agent steps.
- **Needs approval (irreversible / forward):** deploy a new code fix, refund or contact customers,
  delete data, anything not listed.
- **Gates:** diagnosis confidence ≥ 0.6; projected loss ≥ $25 or safety incident; action must have
  an `undo`; at most one auto action per 10 minutes per incident; auto-undo if the verify step fails.

### 3.6 API (`backend/api/`)
FastAPI process that runs Harbor, the traffic simulator and Night Shift as asyncio tasks and exposes:
`GET /api/state`, `/api/conversations`, `/api/incidents`, `/api/incidents/{id}`, `/api/benchmark`,
`/api/economics`; `POST /api/demo/deploy`, `/api/demo/fault`, `/api/demo/reset`,
`/api/proposals/{id}/approve`; `GET /api/stream` (Server-Sent Events).

### 3.7 Web (`web/`)
Next.js (App Router, Tailwind). Pages: `/` landing, `/console` live ops (traffic, dollar-loss
counter, incident timeline with evidence chips linking to neatlogs traces and Entire checkpoints,
phone-page mock, demo controls), `/incidents/[id]` postmortem, `/benchmark`, `/business`.

## 4. How each partner tool is used

| Tool | Role | Concrete calls |
|---|---|---|
| **neatlogs** | Evidence and alarm | SDK traces for Harbor and Night Shift; MCP `search_traces` / `get_trace_context` to pull failing conversations during investigation; `create_detection` to leave a permanent detection for the incident signature (e.g. injection pattern); before/after numbers from traces. |
| **Entire** | The "why" of every change | Every release is committed by a coding-agent session and gets an `Entire-Checkpoint` trailer. Night Shift resolves culprit commit → checkpoint → the prompt and reasoning behind it. The repo's own development is checkpointed too. |
| **cfo.ai** | The price of an incident | The business model (AOV, refund rate, churn LTV, human ticket cost, LLM cost per conversation, pricing for Night Shift itself) lives in cfo.ai and is mirrored into `business/unit_economics.yaml`, which Night Shift uses to price incidents and decide whether waiting for a human is affordable. The plan (pricing, costs, revenue, runway) is exported to `business/`. |

## 5. Incident catalogue (benchmark)

| ID | Incident | Trigger | Expected containment |
|---|---|---|---|
| I1 | Prompt regression | Release "make replies shorter" drops the policy-check instruction → wrong refunds | Roll back release |
| I2 | Tool schema drift | Release "migrate to orders API v2" breaks the adapter → failed conversations | Roll back release |
| I3 | Cost runaway | Release "make the agent more persistent" retries forever → token burn | Roll back release (or cap steps) |
| I4 | Provider outage | Primary model returns errors (fault injection, no deploy) | Fail over to backup model |
| I5 | Prompt-injection wave | Attack traffic asks for unauthorised refunds | Disable auto-refunds (human queue) + neatlogs detection |

Metrics per run: time to detect, diagnosis correct, culprit correct, action taken, time to
mitigate, replay pass rate, loss during incident, projected loss avoided, LLM cost of Night Shift.

## 6. Data model (SQLite `ops.db`)
- `conversations(id, ts, release, model, brain, scenario_id, outcome, loss_usd, cost_usd, tokens, steps, error, trace_id, transcript_json)`
- `ledger(id, ts, order_id, amount, conversation_id, release)`
- `control(key, value, updated_at, updated_by)`
- `deploys(id, ts, release, commit, actor)`
- `incidents(id, opened_at, status, type, severity, summary, diagnosis_json, impact_json, resolved_at)`
- `incident_events(id, incident_id, ts, kind, title, detail_json)`
- `actions(id, incident_id, ts, kind, params_json, mode, status, undo_json)`

## 7. Honesty rules
- `SIM` data is never presented as evidence; evidence comes from `live` runs with trace ids.
- Incidents are staged on purpose (we ship bad releases / inject faults) and the README says so.
- "Autonomous within a pre-approved policy; a human approves anything irreversible."
- Secrets live only in `.env` (gitignored); Entire redaction rules cover our key formats.
