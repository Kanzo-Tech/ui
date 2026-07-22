"use client";

import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Sidebar, SidebarFooter, SidebarProvider, SidebarUser } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SidebarProvider className="min-h-0 w-64">
      <Sidebar className="justify-end rounded-lg border" collapsible="none">
        <SidebarFooter>
          <SidebarUser
            menuItems={[
              { label: "Profile", icon: <UserIcon />, href: "#" },
              { label: "Settings", icon: <SettingsIcon />, href: "#" },
              // Log out is an ordinary menu item: the product owns the flow, the copy
              // and any confirmation dialog.
              {
                label: "Log out",
                icon: <LogOutIcon />,
                variant: "destructive",
                separatorBefore: true,
                onSelect: () => {},
              },
            ]}
            user={{ name: "Ángel Iglesias", email: "angel@kanzo.tech" }}
          />
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
