"use client";

import type { ReactNode } from "react";
import {
  CoinsIcon,
  EyeIcon,
  PawPrintIcon,
  ScrollTextIcon,
  SettingsIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarNav,
  SidebarInset,
  SidebarProvider,
  type SidebarNavItem,
} from "@kanzo-tech/ui";
import { NAV } from "@/example/nav";

// `NAV` names its icons rather than holding elements, so the world stays React-free.
const ICONS: Record<string, ReactNode> = {
  ScrollText: <ScrollTextIcon />,
  Swords: <SwordsIcon />,
  Users: <UsersIcon />,
  PawPrint: <PawPrintIcon />,
  Eye: <EyeIcon />,
  Coins: <CoinsIcon />,
  Settings: <SettingsIcon />,
};

const items: SidebarNavItem[] = NAV.map((entry) => ({
  title: entry.title,
  href: entry.href,
  icon: entry.icon ? ICONS[entry.icon] : undefined,
  isActive: entry.href === "#/board",
  items: entry.items?.map((child) => ({
    title: child.title,
    href: child.href ?? "#",
    isActive: child.href === "#/board/open",
  })),
}));

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
        <SidebarContent>
          <SidebarNav items={items} label="The Amber Hall" />
        </SidebarContent>
      </Sidebar>

      {/* SidebarInset owns the `<main>` landmark. Near-empty on purpose: this page is about
          the navigation, and the region exists so you can see what it navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">The board</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
