import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Bot, Hammer, LifeBuoy, Package, Plug, TrendingUp, type LucideIcon } from "lucide-react";
import Nav from "@/components/Nav";
import { Brand } from "@/components/Marks";
import { Moon } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "For judges · Nightly",
  description: "Every neatHack judging criterion, mapped to the evidence that backs it.",
};

const GH = "https://github.com/e-man07/nightly/blob/main";
const TREE = "https://github.com/e-man07/nightly/tree/main";

type Item = { claim: ReactNode; links: [string, string][]; shots?: [string, string][] };
type Criterion = { id: string; icon: LucideIcon; toc: string; name: ReactNode; weight: string; items: Item[] };

const CRITERIA: Criterion[] = [
  {
    id: "substantial-task",
    icon: Bot,
    toc: "Completes a substantial task",
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
        claim: "Six incidents planted in Harbor, a live refunds agent: 6/6 handled correctly; five contained 13–21 s after detection and verified by replay.",
        links: [
          ["Benchmark results", "/benchmark"],
          ["Run logs", `${TREE}/evidence/benchmark`],
        ],
      },
      {
        claim: "Live on a second agent (Scout) connected only through the SDK and neatlogs: detected ~1.5 min after deploy, rolled back, 3/3 replays passed, resolved in under 3 min.",
        links: [["Scout incidents", `${TREE}/evidence/scout`]],
      },
      {
        claim: "A blind incident nobody planned: a fresh Claude Code session chose a “make it cheaper” change and we deployed it unread. Nightly found the release and the two changes that broke one question type (the eval agrees: 17/18, that exact question) and deferred it, since $0 was at risk. We published what it got wrong too.",
        links: [["Blind incident", `${GH}/evidence/scout/blind/README.md`]],
      },
    ],
  },
  {
    id: "improved",
    icon: TrendingUp,
    toc: "Improved, before/after",
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
    id: "recovers",
    icon: LifeBuoy,
    toc: "Recovers from failures",
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
    id: "tools",
    icon: Plug,
    toc: "Uses neatlogs, Entire, cfo.ai",
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
    id: "product",
    icon: Package,
    toc: "A real product",
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
    id: "in-public",
    icon: Hammer,
    toc: "Built in public",
    name: "Built during the hackathon, in public",
    weight: "15%",
    items: [
      {
        claim: "Posted on X with #neatHack as we built. Commit history starts with the plan only; the build log records each phase with timestamps.",
        links: [
          ["#neatHack post: explainer video", "https://x.com/WhyParabola/status/2109333155702571151"],
          ["#neatHack post 2", "https://x.com/WhyParabola/status/2109581037995233462"],
          ["Build log", `${GH}/hackathon.md`],
          ["Commits", "https://github.com/e-man07/nightly/commits/main"],
        ],
      },
    ],
  },
];

/** Rubric overview for the sidebar (weights from the official judging criteria, see hackathon.md).
 *  TODO: the 20% demo criterion has no section here yet; the demo video link is under "Built in public". */
const RUBRIC: { label: string; weight: number; ids: string[] }[] = [
  { label: "Agent", weight: 30, ids: ["substantial-task", "improved", "recovers"] },
  { label: "Tool use", weight: 25, ids: ["tools"] },
  { label: "Building in public", weight: 15, ids: ["in-public"] },
  { label: "Usefulness", weight: 10, ids: ["product"] },
];

const PROOF = [
  { n: "6/6", label: "incidents handled", sub: "planted in Harbor, a live refunds agent" },
  { n: "13–21 s", label: "to contain", sub: "after detection, verified by replay" },
  { n: "4/6 → 6/6", label: "it got better", sub: "benchmark run 1 → run 3" },
  { n: "18 → 0", label: "detection hits", sub: "neatlogs, before vs after the rollback" },
];

const byId = Object.fromEntries(CRITERIA.map((c) => [c.id, c]));

export default function JudgePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-bg pb-24">
      <Nav />

      {/* Header */}
      <header className="relative">
        <div className="mx-auto max-w-[1180px] px-4 pt-10 sm:px-5 sm:pt-16">
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-[12px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /> neatHack 2026 · for judges
          </span>
          <h1 className="subhead mt-5 text-[36px] sm:text-[48px]">
            For judges. <span className="dim">Each criterion, and where to check it.</span>
          </h1>
          <p className="mt-5 max-w-[760px] text-[15.5px] leading-relaxed text-muted">
            Nightly is the on-call engineer for AI agents. When a change makes an agent fail quietly, it finds the cause, prices
            the damage, applies a fix that can be undone, proves it by replaying the failed runs, and pages a human once.
            Nightly and both agents it watches are live LLM agents: real model calls, real tool calls, every run traced in neatlogs,
            and every bad release written by a separate Claude Code session. The agents’ users are scripted and the benchmark
            incidents were planted, so the results can be reproduced.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {PROOF.map((s) => (
              <div key={s.label} className="bg-bg p-4 sm:p-6">
                <div className="whitespace-nowrap text-[22px] leading-none tracking-[-0.04em] text-fg tabular-nums sm:text-[34px]">{s.n}</div>
                <div className="mt-2.5 text-[13.5px] font-medium text-fg">{s.label}</div>
                <div className="mt-1 text-[12px] leading-snug text-muted">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto mt-12 grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-10 px-4 sm:px-5 lg:mt-16 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Weight overview / table of contents */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Judging criteria" className="rounded-xl border border-line bg-card-2 p-4 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="eyebrow text-[11.5px]">CRITERIA · WEIGHT</div>
            <ol className="mt-4 space-y-4">
              {RUBRIC.map((g) => (
                <li key={g.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-fg">{g.label}</span>
                    <span className="font-mono text-[12px] text-muted tabular-nums">{g.weight}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-fg/80" style={{ width: `${(g.weight / 30) * 100}%` }} />
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {g.ids.map((id) => {
                      const c = byId[id];
                      const Icon = c.icon;
                      return (
                        <li key={id}>
                          <a
                            href={`#${id}`}
                            className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted transition-colors hover:bg-secondary hover:text-fg"
                          >
                            <Icon className="size-3.5 shrink-0" aria-hidden />
                            {c.toc}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* Criteria */}
        <div className="space-y-6">
          {CRITERIA.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.id} id={c.id} className="scroll-mt-24 gap-0 border-line py-0 shadow-none">
                <CardHeader className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-card-2 text-fg">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <h2 className="min-w-0 flex-1 text-[17px] font-medium tracking-tight text-fg sm:text-[19px]">{c.name}</h2>
                  <Badge variant="outline" className="shrink-0 border-line font-mono text-[11.5px] text-fg">
                    {c.weight}
                  </Badge>
                </CardHeader>
                <CardContent className="divide-y divide-line px-0">
                  {c.items.map((it, j) => (
                    <div key={j} className="px-5 py-5 sm:px-6">
                      <p className="text-[14.5px] leading-relaxed text-fg-2">{it.claim}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {it.links.map(([label, href]) => (
                          <EvidenceLink key={href} label={label} href={href} />
                        ))}
                      </div>
                      {it.shots && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {it.shots.map(([src, caption]) => (
                            <a
                              key={src}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              aria-label={`${caption} (open full size)`}
                            >
                              <span className="block overflow-hidden rounded-lg border border-line bg-card-2 transition-colors group-hover:border-line-strong">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={caption}
                                  loading="lazy"
                                  className="aspect-[16/10] w-full object-cover object-top motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.02]"
                                />
                              </span>
                              <span className="mt-1.5 flex items-start gap-1 text-[12px] leading-snug text-muted group-hover:text-fg">
                                <span className="flex-1">{caption}</span>
                                <ArrowUpRight className="mt-px size-3 shrink-0" aria-hidden />
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          <footer className="flex flex-wrap items-center justify-between gap-3 pt-6 text-[13px] text-muted">
            <span className="flex items-center gap-2">
              <Moon size={14} /> Nightly · neatHack 2026
            </span>
            <span className="flex flex-wrap gap-5">
              <Link href="/" className="hover:text-fg">Home</Link>
              <Link href="/benchmark" className="hover:text-fg">Benchmark</Link>
              <a href="https://github.com/e-man07/nightly" className="hover:text-fg">GitHub</a>
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function EvidenceLink({ label, href }: { label: string; href: string }) {
  const external = href.startsWith("http");
  const inner = (
    <>
      {label}
      {external ? <ArrowUpRight className="text-muted" aria-hidden /> : <ArrowRight aria-hidden />}
    </>
  );
  if (external) {
    return (
      <Button asChild variant="outline" size="sm" className="h-8 border-line text-[12.5px] font-normal shadow-none">
        <a href={href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild variant="secondary" size="sm" className="h-8 text-[12.5px] font-normal">
      <Link href={href}>{inner}</Link>
    </Button>
  );
}
