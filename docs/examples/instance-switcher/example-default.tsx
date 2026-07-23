"use client";

import { PlusIcon } from "lucide-react";
import {
  InstanceSwitcher,
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  type Instance,
} from "@kanzo-tech/ui";
import { useState } from "react";

const instances: Instance[] = [
  { id: "kanzo", label: "Kanzo", description: "Owner" },
  { id: "acme", label: "ACME Data", description: "Member" },
  { id: "eu-open", label: "EU Open Data", description: "Member" },
];

/**
 * Shown in a real shell, not a floating header — the switcher sits at the top of a sidebar, so
 * that is where you have to see it to judge it. The sidebar is otherwise empty on purpose: a
 * navigation menu below would compete for attention and blur what this page is about. Open the
 * switcher to change the active workspace.
 */
export default function Example() {
  const [active, setActive] = useState("kanzo");

  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
        <SidebarHeader>
          <InstanceSwitcher
            actions={[{ label: "Create workspace", icon: <PlusIcon />, href: "#" }]}
            activeId={active}
            instances={instances}
            label="Workspaces"
            onSelect={setActive}
          />
        </SidebarHeader>
      </Sidebar>

      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">{active}</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
