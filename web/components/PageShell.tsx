import type { ReactNode } from "react";
import Nav from "./Nav";

export default function PageShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen pb-24">
      <Nav />
      <section className="mx-auto max-w-[1100px] px-4 pt-10">
        <h1 className="subhead text-[34px] sm:text-[42px]">
          {title}
          {sub && (
            <>
              <br />
              <span className="dim">{sub}</span>
            </>
          )}
        </h1>
        <div className="mt-10">{children}</div>
      </section>
    </main>
  );
}
