"use client";

import {
  CoinsIcon,
  PawPrintIcon,
  ScrollTextIcon,
  SettingsIcon,
  SwordsIcon,
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
import { openQuests } from "@/example/quests";

export default function Example() {
  return (
    // The provider wraps BOTH the sidebar and the content — that pairing is the whole
    // point, and a sidebar rendered on its own reads as a floating panel rather than as
    // navigation for something. `h-96` gives the shell a definite height; in a real app
    // that comes from the viewport.
    <SidebarProvider className="h-[28rem] min-h-0 w-full overflow-hidden">
      <Sidebar className="border-e" collapsible="none">
        <SidebarHeader>
          <span className="px-2 font-semibold text-sm">The Amber Hall</span>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          {/* Two groups, because a single flat list never shows what `SidebarGroupLabel`
              is for or how groups are spaced apart. */}
          <SidebarGroup>
            <SidebarGroupLabel>Board</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <ScrollTextIcon />
                  <span>The board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <SwordsIcon />
                  <span>Open contracts</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{openQuests().length}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UsersIcon />
                  <span>Roster</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <PawPrintIcon />
                  <span>Bestiary</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Hall</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CoinsIcon />
                  <span>Ledger</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <SettingsIcon />
                  <span>Charter</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />
        <SidebarFooter>
          <span className="px-2 text-muted-foreground text-xs">
            Thornmarch · chartered 1194
          </span>
        </SidebarFooter>
      </Sidebar>

      {/* SidebarInset is a neutral offset column and carries no landmark — a real page puts a
          ShellMain in here, as the app-shell showcase does. This preview renders inside the docs
          page's own <main>, so adding a second one would be a conformance error. Left
          deliberately empty: the region is here so you can see what the navigation navigates. */}
      <SidebarInset className="bg-muted/24">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground text-sm">The board</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
