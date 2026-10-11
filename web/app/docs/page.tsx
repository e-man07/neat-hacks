import PageShell from "@/components/PageShell";
import { Code } from "@/components/app/bits";
import { Card, Label, PrimaryLink } from "@/components/ui";

export const metadata = { title: "Docs — Nightly" };

const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="mt-12 mb-3 scroll-mt-20 text-[20px] font-semibold text-white">
    {children}
  </h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-[15px] leading-relaxed text-fg-2">{children}</p>;

export default function Docs() {
  return (
    <PageShell title="Put your agent on call" sub="One SDK, your neatlogs key, five minutes.">
      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav className="hidden text-sm text-muted lg:block">
          <div className="sticky top-6 space-y-2">
            {[
              ["how", "How it works"],
              ["install", "1. Install"],
              ["trace", "2. Trace with neatlogs"],
              ["control", "3. Read the control plane"],
              ["report", "4. Report outcomes and deploys"],
              ["replay", "5. Let Nightly verify fixes"],
              ["policy", "6. Set the policy"],
              ["paging", "7. Paging"],
              ["example", "Full example"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block hover:text-fg">
                {label}
              </a>
            ))}
          </div>
        </nav>
        <div className="min-w-0 max-w-[760px]">
          <H id="how">How it works</H>
          <P>
            Nightly watches your agent through two channels: its <b>neatlogs traces</b> and the <b>outcome events</b> your agent
            reports. When a window of runs goes bad (failures, tool errors, escalations, runaway loops, cost spikes), it investigates.
            It reads the traces, the deploy log, the diff, and the Entire checkpoint with the coding-agent prompt behind the change. Then
            it prices the damage with your unit economics and decides under your policy.
          </P>
          <P>
            Containment is <b>reversible</b>: roll back the release, fail over the model, flip a kill switch, cap steps. It happens
            through the SDK&apos;s control plane, which your agent reads on every run. Every action is verified by replaying the failing
            inputs through your agent. Anything irreversible (a code fix PR, refunds, contacting customers) waits for your approval in
            Slack.
          </P>
          <Card className="my-6 grid gap-4 p-5 text-sm sm:grid-cols-3">
            {[
              ["detect", "neatlogs traces + SDK events, a rolling window against baseline"],
              ["decide", "confidence, $ at risk until a human wakes, your policy"],
              ["prove", "replays through your agent, then live metrics, or it undoes itself"],
            ].map(([k, v]) => (
              <div key={k}>
                <Label>{k}</Label>
                <div className="mt-1 text-fg-2">{v}</div>
              </div>
            ))}
          </Card>

          <H id="install">1. Install</H>
          <Code>{`pip install nightly-sdk neatlogs

export NIGHTLY_API_URL=https://api.your-nightshift-host
export NIGHTLY_AGENT_TOKEN=nsa_...      # from "Connect an agent"
export NEATLOGS_API_KEY=...                # your neatlogs project key`}</Code>
          <P>The SDK has zero dependencies and fails open. If Nightly is unreachable, your agent keeps its last known config or its defaults.</P>

          <H id="trace">2. Trace with neatlogs</H>
          <P>Wrap one run of your agent in a root span. Nightly polls your project for traces with that root span name.</P>
          <Code>{`import neatlogs
from openai import OpenAI

neatlogs.init(api_key=NEATLOGS_API_KEY, workflow_name="support-agent")
client = neatlogs.wrap(OpenAI())          # every LLM call becomes a span

with neatlogs.trace("support_conversation", kind="WORKFLOW"):
    ...  # your agent loop; raise inside a tool span to mark it errored`}</Code>

          <H id="control">3. Read the control plane</H>
          <P>These are the levers Nightly pulls during an incident. Read them at the start of each run (they&apos;re cached for 5 s).</P>
          <Code>{`from nightly_sdk import Nightly
ns = Nightly()

release   = ns.release("v1")              # rollback target
model     = ns.model("claude-haiku")      # model failover
max_steps = ns.max_steps(8)               # runaway-loop cap
refunds   = ns.flag("refunds_enabled", True)   # kill switch for a tool`}</Code>

          <H id="report">4. Report outcomes and deploys</H>
          <P>
            Grade each run however you already do (a rubric, a checker, a customer thumbs-down). Include the run details: the run then
            counts even if its trace is late, and the investigator can read the input.
          </P>
          <Code>{`ns.record("failed", value_usd=12.0,            # money lost on this run, if any
          input=message, output=reply, steps=n_steps, tool_errors=n_tool_errors,
          tokens=usage.total_tokens, latency_ms=elapsed_ms, note="refund above policy")

# in CI, after a deploy (the commit lets Nightly find the Entire checkpoint)
ns.report_deploy("v2", commit=os.environ["GIT_SHA"])`}</Code>

          <H id="replay">5. Let Nightly verify fixes</H>
          <P>
            After it acts, Nightly sends the failing inputs back to your agent to re-run on the new config. Run the handler without
            side effects (no refunds, no emails) and say whether it passed.
          </P>
          <Code>{`def replay(message: str) -> dict:
    result = run_agent(message, dry_run=True)
    return {"ok": result.ok and result.tool_errors == 0, "output": result.text}

ns.serve_replays(replay)     # background thread`}</Code>

          <H id="policy">6. Set the policy</H>
          <P>Each agent has a versioned YAML policy. Nightly acts alone only on actions listed under auto, and every one of them must be reversible.</P>
          <Code>{`gates:
  min_confidence: 0.6          # diagnosis confidence needed to act alone
  min_projected_loss_usd: 25   # below this, it waits for morning
  verify_replay_min_pass_rate: 0.8
auto:
  rollback_release: { reversible: true }
  failover_model:   { reversible: true, allowed_models: [nova-lite, claude-sonnet-4.6] }
  disable_flag:     { reversible: true, allowed_flags: [refunds_enabled] }
  cap_steps:        { reversible: true, min_steps: 4 }
needs_approval: [deploy_code_fix, refund_customers, contact_customers, delete_data]`}</Code>

          <H id="paging">7. Paging</H>
          <P>
            Add Nightly to Slack and it posts one message per incident with <b>Approve fix</b> and <b>Undo</b> buttons, updated as it works.
            Approving a code fix opens a revert PR on your repo with the postmortem and a regression eval. ntfy (phone push) and a generic
            webhook are there too.
          </P>

          <H id="example">Full example</H>
          <P>
            Scout, a docs assistant in the repo (<code>agents/scout/scout.py</code>), is wired exactly this way. Nightly caught its bad
            release, rolled it back and verified the fix in under three minutes. See <code>evidence/scout/</code>.
          </P>
          <div className="mt-8">
            <PrimaryLink href="/app/agents/new">Connect an agent</PrimaryLink>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
