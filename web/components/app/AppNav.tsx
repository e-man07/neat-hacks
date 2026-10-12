"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  ChevronsUpDown,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Plus,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { type InboxIncident, useApi } from "@/lib/app";

type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean };

const MAIN: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/incidents", label: "Incidents", icon: Siren },
  { href: "/app/integrations", label: "Paging", icon: Bell },
];

const RESOURCES: NavItem[] = [
  { href: "/docs", label: "SDK docs", icon: BookOpen },
  { href: "/sandbox", label: "Sandbox demo", icon: FlaskConical },
];

export default function AppSidebar({
  login,
  avatar,
  github,
  signOut,
}: {
  login: string;
  avatar: string | null;
  github: boolean;
  signOut?: () => Promise<void>;
}) {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  const { data } = useApi<{ workspace?: { name: string }; open_incidents: InboxIncident[] }>("/overview", 20000);
  const openCount = data?.open_incidents?.length ?? 0;
  const active = (href: string) =>
    href === "/app" ? path === "/app" : href === "/app/agents" ? path.startsWith(href) && path !== "/app/agents/new" : path.startsWith(href);

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton asChild isActive={active(item.href)} tooltip={item.label}>
        <Link href={item.href} onClick={() => setOpenMobile(false)}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {item.href === "/app/incidents" && openCount > 0 && (
        <SidebarMenuBadge className="rounded-md bg-alert/10 text-alert">{openCount}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Nightly">
              <Link href="/app">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/nightly.png" alt="" className="size-5 object-contain" />
                </span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">Nightly</span>
                  <span className="truncate text-xs text-muted-foreground">{data?.workspace?.name ?? "Workspace"}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>On call</SidebarGroupLabel>
          <SidebarMenu>{MAIN.map(renderItem)}</SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Quick actions</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={path === "/app/agents/new"} tooltip="Connect an agent">
                <Link href="/app/agents/new" onClick={() => setOpenMobile(false)}>
                  <Plus />
                  <span>Connect an agent</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarMenu>{RESOURCES.map(renderItem)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    {avatar && <AvatarImage src={avatar} alt="" />}
                    <AvatarFallback className="rounded-lg bg-secondary text-xs font-medium">{login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">{login}</span>
                    <span className="truncate text-xs text-muted-foreground">{github ? "Signed in with GitHub" : "Local dev mode"}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{login}</div>
                  <div className="text-xs text-muted-foreground">
                    {github ? "GitHub account" : "Local dev mode (no sign-in configured)"}
                  </div>
                </DropdownMenuLabel>
                {github && signOut && (
                  <>
                    <DropdownMenuSeparator />
                    <form action={signOut}>
                      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                        <button type="submit" className="w-full">
                          <LogOut /> Sign out
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
