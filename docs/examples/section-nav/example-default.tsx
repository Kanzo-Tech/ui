"use client";

import { BotIcon, BriefcaseIcon, CloudIcon, UserIcon } from "lucide-react";
import { SectionNav, SidebarProvider, type NavSection } from "@kanzo-tech/ui";

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
    <SidebarProvider className="min-h-0 w-60 rounded-lg border bg-sidebar">
      {/* `activePath` is the caller's current route: `#/settings/cloud` is active here, and
          so would be any path nested under it. */}
      <SectionNav activePath="#/settings/cloud" sections={sections} />
    </SidebarProvider>
  );
}
