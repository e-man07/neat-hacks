"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Overview" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/incidents", label: "Incidents" },
  { href: "/app/integrations", label: "Paging" },
  { href: "/docs", label: "SDK docs" },
  { href: "/sandbox", label: "Sandbox demo" },
];

export default function AppNav({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  if (mobile) {
    return (
      <nav className="flex gap-3 overflow-x-auto text-xs text-muted">
        {LINKS.slice(0, 4).map((l) => (
          <Link key={l.href} href={l.href} className={active(l.href) ? "text-fg" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mt-6 space-y-0.5">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`block rounded-md px-2 py-1.5 text-sm transition ${
            active(l.href) ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
