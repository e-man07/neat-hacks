import type { ReactNode } from "react";
import { Brand, GitHubMark, SlackMark } from "@/components/Marks";
import "./landing.css";

const LOGOS: { key: string; node: ReactNode }[] = [
  { key: "neatlogs", node: <Brand name="neatlogs" h={22} /> },
  { key: "entire", node: <Brand name="entire" h={21} /> },
  { key: "cfo", node: <Brand name="cfo" h={26} /> },
  {
    key: "slack",
    node: (
      <span className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-fg">
        <SlackMark size={22} /> Slack
      </span>
    ),
  },
  {
    key: "github",
    node: (
      <span className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-fg">
        <GitHubMark size={22} /> GitHub
      </span>
    ),
  },
  {
    key: "pypi",
    node: (
      <span className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-fg">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-[#3775a9] font-mono text-[11px]" style={{ color: "#fff" }}>
          py
        </span>
        PyPI
      </span>
    ),
  },
];

/** Infinite logo strip of the tools Nightly is built on and ships through. Four copies of the set,
 *  scrolled by half, so the loop is seamless on wide screens. */
export default function LogoMarquee() {
  const copies = [0, 1, 2, 3];
  return (
    <div className="lp-marquee-mask overflow-hidden">
      <div className="lp-marquee flex w-max">
        {copies.flatMap((c) =>
          LOGOS.map((l) => (
            <span
              key={`${l.key}-${c}`}
              aria-hidden={c > 0 || undefined}
              className="flex h-10 shrink-0 items-center px-8 opacity-80 transition hover:opacity-100 sm:px-12"
            >
              {l.node}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
