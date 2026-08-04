"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarInset,
  SidebarProvider,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
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

      {/* SidebarInset is a neutral offset column and carries no landmark — a real page puts a
          ShellMain in here, as the app-shell showcase does. This preview renders inside the docs
          page's own <main>, so adding a second one would be a conformance error. Near-empty on
          purpose: the region exists so you can see what the navigation navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">The board</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
