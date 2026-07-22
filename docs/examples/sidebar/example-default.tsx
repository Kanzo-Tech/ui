"use client";

import {
  BoxesIcon,
  DatabaseIcon,
  HouseIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    // The provider wraps BOTH the sidebar and the content — that pairing is the whole
    // point, and a sidebar rendered on its own reads as a floating panel rather than as
    // navigation for something. `h-96` gives the shell a definite height; in a real app
    // that comes from the viewport.
    <SidebarProvider className="h-96 min-h-0 w-full overflow-hidden rounded-lg border">
      <Sidebar className="border-e" collapsible="none">
        <SidebarHeader>
          <span className="px-2 font-semibold text-sm">Kanzo</span>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          {/* Two groups, because a single flat list never shows what `SidebarGroupLabel`
              is for or how groups are spaced apart. */}
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <HouseIcon />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <DatabaseIcon />
                  <span>Connections</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>12</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <BoxesIcon />
                  <span>Catalog</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <ShieldCheckIcon />
                  <span>Quality</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UsersIcon />
                  <span>Members</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />
        <SidebarFooter>
          <span className="px-2 text-muted-foreground text-xs">
            aemet · production
          </span>
        </SidebarFooter>
      </Sidebar>

      {/* SidebarInset owns the `<main>` landmark. Left deliberately empty: this page is
          about the sidebar, and the point of showing the region at all is that you can
          see what the navigation is navigating. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">Page content</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
