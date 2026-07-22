"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SidebarProvider className="min-h-0 w-64">
      <Sidebar className="rounded-lg border" collapsible="none">
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {[0, 1, 2, 3, 4].map((i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
