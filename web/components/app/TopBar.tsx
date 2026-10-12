"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const NAMES: Record<string, string> = {
  agents: "Agents",
  incidents: "Incidents",
  integrations: "Paging",
  new: "Connect an agent",
};

/** Breadcrumb from the path: /app/agents/<id> -> Overview / Agents / <id>. */
function crumbs(path: string) {
  const parts = path.split("/").filter(Boolean).slice(1); // drop "app"
  const out: { href: string; label: string }[] = [{ href: "/app", label: "Overview" }];
  let href = "/app";
  parts.forEach((p, i) => {
    href += `/${p}`;
    // /app/incidents/<agent>/<id>: the agent segment has no page of its own; link it to the agent
    if (parts[0] === "incidents" && i === 1) {
      out.push({ href: `/app/agents/${p}`, label: p });
      return;
    }
    out.push({ href, label: NAMES[p] ?? decodeURIComponent(p) });
  });
  return out;
}

export default function TopBar() {
  const path = usePathname();
  const items = crumbs(path);
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={c.href + i}>
              {i > 0 && (
                <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground/60 ${i <= items.length - 2 ? "hidden sm:block" : ""}`} />
              )}
              {last ? (
                <span className="truncate font-medium text-foreground">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className={`truncate text-muted-foreground transition-colors hover:text-foreground ${i < items.length - 2 ? "hidden sm:inline" : ""}`}
                >
                  {c.label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>
      {path !== "/app/agents/new" && (
        <Button asChild size="sm" className="h-8">
          <Link href="/app/agents/new">
            <Plus />
            <span className="hidden sm:inline">Connect an agent</span>
          </Link>
        </Button>
      )}
    </header>
  );
}
