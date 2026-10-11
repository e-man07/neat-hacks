# nightly-sdk

Three calls connect an agent to Nightly. Nightly can then roll back a release, fail over a
model or switch off a capability for you — within the policy you set — and verify the fix by
replaying failed inputs through your own agent.

```python
from nightly_sdk import Nightly

ns = Nightly()   # reads NIGHTLY_API_URL and NIGHTLY_AGENT_TOKEN

prompt = load_prompt(ns.release("v12"))          # which release to run
model = ns.model("claude-haiku")                  # which model (failover-aware)
if ns.flag("auto_refunds", True): ...             # kill switches
max_steps = ns.max_steps(8)                       # step cap

ns.report_deploy("v13", commit="<git sha>")      # from CI, when you ship
ns.record("failed", trace_id=..., value_usd=12)   # optional business outcome per run
ns.serve_replays(lambda inp: run_agent(inp, dry_run=True))  # verification hook
```

Fail-open: if Nightly is unreachable, every call returns your default.
Traces come from your own neatlogs project; the SDK never sends prompts or outputs anywhere.
