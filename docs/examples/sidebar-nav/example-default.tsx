"use client";

import { BoxesIcon, DatabaseIcon, HouseIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarNav,
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
    <SidebarProvider className="min-h-0 w-64">
      <Sidebar className="rounded-lg border" collapsible="none">
        <SidebarContent>
          <SidebarNav items={items} label="Platform" />
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
