"use client";

import {
  AccessibilityIcon,
  BellIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  LibraryIcon,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
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
  ShellMain,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityLabel,
  SidebarIdentityText,
  SidebarFooter,
  SidebarIdentityIcon,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@kanzo-tech/ui";
// The one running example the docs speak — a settings page belongs to somebody, and inventing a
// second cast for it would be a second world for a reader to learn.
import { initialsOf, VIEWER } from "@/example/people";
import { HOME_HALL, hall } from "@/example/world";

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
 * around them. What is deliberately NOT copied is their theme pairing — see the cards themselves
 * for what ours can do that a drawn tile cannot.
 */
/** The product's own places. A settings screen is somewhere you go, not somewhere you live. */
const PLACES = [
  { icon: LayoutDashboardIcon, label: "Ledger" },
  { icon: UsersIcon, label: "Roster" },
  { active: true, icon: SettingsIcon, label: "Settings" },
] as const;

/**
 * The settings menu — page content, never shell chrome.
 *
 * This is the distinction the first draft got wrong: it built the app's rail and called it a
 * settings sub-sidebar. GitHub's is a column of the page, under the global header, beside the pane
 * it drives. Made of `ItemGroup` / `Item`, which is the vocabulary for exactly this — a compact
 * list of rows with a media slot and a title — rather than the sidebar parts, which carry a rail's
 * context and a rail's collapse behaviour.
 */
const SETTINGS = [
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
      {/* The product's own rail, and it is a real one — this page is a screen INSIDE an app, not a
          standalone settings site. GitHub's settings live under the global header with the account
          nav beside the pane, which is two navigations doing different jobs: the app's, and the
          page's. Collapsing this one is what gives the settings menu room without taking the
          product away. */}
      <Sidebar collapsible="icon">
        {/* The workspace this rail belongs to. */}
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
          <SidebarGroup>
            <SidebarMenu>
              {PLACES.map((place) => (
                <SidebarMenuItem key={place.label}>
                  {/* Nothing navigates: this arrangement is about where the sections live, and a
                      router would be a second thing to read in a file that demonstrates one. */}
                  <SidebarMenuButton isActive={"active" in place && place.active}>
                    <place.icon />
                    <span>{place.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* And who is signed in. A rail without it is half a rail — every other shell in this
            repository carries the person at the foot, and a settings screen is the one place a
            reader most wants to know whose settings these are. */}
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

      <SidebarInset>
        <ShellMain className="overflow-y-auto bg-background">
          <SectionRoot className="mx-auto w-full max-w-5xl px-6 py-8">
            <div className="grid gap-8 py-6 md:grid-cols-[13rem_1fr]">
              {/* The settings menu: page content, beside the pane it drives, exactly where GitHub
                  puts it. `ItemGroup`/`Item` and not the sidebar parts — those carry a rail's
                  context and a rail's collapse behaviour, and this is a list of rows. */}
              <nav aria-label="Settings" className="flex flex-col gap-6">
                {SETTINGS.map((group) => (
                  <ItemGroup className="gap-0.5" key={group.label}>
                    {/* The same heading the sections opposite wear — small, muted, upper — because
                        both columns are headings of one page. The panel's own spelling is a private
                        constant, so this is written out rather than imported; a host building its
                        own sections gets it for free from `PreferencesField` / `PreferencesFieldSet`
                        instead. */}
                    <span className="mb-1 px-2 font-medium text-[length:var(--kanzo-font-size-small)] text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                    {group.items.map((entry) => {
                      const active = "active" in entry && entry.active;
                      return (
                        // A pressable row is a BUTTON INSIDE the item, never the item merged with
                        // one: `item.tsx` says so, and gives the reason — `asChild` would land
                        // `role="listitem"` on the button and silently stop it being announced as a
                        // control. `p-0` on the item plus the padding on the button keeps the whole
                        // row as the target. It was a `cursor-pointer` div, which meant the settings
                        // menu could not be reached by keyboard at all.
                        <Item className="p-0" key={entry.label}>
                          <Button
                            aria-current={active ? "page" : undefined}
                            className="h-auto w-full justify-start gap-2 px-2 py-1.5 font-normal"
                            variant={active ? "secondary" : "ghost"}
                          >
                            <ItemMedia>
                              <entry.icon className="size-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>{entry.label}</ItemTitle>
                            </ItemContent>
                          </Button>
                        </Item>
                      );
                    })}
                  </ItemGroup>
                ))}
              </nav>

              <div className="flex min-w-0 flex-col gap-8">
                {/* The heading sits in the CONTENT column, not spanning the menu beside it: a title
                    that starts at the page's left edge belongs to the page, and this one belongs to
                    the pane the menu is pointing at. */}
                <SectionHeader scale="page">
                  <SectionTitleGroup>
                    <SectionTitle level={1} scale="page">
                      Appearance
                    </SectionTitle>
                    <SectionDescription>
                      Choose how this product looks to you. Selections apply immediately and are
                      saved to this browser — every control here is the same component the floating
                      panel renders.
                    </SectionDescription>
                  </SectionTitleGroup>
                </SectionHeader>

                {/* No rule between the sections. Every heading here is now one spelling, and a
                    heading is what separates them — a line drawn between two of the six said the
                    colour section was a different KIND of thing, which is the claim this page
                    exists to deny. */}
                <PreferencesColor />
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
            </div>
          </SectionRoot>
        </ShellMain>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default SettingsShowcase;
