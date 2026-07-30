"use client";

import { DatabaseIcon, HouseIcon, UsersIcon } from "lucide-react";
import {
  Badge,
  Button,
  ButtonGroup,
  Kbd,
  KbdGroup,
  Show,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@kanzo-tech/ui";

// Everything that reads the sidebar lives below the provider — which is why the readout is its
// own component rather than part of `Example`.
function Shell() {
  const { state, open, isMobile, openMobile, setOpen, toggleSidebar } =
    useSidebar();

  return (
    <>
      <Show when={open}>
        <Sidebar className="border-e" collapsible="none">
          <SidebarHeader>
            <span className="px-2 font-semibold text-sm">Kanzo</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
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
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <UsersIcon />
                    <span>Members</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </Show>

      <SidebarInset className="bg-muted/24">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">state: {state}</Badge>
            <Badge variant="secondary">open: {String(open)}</Badge>
            <Badge variant="secondary">isMobile: {String(isMobile)}</Badge>
            <Badge variant="secondary">openMobile: {String(openMobile)}</Badge>
          </div>

          <ButtonGroup aria-label="Sidebar state">
            <Button onClick={toggleSidebar} size="sm" variant="outline">
              toggleSidebar()
            </Button>
            <Button onClick={() => setOpen(true)} size="sm" variant="outline">
              setOpen(true)
            </Button>
            <Button onClick={() => setOpen(false)} size="sm" variant="outline">
              setOpen(false)
            </Button>
          </ButtonGroup>

          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            The provider binds
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>B</Kbd>
            </KbdGroup>
            to the same toggle.
          </p>
        </div>
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
