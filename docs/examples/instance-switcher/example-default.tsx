"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import {
  InstanceSwitcher,
  Sidebar,
  SidebarHeader,
  SidebarProvider,
  type Instance,
} from "@kanzo-tech/ui";

const instances: Instance[] = [
  { id: "kanzo", label: "Kanzo", description: "Owner" },
  { id: "acme", label: "ACME Data", description: "Member" },
  { id: "eu-open", label: "EU Open Data", description: "Member" },
];

export default function Example() {
  const [active, setActive] = useState("kanzo");

  return (
    <SidebarProvider className="min-h-0 w-64">
      <Sidebar className="rounded-lg border" collapsible="none">
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
    </SidebarProvider>
  );
}
