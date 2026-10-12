# Spike results (Oct 11, 2026, ~01:30 IST)

| # | Question | Result | Notes |
|---|---|---|---|
| S1 | Trace a toy agent in neatlogs | **PASS** | `neatlogs` 1.4.26, `init()` + `wrap(OpenAI(base_url=LiteLLM))` + `@span(kind="TOOL")`; 0 export failures. |
| S2 | Read traces back programmatically | **PASS via MCP** | Public REST API (`/api/v1/public/traces`) rejects the project key (needs a service-account token). The MCP server at `https://ingest.neatlogs.com/mcp` accepts the project key as bearer: `whoami`, `search_traces`, `get_trace_context`, detections and fixes tools all work. Spike trace found by search seconds after flush. |
| S2b | Cost field | **Partial** | Trace `cost_usd` is 0 for the gateway alias `claude-haiku` (no pricing match). Nightly computes cost from token counts × gateway price table and keeps neatlogs token counts as the cross-check. |
| S3 | Filter variants | **PASS (workaround)** | `search_traces` filters by `workflow_name`, model, cost, tokens, date; tags are set at `init()`. Variants use workflow name + release tag in span attributes. |
| S4 | Entire checkpoints for Claude Code | **PASS** | Built Entire CLI 0.11.5 from source (release downloads blocked by the sandbox proxy). `entire enable --agent claude-code`; hooks installed mid-session, so `entire session attach <id>` links the session to a commit (`Entire-Checkpoint:` trailer). Fresh `claude -p` sessions get hooks from the start. |
| S5 | Shareable Entire evidence without secrets | **PASS** | Custom redaction rules (`.entire/settings.json` + gitignored local rules for our exact keys). Verified 0 occurrences of either key in the checkpoint blobs; 33 `REDACTED` markers. PII email redaction enabled for future checkpoints. |
| S6 | cfo.ai MCP | **Ready, needs human approval** | MCP at `https://api.cfo.ai/mcp`, OAuth via AuthKit. Device-code grant is supported, so login can be approved from a phone. Tools include `inspect/edit_table_blocks`, `inspect/edit_scenarios`, `inspect/edit_pages`. |
| S7 | Reproducible planted failures | Pending (P3) | |
| S8 | Model limits/cost | **PASS** | LiteLLM key: $20 budget / 30 days, 60 rpm. Models: `claude-haiku`, `claude-sonnet-4.6`, `claude-opus-4.6`, `nova-micro/lite/pro`, `nova-2-lite`. |
