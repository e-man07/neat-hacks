# nightly-sdk

The Python SDK for **[Nightly](https://web-emrq.vercel.app)**, the on-call engineer for your AI agents.

AI agents rarely fail loudly. A prompt change, a model swap or a tool update ships, and the agent starts
answering wrong, looping, refunding money it shouldn't, or failing its tools, while every request still
returns HTTP 200. Nightly watches your agent's traces and outcomes, investigates when something breaks
(traces, deploy log, diff, the coding-agent prompt behind the change), prices the damage, and applies
the reversible fix your policy allows: roll back the release, fail over the model, switch off a
capability, or cap the steps. It proves the fix by replaying the failed runs through your agent, then
pages you once in Slack. Anything irreversible waits for your approval.

This SDK is how your agent takes part. With it, your agent can:

- **Read its control plane** (release, model, feature flags, step cap) so Nightly can steer it during
  an incident without a redeploy.
- **Report deploys and outcomes** so Nightly knows what changed and what a bad run costs.
- **Run verification replays** so a fix is proven on real failed inputs before Nightly calls it done.

It has **no dependencies** and **fails open**. If Nightly is unreachable, every call returns the default
you passed, so the SDK can never take your agent down.

## Install

```bash
pip install nightly-sdk
```

Python 3.9+. Pair it with [neatlogs](https://neatlogs.com) tracing (`pip install neatlogs`), which is
where Nightly reads your agent's traces from.

## Get a token

Sign in to Nightly with GitHub and open **Connect an agent**. Creating the agent shows its token
(`nsa_...`) once. You can rotate it from the agent's page at any time.

```bash
export NIGHTLY_API_URL=https://<your Nightly API>
export NIGHTLY_AGENT_TOKEN=nsa_...
```

## Quickstart

```python
import neatlogs
from nightly_sdk import Nightly

neatlogs.init(api_key=NEATLOGS_KEY, workflow_name="support-agent")
ns = Nightly()  # reads NIGHTLY_API_URL and NIGHTLY_AGENT_TOKEN


def handle(ticket: str, dry_run: bool = False) -> dict:
    prompt = load_prompt(ns.release("v12"))        # the release Nightly says is live
    model = ns.model("claude-haiku")                # a failover model during a provider outage
    max_steps = ns.max_steps(8)                     # Nightly can lower it to stop a loop
    tools = TOOLS if ns.flag("auto_refunds", True) else TOOLS_WITHOUT_REFUNDS  # kill switch

    result = run_agent(ticket, prompt, model, tools, max_steps, dry_run=dry_run)

    if not dry_run:
        ns.record("ok" if result.ok else "failed", value_usd=result.money_lost)
    return {"ok": result.ok, "output": result.text}


# Let Nightly verify a fix by replaying failed inputs through the agent, with no side effects.
ns.serve_replays(lambda text: handle(text, dry_run=True))
```

In CI, when you ship:

```python
Nightly().report_deploy("v13", commit=GIT_SHA)
```

## API

| Call | What it does |
|---|---|
| `Nightly(api_url=None, token=None, refresh_s=5.0, timeout_s=4.0)` | Client. Reads `NIGHTLY_API_URL` and `NIGHTLY_AGENT_TOKEN` when arguments are omitted. Config is cached for `refresh_s` seconds. |
| `ns.release(default)` | The release to run. Nightly changes it to roll back. |
| `ns.model(default)` | The model to use. Nightly changes it to fail over. |
| `ns.flag(name, default=True)` | A kill switch for a capability. Nightly turns it off to contain damage. |
| `ns.max_steps(default)` | Your step limit, lowered if Nightly caps it to stop a runaway loop. |
| `ns.config(force=False)` | The raw control-plane dict. |
| `ns.report_deploy(release, commit=None, actor="ci", default_model=None)` | Records a deploy, so Nightly can tie an incident to the change that caused it. |
| `ns.record(outcome, trace_id=None, value_usd=0.0, ...)` | Reports a graded run: `ok`, `failed`, `escalated` or `negative`. `value_usd` is money lost on that run. The current neatlogs/OpenTelemetry trace id is attached automatically. Optional run details: `input`, `output`, `steps`, `tool_errors`, `tokens`, `latency_ms`, `cost_usd`. |
| `ns.serve_replays(handler, poll_s=3.0)` | Starts a background thread that runs Nightly's replay jobs through `handler(input) -> {"ok": bool, "output": str}`. The handler must not cause side effects. |
| `ns.close()` | Stops the replay thread. |
| `current_trace_id()` | The active neatlogs/OpenTelemetry trace id, or `None`. |

`report_deploy` and `record` return `True` when Nightly accepted the call. They never raise.

## Privacy

The SDK sends only what you pass to it: deploys, outcomes, the run details you choose, and replay
results. Prompts and outputs stay in your own neatlogs project unless you pass them to `record`.

## Links

- Website: https://web-emrq.vercel.app
- Docs: https://web-emrq.vercel.app/docs
- Source: https://github.com/e-man07/neat-hacks/tree/main/sdk/python
