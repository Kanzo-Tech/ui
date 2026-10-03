"use client";

import { DatabaseIcon, HouseIcon, ScanIcon } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Show,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarIntent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@kanzo-tech/ui";

// The immersive route is a state here so the preview can enter and leave it; in an application it
// is a page that renders `<SidebarIntent collapsed />`, and leaving it is navigating away.
function Shell() {
  const { open } = useSidebar();
  const [route, setRoute] = useState<"home" | "explorer">("home");

  return (
    <>
      <Show when={open}>
        <Sidebar className="border-e" collapsible="none">
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={route === "home"}
                    onClick={() => setRoute("home")}
                  >
                    <HouseIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={route === "explorer"}
                    onClick={() => setRoute("explorer")}
                  >
                    <ScanIcon />
                    <span>Explorer</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <DatabaseIcon />
                    <span>Connections</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </Show>

      <SidebarInset className="bg-muted/24">
        <div className="flex items-center gap-2 border-b p-2">
          <SidebarTrigger />
          <Badge variant="secondary">{route}</Badge>
        </div>
        {route === "explorer" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <SidebarIntent collapsed />
            <p className="text-muted-foreground text-sm">
              A full-canvas page. The trigger still opens the sidebar here, until you leave.
            </p>
            <Button onClick={() => setRoute("home")} size="sm" variant="outline">
              Leave the explorer
            </Button>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <p className="text-muted-foreground text-sm">
              Your preference, as you last left it outside the explorer.
            </p>
            <Button onClick={() => setRoute("explorer")} size="sm" variant="outline">
              Open the explorer
            </Button>
          </div>
        )}
      </SidebarInset>
    </>
  );
}

export default function Example() {
  return (
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Shell />
    </SidebarProvider>
  );
}
