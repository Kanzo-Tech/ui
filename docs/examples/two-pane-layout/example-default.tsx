"use client";

import { BotIcon, BriefcaseIcon, CloudIcon, UserIcon } from "lucide-react";
import {
  PageShell,
  SectionNav,
  SidebarProvider,
  TwoPaneLayout,
  type NavSection,
} from "@kanzo-tech/ui";

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
    <SidebarProvider className="h-[380px] min-h-0 w-full overflow-hidden rounded-lg border bg-background">
      <TwoPaneLayout nav={<SectionNav activePath="#/settings/cloud" sections={sections} />}>
        <PageShell>
          <PageShell.Header description="Where this workspace stores its data." title="Cloud accounts" />
          <PageShell.Content>
            <div className="h-48 rounded-lg border border-border border-dashed" />
          </PageShell.Content>
        </PageShell>
      </TwoPaneLayout>
    </SidebarProvider>
  );
}
