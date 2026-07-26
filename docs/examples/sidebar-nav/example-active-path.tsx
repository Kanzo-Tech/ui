"use client";

import { BotIcon, BriefcaseIcon, CloudIcon, UserIcon } from "lucide-react";
import { SidebarInset, SidebarNav, SidebarProvider, type SidebarNavItem } from "@kanzo-tech/ui";

const workspace: SidebarNavItem[] = [
  { title: "Cloud accounts", href: "#/settings/cloud", icon: <CloudIcon /> },
  { title: "AI providers", href: "#/settings/ai", icon: <BotIcon /> },
];

const account: SidebarNavItem[] = [
  { title: "Profile", href: "#/settings/profile", icon: <UserIcon /> },
  { title: "Job defaults", href: "#/settings/jobs", icon: <BriefcaseIcon /> },
];

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <div className="w-60 shrink-0 border-e bg-sidebar">
        {/* Settings-style navigation: one SidebarNav per heading, so each titled block is its
            own named `<nav>` landmark. No item carries `isActive` — `activePath` is the
            caller's current route, and "Cloud accounts" would stay lit on any path nested
            under `#/settings/cloud` too. */}
        <SidebarNav activePath="#/settings/cloud" items={workspace} label="Workspace" />
        <SidebarNav activePath="#/settings/cloud" items={account} label="Account" />
      </div>

      {/* SidebarInset owns the `<main>` landmark. Near-empty on purpose: this page is about
          the navigation, and the region exists so you can see what it navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">Page content</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
