"use client";

import {
  AccessibilityIcon,
  BellIcon,
  KeyRoundIcon,
  PaletteIcon,
  UserIcon,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  PreferencesColor,
  PreferencesDensity,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesRadius,
  PreferencesSections,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Separator,
  ShellMain,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityLabel,
  SidebarIdentityText,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@kanzo-tech/ui";
// The one running example the docs speak — a settings page belongs to somebody, and inventing a
// second cast for it would be a second world for a reader to learn.
import { initialsOf, VIEWER } from "@/example/people";

/**
 * The same preference sections, as a PAGE.
 *
 * This showcase exists to demonstrate one claim and it is the claim the whole section mechanism
 * rests on: **a section is independent of the surface that hosts it.** Every control below is the
 * identical export the floating drawer renders — `PreferencesColor`, `PreferencesDensity`,
 * `PreferencesRadius`, the fonts, and whatever the packages a host installed contribute. Nothing
 * here is a settings-page variant of anything, and if it ever needs to be, the mechanism has failed.
 *
 * A product picks the surface rather than the components: `metadata-form` is light and wants the
 * drawer; a product with a real settings area wants this. Both are one registry and one resolution.
 *
 * **Why the colour section lays itself out and this page does not tell it to.** `PreferencesColor`
 * draws its two side cards under a container query, so it is one column inside a 384px drawer and
 * two here — the question it asks is how much room *it* was given, never how big the window is. A
 * page that passed a layout prop down would be the surface deciding for the section again.
 *
 * The reference is GitHub's Appearance page, down to the sub-sidebar: grouped nav on the inline
 * start, one scrolling pane, the appearance controls first and the rest of the account's settings
 * around them. What is deliberately NOT copied is their theme pairing — see
 * `decisions/a-palette-is-chosen-per-appearance.md`, and the cards themselves for what ours can do
 * that a drawn tile cannot.
 */
const NAV = [
  {
    label: "Personal",
    items: [
      { icon: UserIcon, label: "Profile" },
      { icon: KeyRoundIcon, label: "Account" },
    ],
  },
  {
    label: "Preferences",
    items: [
      { active: true, icon: PaletteIcon, label: "Appearance" },
      { icon: AccessibilityIcon, label: "Accessibility" },
      { icon: BellIcon, label: "Notifications" },
    ],
  },
] as const;

export function SettingsShowcase() {
  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
      {/* `collapsible="none"`: a settings sub-sidebar is the page's table of contents, not a rail
          you fold away to get room. GitHub's does not collapse either. */}
      <Sidebar collapsible="none">
        {/* Whose settings these are. GitHub's page opens with the account, and it is not decoration:
            a settings area is one of the few screens where "for which identity" is the first
            question a reader has. `SidebarIdentity` is the composite that answers it. */}
        <SidebarHeader>
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
                  <SidebarIdentityDescription>Personal settings</SidebarIdentityDescription>
                </SidebarIdentityText>
              </SidebarIdentity>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {/* Nothing navigates: this arrangement is about where the sections live, and a
                        router would be a second thing to read in a file that demonstrates one. */}
                    <SidebarMenuButton isActive={"active" in item && item.active}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <ShellMain className="overflow-y-auto bg-background">
          <SectionRoot className="mx-auto w-full max-w-3xl px-6 py-8">
            <SectionHeader scale="page">
              <SectionTitleGroup>
                <SectionTitle level={1} scale="page">
                  Appearance
                </SectionTitle>
                <SectionDescription>
                  Choose how this product looks to you. Selections apply immediately and are saved to
                  this browser — every control on this page is the same component the floating panel
                  renders.
                </SectionDescription>
              </SectionTitleGroup>
            </SectionHeader>

            <div className="flex flex-col gap-8 py-6">
              <PreferencesColor />
              <Separator />
              <div className="grid gap-6 @container md:grid-cols-2">
                <PreferencesDensity />
                <PreferencesRadius />
                <PreferencesFont />
                <PreferencesMonoFont />
              </div>
              {/* Whatever the packages this host installed contribute. It draws nothing until one
                  registers a manifest, which is why a product that installs no optional package
                  sees exactly the sections above and no empty space where a group would be. */}
              <PreferencesSections />
            </div>
          </SectionRoot>
        </ShellMain>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default SettingsShowcase;
