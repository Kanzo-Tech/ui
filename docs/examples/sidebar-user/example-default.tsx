"use client";

import { LogOutIcon, ScrollIcon, UserIcon } from "lucide-react";
import { Sidebar, SidebarFooter, SidebarInset, SidebarProvider, SidebarUser } from "@kanzo-tech/ui";
import { VIEWER } from "@/example/people";

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="justify-end border-e" collapsible="none">
        <SidebarFooter>
          <SidebarUser
            menuItems={[
              { label: "Profile", icon: <UserIcon />, href: "#/roster/ravenna" },
              { label: "Hall charter", icon: <ScrollIcon />, href: "#/hall/charter" },
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
            user={{ name: VIEWER.name, email: VIEWER.email }}
          />
        </SidebarFooter>
      </Sidebar>

      {/* SidebarInset owns the `<main>` landmark. Near-empty on purpose: this page is about
          the navigation, and the region exists so you can see what it navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">The board</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
