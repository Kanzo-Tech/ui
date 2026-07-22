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
    <SidebarProvider className="h-96 min-h-0 w-full overflow-hidden rounded-lg border">
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
