"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon } from "./ui";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/business", label: "Business" },
];

/** Floating pill nav: flat at the top of the page, lifts into a card once you scroll. */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="sticky top-0 z-40 px-3 pt-3">
      <header
        className={`mx-auto flex w-full items-center justify-between rounded-2xl px-3 py-2.5 transition-all duration-300 sm:px-4 ${
          scrolled ? "max-w-[1000px] border border-line bg-white/95 shadow-soft backdrop-blur" : "max-w-[1180px] border border-transparent"
        }`}
        style={scrolled ? { background: "rgba(255,255,255,0.92)" } : undefined}
      >
        <Link href="/" className="flex items-center gap-2 text-[14px] font-medium tracking-tight text-fg">
          <Moon size={30} />
          Nightly
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-fg md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-muted">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/docs" className="rounded-lg bg-chip px-3.5 py-2 text-[14px] font-medium text-fg transition hover:bg-[#e8e7e0]">
            Docs
          </Link>
          <Link href="/app" className="rounded-lg bg-[#111] px-3.5 py-2 text-[14px] font-medium text-white transition hover:bg-[#2a2a2a]" style={{ color: "#fff" }}>
            Sign in
          </Link>
        </div>
      </header>
    </div>
  );
}
