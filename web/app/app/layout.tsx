import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth, githubEnabled, signOut } from "@/auth";
import AppSidebar from "@/components/app/AppNav";
import TopBar from "@/components/app/TopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = { title: "Nightly" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = githubEnabled ? ((await auth()) as { login?: string; avatar?: string | null } | null) : null;
  const login = session?.login ?? "dev";
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={defaultOpen} className="bg-sidebar text-foreground">
        <AppSidebar login={login} avatar={session?.avatar ?? null} github={githubEnabled} signOut={githubEnabled ? doSignOut : undefined} />
        <SidebarInset className="min-w-0 bg-[#fcfcfb]">
          <TopBar />
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
