"use client";

import { BotIcon, BriefcaseIcon, CloudIcon, UserIcon } from "lucide-react";
import { SectionNav, SidebarInset, SidebarProvider, type NavSection } from "@kanzo-tech/ui";

const sections: NavSection[] = [
  {
    heading: "Workspace",
    items: [
      { href: "#/settings/cloud", label: "Cloud accounts", icon: <CloudIcon /> },
      { href: "#/settings/ai", label: "AI providers", icon: <BotIcon /> },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "#/settings/profile", label: "Profile", icon: <UserIcon /> },
      { href: "#/settings/jobs", label: "Job defaults", icon: <BriefcaseIcon /> },
    ],
  },
];

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <div className="w-60 shrink-0 border-e bg-sidebar">
        {/* `activePath` is the caller's current route: `#/settings/cloud` is active here, and
            so would be any path nested under it. */}
        <SectionNav activePath="#/settings/cloud" sections={sections} />
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
