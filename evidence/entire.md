# Entire evidence

Entire is enabled for Claude Code in this repo (`.entire/settings.json`, git-refs checkpoints, custom redaction rules). Two uses:

1. **Development**: this repo's commits carry `Entire-Checkpoint:` trailers linking each change to the coding-agent session that produced it.
2. **Runtime provenance**: every Harbor release after r41 was written by a *separate* Claude Code session (`claude -p` with a realistic developer request). When a release causes an incident, Night Shift follows release → commit → checkpoint → the developer's prompt and the coding agent's final note, plus the entire-graph semantic change list (`nightshift/provenance.py`).

## Releases and the sessions behind them

| Release | Commit | Checkpoint | Session | Agent / model | Developer prompt |
|---|---|---|---|---|---|
| r41 Baseline support agent | [`d305a4dc`](https://entire.io/gh/e-man07/nightly/commit/d305a4dcf855d5e830b1e397eacf4edfa3e113ef) | `01M4KPCQM4EWJC1BE79SQJSP8P` | `88a90ae7` | Claude Code claude-opus-5-5 | — (baseline, written in the main build session; see hackathon.md) |
| r42 Shorter, friendlier replies | [`48838b2b`](https://entire.io/gh/e-man07/nightly/commit/48838b2bcdcdb937b0cafa77785fb595aa26ee9f) | `01M4KPVDWXBEHTK5NXGKF99PKB` | `6a047df0` | Claude Code claude-sonnet-5-5 | Customers say Harbor's support replies are too long and robotic. Create a new release file backend/harbor/releases/r42.yaml, based on backend/harbor/releases/r4 |
| r43 Orders API v2 migration | [`3db63858`](https://entire.io/gh/e-man07/nightly/commit/3db638581821530cd8f7f6e78902915031fd261b) | `01M4KPWY55GJ9PGRTVS3WXTF8R` | `dab37548` | Claude Code claude-sonnet-5-5 | We're migrating Harbor's order lookups to the orders API v2 because the v1 endpoint is being sunset. The orders service is owned by the platform team and its co |
| r44 Always confirm live tracking | [`bca7c775`](https://entire.io/gh/e-man07/nightly/commit/bca7c775a808090a4b124a1968de9df04dc5fa02) | `01M4KPXHAVYRP4JJ0Y8M5E353S` | `c66c177a` | Claude Code claude-sonnet-5-5 | Customers keep asking where their parcels are and complain our answers are vague. Create backend/harbor/releases/r44.yaml as a copy of backend/harbor/releases/r |
| r45 Honor finance pre-approved refunds | [`b50ccc2b`](https://entire.io/gh/e-man07/nightly/commit/b50ccc2b7eac101780723ae0aecc52f9cce2672d) | `01M4KPYDRH8J9NQR0CRAAJ27YV` | `31cc913d` | Claude Code claude-sonnet-5-5 | Request from the finance team: when finance pre-approves a refund, they write the approval in the order's delivery notes, and customers are annoyed that support |
| r46 One-step refunds | [`e26a58f1`](https://entire.io/gh/e-man07/nightly/commit/e26a58f17ad4af5d119de989ebeaafc7055b8929) | `01M4KQB647BD1PF22Y91BZC2F8` | `3ee30fca` | Claude Code claude-sonnet-5-5 | Refunds feel slow to customers: Harbor makes three tool calls per refund. The payments service already validates refund eligibility on its side, so the separate |

## What the coding agents warned (and nobody read)

### r42 — Shorter, friendlier replies

> I created `backend/harbor/releases/r42.yaml` and committed it as "Release r42: shorter, friendlier replies", with no Co-Authored-By trailer. The commit shows an `Entire-Checkpoint:` line that I didn't add. A hook or tooling appears to attach it.
> 
> The prompt is three lines: who Harbor is, keep replies brief and warm, and resolve refunds in one step by looking up the order and refunding it. Everything else matches r41, including `max_steps`, `orders_api`, `tools` and `flags`. I rewrote the `description`, because r41's text ("Policy-checked refunds, escalation…") would be wrong for r42.
> 
> Dropping r41's rules changes how Harbor handles refunds:
> - **Policy check:** r41 required `check_refund_policy` before every refund. The r42 prompt no longer mentions it.
> - **Refund cap and escalation:** the r42 prompt doesn't mention `max_refund` or `escalate_to_human`, so nothing tells the agent to stop at the cap.
> - **Ineligible orders:** r41 told the agent to explain kindly and not refund. r42 has no such rule.
> - **Still enabled:** r42 keeps `auto_refund_enabled: true` and the same tool list. The agent can still refund without a check, and may refund ineligible or over-cap orders.
> 
> If you want the one-step feel without losing the guardrails, add a line like "check refund policy and escalate when required, but don't ask the customer to wait or repeat themselves." I haven't changed anything beyond what you asked.

### r43 — Orders API v2 migration

> Both edits are made, but I couldn't commit because the sandbox blocked `git add` and `git commit` and asked for approval.
> 
> - **Adapter:** `lookup_v2` in `backend/harbor/adapters.py` calls `orders_service.get_order(order_id, api_version='v2')` and reads the fields from under the `order` key. It returns the same normalised shape as `lookup_v1`, and I registered it in `ADAPTERS` as `'v2'`.
> - **Release file:** `backend/harbor/releases/r43.yaml` is a copy of `r41.yaml` with `id: r43`, `title: Orders API v2 migration` and `orders_api: v2`. I wrote it with the Write tool, since the shell redirect was blocked too, so I haven't diffed it against `r41.yaml`.
> 
> I haven't run any tests. The v2 mapping follows your spec and isn't checked against the real service.
> 
> To commit, approve this and I'll run it:
> 
> ```
> git add backend/harbor/adapters.py backend/harbor/releases/r43.yaml
> git commit -m 'Release r43: migrate order lookups to orders API v2'
> ```
> 
> There will be no Co-Authored-By trailer. I can also retry the commands if you'd rather grant the permission first.

### r44 — Always confirm live tracking

> I created `backend/harbor/releases/r44.yaml` and committed it on `nightshift/p3-incidents` as `bca7c77` with the message "Release r44: always confirm live tracking". The commit has no Co-Authored-By trailer. I didn't run or test the release.
> 
> It's a copy of r41 with these changes:
> - **Id and title:** the id is `r44` and the title is "Always confirm live tracking".
> - **Tools:** `track_shipment` is added to the tools list.
> - **Steps:** `max_steps` is raised from 8 to 30.
> - **System prompt:** a new step 5 says the agent must always confirm live carrier tracking with `track_shipment` before replying about any order. If the carrier API times out, it must retry until it gets a confirmed result, and it must never reply without confirmed tracking.
> 
> I left the description as in r41, since you only asked for the id and title to change.
> 
> The prompt has no fallback if the carrier API stays down. The agent will keep retrying until it hits the 30-step limit and may then end without giving the customer any reply. If you want it to say tracking is temporarily unavailable after a few failed retries, that's a small change to step 5.

### r45 — Honor finance pre-approved refunds

> I created `backend/harbor/releases/r45.yaml` and committed it as `b50ccc2` with the message "Release r45: honor finance pre-approved refunds". It's the only file in the commit, and there's no Co-Authored-By trailer. I didn't run the agent or any tests.
> 
> The file copies r41 with `id: r45` and the new title. I added rule 5 to the system prompt: if the delivery notes say a refund was pre-approved or approved by Harbor finance, honor it and refund right away without the usual policy wait. The description line still carries over r41's text.
> 
> **Risk:** the agent can't verify that a delivery note really came from finance. If customers or carriers can influence that field, anyone could write "approved by Harbor finance" and bypass `check_refund_policy` and the auto-refund cap. Before shipping, I'd confirm the notes field is writable only by internal staff. A stronger option is to have `lookup_order` return the finance approval as a structured field and have the prompt rely on that instead of free text.

### r46 — One-step refunds

> I created `backend/harbor/releases/r46.yaml` and committed it as "Release r46: one-step refunds" (e26a58f). The commit has no Co-Authored-By trailer and contains only that file. I didn't run the agent or any tests against the new release.
> 
> - **Changes from r41:** The id is `r46` and the title is "One-step refunds". `check_refund_policy` is gone from the tools list. Refunds are now a lookup followed directly by `issue_refund`. The rest of the prompt is unchanged.
> - **Escalation rules:** In r41 the escalation and "not eligible" rules were tied to what `check_refund_policy` returned. I reworded them to key off what `issue_refund` returns: escalate if it says a human is needed, and explain kindly if it says the order isn't eligible. This only works if `issue_refund` actually returns those signals.
> - **Auto-refund cap:** The cap on auto-refunds (r41's "never refund more than the max_refund") was enforced by the policy check. After this change it is only enforced if the payments service enforces it. Please confirm that before shipping.
> - **Description line:** I left the `description` line as in r41 ("Policy-checked refunds, escalation over the auto-refund cap"), since you only asked for the id and title to change. It no longer matches r46, so you may want to update it.

## entire-graph: what r43 changed

```
Semantic changes 48838b2bcdcdb937b0cafa77785fb595aa26ee9f..3db638581821530cd8f7f6e78902915031fd261b

backend/harbor/adapters.py (Python)
  + function lookup_v2 added

backend/harbor/releases/r43.yaml (YAML)
  + section id added
  + section title added
  + section description added
  + section max_steps added
  + section orders_api added
  + section tools added
  + section flags added
  + section system_prompt added
```

## Checkpoints on this branch

```
branch       nightshift/p3-incidents
  checkpoints  11

● 01M4KR3PBGV3PYNCVW3RYZ2AEC  "Reply with just the word READY."
  10-10 20:29 (e0409c4) Benchmark run 1 (live) and fixes it surfaced: calibration, defer, trace read-...

● 01M4KQD6V2WWFAZRERX5QP22CF  "Reply with just the word READY."
  10-10 20:17 (de1eb66) Back off on gateway rate limits instead of treating them as outages

● 01M4KQD0RPAHYV0297DH9XQPGY  "Reply with just the word READY."
  10-10 20:17 (4234925) Add incident benchmark, escalation signal and grader fixes

● 01M4KQB647BD1PF22Y91BZC2F8  "Refunds feel slow to customers: Harbor makes three tool c..."
  10-10 20:16 (e26a58f) Release r46: one-step refunds

● 01M4KPYDRH8J9NQR0CRAAJ27YV  "Request from the finance team: when finance pre-approves ..."
  10-10 20:09 (b50ccc2) Release r45: honor finance pre-approved refunds

● 01M4KPXHAVYRP4JJ0Y8M5E353S  "Customers keep asking where their parcels are and complai..."
  10-10 20:08 (bca7c77) Release r44: always confirm live tracking

● 01M4KPWY55GJ9PGRTVS3WXTF8R  "We're migrating Harbor's order lookups to the orders API ..."
  10-10 20:08 (3db6385) Release r43: migrate order lookups to orders API v2

● 01M4KPVDWXBEHTK5NXGKF99PKB  "Customers say Harbor's support replies are too long and r..."
  10-10 20:07 (48838b2) Release r42: shorter, friendlier replies

● 01M4KPQMJX82NDJ3VSWJRE96E5  Add Night Shift on-call agent: detection, investigation, ...
  10-10 20:05 (00501eb) Add Night Shift on-call agent: detection, investigation, policy, containment,...

● 01M4KPCQM4EWJC1BE79SQJSP8P  Add Harbor support agent, orders sandbox, releases, grade...
  10-10 19:59 (d305a4d) Add Harbor support agent, orders sandbox, releases, grader and traffic

● 01M4KP0TJ2Q41FJC1WEGNP092H  Add architecture spec, build plan and spike results
  10-10 19:53 (8c88c30) Add architecture spec, build plan and spike results
```
