import type { Metadata } from "next";
import Link from "next/link";
import { auth, githubEnabled, signOut } from "@/auth";
import AppNav from "@/components/app/AppNav";
import ThemeToggle from "@/components/ThemeToggle";
import { Moon } from "@/components/ui";

export const metadata: Metadata = { title: "Night Shift" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = githubEnabled ? ((await auth()) as { login?: string; avatar?: string | null } | null) : null;
  const login = session?.login ?? "dev";
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <Link href="/app" className="flex items-center gap-2 px-2 text-[15px] font-semibold tracking-tight text-white">
          <Moon /> night shift
        </Link>
        <AppNav />
        <div className="mt-auto space-y-2 border-t border-line pt-3">
          <div className="flex items-center gap-2 px-2">
            {session?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.avatar} alt="" className="h-6 w-6 rounded-full" />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[11px]">{login[0]?.toUpperCase()}</span>
            )}
            <span className="truncate text-sm text-fg-2">{login}</span>
            <span className="ml-auto">
              <ThemeToggle />
            </span>
          </div>
          {githubEnabled ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-white/[0.05] hover:text-fg">
                Sign out
              </button>
            </form>
          ) : (
            <p className="px-2 text-xs text-faint">Local dev mode (no sign-in configured)</p>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Link href="/app" className="flex items-center gap-2 text-sm font-semibold text-white">
            <Moon /> night shift
          </Link>
          <AppNav mobile />
        </div>
        <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
