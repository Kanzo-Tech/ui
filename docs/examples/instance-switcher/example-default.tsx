"use client";

import { PlusIcon } from "lucide-react";
import {
  InstanceSwitcher,
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { INSTANCES } from "@/example/nav";
import { hall, type HallId, HOME_HALL } from "@/example/world";

/**
 * Shown in a real shell, not a floating header — the switcher sits at the top of a sidebar, so
 * that is where you have to see it to judge it. The sidebar is otherwise empty on purpose: a
 * navigation menu below would compete for attention and blur what this page is about. Open the
 * switcher to change halls.
 */
export default function Example() {
  const [active, setActive] = useState<HallId>(HOME_HALL);

  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
        <SidebarHeader>
          <InstanceSwitcher
            actions={[{ label: "Charter a hall", icon: <PlusIcon />, href: "#" }]}
            activeId={active}
            instances={INSTANCES}
            label="Halls"
            onSelect={(id) => setActive(id as HallId)}
          />
        </SidebarHeader>
      </Sidebar>

      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">{hall(active).motto}</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
