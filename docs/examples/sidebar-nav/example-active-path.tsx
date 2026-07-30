"use client";

import {
  CheckCheckIcon,
  FootprintsIcon,
  PaletteIcon,
  ScrollIcon,
  ScrollTextIcon,
  UsersIcon,
} from "lucide-react";
import { SidebarInset, SidebarNav, SidebarProvider, type SidebarNavItem } from "@kanzo-tech/ui";

const contracts: SidebarNavItem[] = [
  { title: "Open", href: "#/board/open", icon: <ScrollTextIcon /> },
  { title: "Afield", href: "#/board/afield", icon: <FootprintsIcon /> },
  { title: "Settled", href: "#/board/settled", icon: <CheckCheckIcon /> },
];

const hall: SidebarNavItem[] = [
  { title: "Members", href: "#/hall/members", icon: <UsersIcon /> },
  { title: "Heraldry", href: "#/hall/heraldry", icon: <PaletteIcon /> },
  { title: "Charter", href: "#/hall/charter", icon: <ScrollIcon /> },
];

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <div className="w-60 shrink-0 border-e bg-sidebar">
        {/* Settings-style navigation: one SidebarNav per heading, so each titled block is its
            own named `<nav>` landmark. No item carries `isActive` — `activePath` is the
            caller's current route, and "Open" would stay lit on any path nested under
            `#/board/open` too. */}
        <SidebarNav activePath="#/board/open" items={contracts} label="Contracts" />
        <SidebarNav activePath="#/board/open" items={hall} label="Hall" />
      </div>

      {/* SidebarInset owns the `<main>` landmark. Near-empty on purpose: this page is about
          the navigation, and the region exists so you can see what it navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">Open contracts</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
