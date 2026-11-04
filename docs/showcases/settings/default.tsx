"use client";

import {
  AccessibilityIcon,
  BellIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  PaletteIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  PreferencesField,
  PreferencesPanel,
  PreferencesRoot,
  PreferencesSections,
  PreferencesTrigger,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  SegmentGroup,
  Separator,
  ShellHeader,
  ShellMain,
  Show,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@kanzo-tech/ui";
import { useState } from "react";
// The one running example the docs speak — a settings page belongs to somebody, and inventing a
// second cast for it would be a second world for a reader to learn.
import { initialsOf, VIEWER } from "@/example/people";
import { HOME_HALL, hall } from "@/example/world";

/**
 * The same preference sections on both surfaces: the page, and the drawer its trigger opens.
 *
 * One claim, and it is the claim the whole section mechanism rests on: **a section is independent
 * of the surface that hosts it.** The pane and the drawer both render `PreferencesSections`: the
 * theme, density, and whatever the packages a host installed contribute. Nothing here is a
 * settings-page variant of anything, and if it ever needs to be, the mechanism has failed.
 *
 * One level of navigation: the settings sections are sub-items of Settings in the app's own rail,
 * so the pane follows the rail directly. The pane keeps a reading width, left-aligned under the
 * header, and the theme picker lays its cards out on an auto-fill grid inside whatever it is given.
 */
const PLACES = [
  { icon: LayoutDashboardIcon, label: "Ledger" },
  { icon: UsersIcon, label: "Roster" },
] as const;

const SECTIONS = [
  { icon: UserIcon, label: "Profile" },
  { icon: KeyRoundIcon, label: "Account" },
  { active: true, icon: PaletteIcon, label: "Appearance" },
  { icon: AccessibilityIcon, label: "Accessibility" },
  { icon: BellIcon, label: "Notifications" },
] as const;

type Placement = "left" | "right";

function Rail({ placement }: { placement: Placement }) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  // Collapsed to icons the sub-items are hidden, so the parent carries the active mark instead.
  const collapsed = state === "collapsed" && !isMobile;
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" placement={placement}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarIdentity>
              <SidebarIdentityIcon>
                <LibraryIcon className="size-4" />
              </SidebarIdentityIcon>
              <SidebarIdentityText>
                <SidebarIdentityLabel>{hall(HOME_HALL).name}</SidebarIdentityLabel>
                <SidebarIdentityDescription>Chartered</SidebarIdentityDescription>
              </SidebarIdentityText>
            </SidebarIdentity>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Nothing navigates: a router would be a second thing to read in a file about where the
            sections live. */}
        <nav aria-label="Platform">
          <SidebarGroup>
            <SidebarMenu>
              {PLACES.map((place) => (
                <SidebarMenuItem key={place.label}>
                  <SidebarMenuButton tooltip={place.label}>
                    <place.icon />
                    <span>{place.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton isActive={collapsed} tooltip="Settings">
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
                <SidebarMenuSub aria-label="Settings">
                  {SECTIONS.map((section) => {
                    const active = "active" in section && section.active;
                    return (
                      <SidebarMenuSubItem key={section.label}>
                        <SidebarMenuSubButton
                          aria-current={active ? "page" : undefined}
                          href={`#${section.label.toLowerCase()}`}
                          isActive={active}
                          onClick={closeMobile}
                        >
                          <section.icon />
                          <span>{section.label}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarIdentity>
              <SidebarIdentityAvatar>
                <Avatar>
                  <AvatarFallback>{initialsOf(VIEWER.name)}</AvatarFallback>
                </Avatar>
              </SidebarIdentityAvatar>
              <SidebarIdentityText>
                <SidebarIdentityLabel>{VIEWER.name}</SidebarIdentityLabel>
                <SidebarIdentityDescription>{VIEWER.email}</SidebarIdentityDescription>
              </SidebarIdentityText>
            </SidebarIdentity>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function SettingsShowcase() {
  const [placement, setPlacement] = useState<Placement>("left");
  const rail = <Rail placement={placement} />;

  // The rail's gap is in flow, so a rail on the right comes after the inset in the tree.
  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden" hotkey="mod+b">
      <Show when={placement === "left"}>{rail}</Show>

      <SidebarInset className="overflow-hidden">
        <ShellHeader className="h-12 min-w-0 flex-row items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator className="h-4" orientation="vertical" />
          <Breadcrumb>
            <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
              <BreadcrumbItem>
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">Appearance</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </ShellHeader>

        <ShellMain className="overflow-y-auto bg-background">
          <SectionRoot className="w-full max-w-4xl" fill={false}>
            <SectionHeader scale="page">
              <SectionTitleGroup>
                <SectionTitle level={1} scale="page">
                  Appearance
                </SectionTitle>
                <SectionDescription>
                  Choose how this product looks to you. Selections apply immediately and are saved
                  to this browser — every control here is the same component the floating panel
                  renders.
                </SectionDescription>
              </SectionTitleGroup>
            </SectionHeader>
            <SectionBody scale="page">
              <PreferencesSections />
            </SectionBody>
          </SectionRoot>
        </ShellMain>
      </SidebarInset>
      <Show when={placement === "right"}>{rail}</Show>

      {/* Closed on arrival: the page is the screen. Its trigger opens the same sections,
          non-modal, beside the pane. */}
      <PreferencesRoot hotkey="p">
        <PreferencesTrigger />
        <PreferencesPanel>
          <PreferencesField label="Sidebar side">
            <SegmentGroup
              aria-label="Sidebar side"
              className="w-full"
              itemClassName="px-2 py-1"
              onValueChange={(d) => d.value && setPlacement(d.value as Placement)}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
              value={placement}
              variant="solid"
            />
          </PreferencesField>
          <PreferencesSections />
        </PreferencesPanel>
      </PreferencesRoot>
    </SidebarProvider>
  );
}

export default SettingsShowcase;
