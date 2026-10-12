import type { Metadata } from "next";
import type { ReactNode } from "react";
import PageShell from "@/components/PageShell";
import { Brand } from "@/components/Marks";
import { Card, Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "For judges · Nightly",
  description: "Every neatHack judging criterion, mapped to the evidence that backs it.",
};

const GH = "https://github.com/e-man07/nightly/blob/main";
const TREE = "https://github.com/e-man07/nightly/tree/main";

type Item = { claim: ReactNode; links: [string, string][]; shots?: [string, string][] };
type Criterion = { name: ReactNode; weight: string; items: Item[] };

const CRITERIA: Criterion[] = [
  {
    name: "The agent completes a substantial task",
    weight: "30%",
    items: [
      {
        claim: "The whole incident lifecycle, on its own: detect → investigate → price → decide → contain → verify → report.",
        links: [
          ["Try it live (sandbox)", "/sandbox"],
          ["How it works", "/#how"],
        ],
      },
      {
        claim: "Benchmark of six staged incidents: 6/6 handled correctly; five contained 13–21 s after detection and verified by replay.",
        links: [
          ["Benchmark results", "/benchmark"],
          ["Run logs", `${TREE}/evidence/benchmark`],
        ],
      },
      {
        claim: "Live on a second agent (Scout) connected only through the SDK and neatlogs: detected ~1.5 min after deploy, rolled back, 3/3 replays passed, resolved in under 3 min.",
        links: [["Scout incidents", `${TREE}/evidence/scout`]],
      },
    ],
  },
  {
    name: "It improved, with before/after numbers",
    weight: "in 30%",
    items: [
      {
        claim: "Run 1 → run 3: 4/6 → 6/6 incidents handled correctly, after fixing confidence calibration and impact pricing based on what run 1 showed.",
        links: [["Before / after", `${GH}/evidence/before-after.md`]],
      },
      {
        claim: "The same change in Harbor’s neatlogs traces. Before: the policy is checked. During the bad release: a $249 refund with no policy check. After Nightly’s rollback: the policy is checked again and the refund is declined.",
        links: [["Trace ids", `${GH}/evidence/neatlogs.md`]],
        shots: [
          ["/evidence/neatlogs-before-policy-checked.jpg", "Before (r41): lookup → check_refund_policy → refund"],
          ["/evidence/neatlogs-during-unchecked-refund.jpg", "During (bad release): refund with no policy check"],
          ["/evidence/neatlogs-after-policy-restored.jpg", "After rollback: policy checked, refund declined"],
        ],
      },
    ],
  },
  {
    name: "It recovers from failures",
    weight: "in 30%",
    items: [
      {
        claim: "If a fix fails verification, Nightly undoes it by itself and escalates. Covered by a test.",
        links: [
          ["runner.py", `${GH}/backend/nightshift/runner.py`],
          ["The test", `${GH}/backend/tests/test_nightshift.py#L111`],
        ],
      },
      {
        claim: "It kept working when neatlogs dropped most of Scout’s traces: runs are now also counted from SDK events.",
        links: [["What we learned", `${GH}/evidence/scout/README.md#what-we-learned-and-changed`]],
      },
    ],
  },
  {
    name: (
      <span className="inline-flex flex-wrap items-center gap-2">
        Uses <Brand name="neatlogs" h={18} /> <Brand name="entire" h={18} /> <Brand name="cfo" h={20} />
      </span>
    ),
    weight: "25%",
    items: [
      {
        claim: "neatlogs: every agent run and every investigation is traced, and Nightly reads traces back over the neatlogs MCP. It turns each incident’s failing traces into a neatlogs detection, then verifies the fix by that detection’s hit rate: 18 hits before the rollback, 0 after. If it is still firing, the fix is undone.",
        links: [
          ["neatlogs evidence", `${GH}/evidence/neatlogs.md`],
          ["The verification loop", `${GH}/evidence/neatlogs.md#neatlogs-in-the-verification-loop`],
          ["neatlogs_check.py", `${GH}/backend/nightshift/neatlogs_check.py`],
        ],
        shots: [
          ["/evidence/neatlogs-investigation-trace.jpg", "One investigation in neatlogs: the Sonnet agent’s tool calls, then the verification replays"],
          ["/evidence/neatlogs-detections.jpg", "The detection Nightly created after the prompt-injection wave"],
          ["/evidence/neatlogs-traces-list.jpg", "1,075 traces in the project"],
        ],
      },
      {
        claim: "Entire: every bad release was written by a separate Claude Code session with its own checkpoint. Nightly resolves commit → checkpoint → prompt → the coding agent’s own warning.",
        links: [
          ["Entire evidence", `${GH}/evidence/entire.md`],
          ["r46 checkpoint on entire.io", "https://entire.io/gh/e-man07/nightly/commit/e26a58f17ad4af5d119de989ebeaafc7055b8929"],
        ],
      },
      {
        claim: "entire-graph gives our own coding agent repository context: the guide is installed in CLAUDE.md and AGENTS.md, and sessions locate code with graph search and impact before editing. At runtime Nightly adds entire-graph’s change list to every incident’s provenance.",
        links: [
          ["entire-graph evidence", `${GH}/evidence/entire.md#entire-graph-as-coding-agent-context`],
          ["CLAUDE.md", `${GH}/CLAUDE.md`],
        ],
      },
      {
        claim: "cfo.ai: the business plan (break-even M08, runway > 24 months) and the customer unit economics Nightly uses to price every incident.",
        links: [
          ["Business plan in cfo.ai", "https://app.cfo.ai/s/CsWafbQfu2U1y94W"],
          ["Unit economics in cfo.ai", "https://app.cfo.ai/s/fHcCAy2lG_aXs3Qt"],
          ["The business", "/business"],
        ],
      },
    ],
  },
  {
    name: "A real product, not a script",
    weight: "usefulness",
    items: [
      {
        claim: "GitHub sign-in, a 5-step “Connect an agent” wizard, agent pages, an incident inbox, a Slack app with Approve and Undo, and an SDK on PyPI.",
        links: [
          ["Open the app", "/app"],
          ["SDK docs", "/docs"],
          ["nightly-sdk on PyPI", "https://pypi.org/project/nightly-sdk/"],
        ],
      },
    ],
  },
  {
    name: "Built during the hackathon, in public",
    weight: "15%",
    items: [
      {
        claim: "Posted on X with #neatHack as we built. Commit history starts with the plan only; the build log records each phase with timestamps.",
        links: [
          ["#neatHack post on X", "https://x.com/WhyParabola/status/2109333155702571151"],
          ["Build log", `${GH}/hackathon.md`],
          ["Commits", "https://github.com/e-man07/nightly/commits/main"],
        ],
      },
    ],
  },
];

export default function JudgePage() {
  return (
    <PageShell title="For judges" sub="Each criterion, and where to check it.">
      <p className="max-w-[720px] text-[15px] leading-relaxed text-muted">
        Nightly is the on-call engineer for AI agents. When a change makes an agent fail quietly, it finds the cause, prices
        the damage, applies a fix that can be undone, proves it by replaying the failed runs, and pages a human once.
        Benchmark incidents are staged on purpose so they are reproducible; the Scout incidents ran live through the product.
      </p>
      <div className="mt-10 space-y-4">
        {CRITERIA.map((c, i) => (
          <Card key={i} className="p-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-[19px] font-medium tracking-tight text-fg">{c.name}</h2>
              <Label>{c.weight}</Label>
            </div>
            <div className="mt-4 space-y-4">
              {c.items.map((it, j) => (
                <div key={j} className="border-t border-line pt-4 first:border-0 first:pt-0">
                  <p className="text-[14.5px] leading-relaxed text-fg-2">{it.claim}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.links.map(([label, href]) => (
                      <a
                        key={href}
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer"
                        className="rounded-full border border-line px-3 py-1 text-[12.5px] text-fg transition hover:border-line-strong hover:bg-chip"
                      >
                        {label} {href.startsWith("http") ? "↗" : "→"}
                      </a>
                    ))}
                  </div>
                  {it.shots && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {it.shots.map(([src, caption]) => (
                        <a key={src} href={src} target="_blank" rel="noreferrer" className="group block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={caption}
                            loading="lazy"
                            className="aspect-[16/10] w-full rounded-lg border border-line object-cover object-top transition group-hover:border-line-strong"
                          />
                          <span className="mt-1.5 block text-[12px] leading-snug text-muted">{caption}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
