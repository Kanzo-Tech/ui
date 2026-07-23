"use client";

import { BoxesIcon, DatabaseIcon, HouseIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarNav,
  SidebarInset,
  SidebarProvider,
  type SidebarNavItem,
} from "@kanzo-tech/ui";

const items: SidebarNavItem[] = [
  { title: "Dashboard", href: "#", icon: <HouseIcon />, isActive: true },
  {
    title: "Data",
    icon: <DatabaseIcon />,
    items: [
      { title: "Connections", href: "#", isActive: true },
      { title: "Jobs", href: "#" },
      { title: "Datasets", href: "#" },
    ],
  },
  { title: "Catalog", href: "#", icon: <BoxesIcon /> },
  { title: "Quality", href: "#", icon: <ShieldCheckIcon /> },
  {
    title: "Settings",
    icon: <SettingsIcon />,
    items: [
      { title: "Cloud accounts", href: "#" },
      { title: "AI providers", href: "#" },
    ],
  },
];

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
        <SidebarContent>
          <SidebarNav items={items} label="Platform" />
        </SidebarContent>
      </Sidebar>

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
