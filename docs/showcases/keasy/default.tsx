"use client";

import { type ComponentType, useState, useSyncExternalStore } from "react";
import {
  AvatarFallback,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PreferencesPanel,
  PreferencesRoot,
  PreferencesSections,
  PreferencesTrigger,
  Show,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
  SidebarProvider,
  SidebarRail,
  Toaster,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourProgressText,
  type TourStepType,
  TourTitle,
  toast,
  useSidebar,
} from "@kanzo-tech/ui";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LandmarkIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { initialsOf } from "@/example/people";
import { Dashboard } from "./dashboard";
import { INSTANCES, NAV, ROUTES, USER } from "./data";
import { Discover } from "./discover";

const TOUR_STEPS: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome to keasy",
    description: "Four stops around the screen you land on every morning.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "workspace",
    type: "tooltip",
    target: () => document.getElementById("tour-workspace"),
    title: "Your workspaces",
    description: "Switch tenant here. ⌘B collapses the whole rail to icons.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "kpis",
    type: "tooltip",
    target: () => document.getElementById("tour-kpis"),
    title: "The week in four numbers",
    description: "Each tile carries its own trend and a delta against last week.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "runs",
    type: "tooltip",
    target: () => document.getElementById("tour-runs-toolbar"),
    title: "Work the queue",
    description: "Search, facet by status or environment, hide columns, then select rows to act on them.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Done", action: "dismiss" },
    ],
  },
];

/** The screen each route draws inside the frame. A path nothing names opens the dashboard. */
const SCREENS: Record<string, ComponentType> = {
  [ROUTES.dashboard]: Dashboard,
  [ROUTES.discover]: Discover,
};

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The route is the hash, so a link — in the rail, a trail or a screen — is all navigation needs. */
function usePath() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash || ROUTES.dashboard,
    () => ROUTES.dashboard,
  );
}

/**
 * keasy, the product: a collapsing rail with Dashboard and Discover. Discover is the archive graph
 * read back, full screen with no rail; its trail is the way back.
 *
 * `SidebarProvider` is the viewport frame, and every screen draws its header INSIDE
 * `SidebarInset`. Each screen owns the page's one `<main>`.
 */
export function KeasyShowcase() {
  const path = usePath();
  const Screen = SCREENS[path] ?? Dashboard;

  return (
    <Tour steps={TOUR_STEPS}>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden" hotkey="mod+b">
        {/* The rail is its own component because its switcher, nav and footer all read
            `useSidebar()`, and that context is only readable BELOW the provider. */}
        <Show when={path !== ROUTES.discover}>
          <Rail path={path} />
        </Show>
        <SidebarInset className="overflow-hidden">
          <Screen />
        </SidebarInset>
        <Toaster />
      </SidebarProvider>

      <TourContent>
        <TourHeader className="pb-0">
          <TourTitle />
          <TourDescription />
        </TourHeader>
        <TourProgressText className="px-(--space)" />
        <TourActions />
      </TourContent>

      {/* App-wide preferences only: the graph's looks live in Discover's dock, beside the canvas
          they change. */}
      <PreferencesRoot hotkey="p">
        {/* Raised clear of the status strip Discover closes with. */}
        <PreferencesTrigger className="bottom-12" />
        <PreferencesPanel>
          <PreferencesSections namespace="theme" />
        </PreferencesPanel>
      </PreferencesRoot>
    </Tour>
  );
}

function Rail({ path }: { path: string }) {
  const [instance, setInstance] = useState("kanzo");
  const { isMobile, setOpenMobile, state } = useSidebar();

  const active = INSTANCES.find((entry) => entry.id === instance) ?? INSTANCES[0];
  const collapsed = state === "collapsed" && !isMobile;
  // Below `md` the rail is a drawer over the page, so a link that navigated behind it would leave
  // the drawer covering the destination. Closing on select is per-app policy, not a library rule.
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu id="tour-workspace">
          <SidebarMenuItem>
            {/* Anchored beside the rail on desktop, below the trigger on mobile, with the 4px
                gutter Shark's sidebar block uses (Ark defaults to 8). */}
            <Menu positioning={{ placement: isMobile ? "bottom-start" : "right-start", gutter: 4 }}>
              <MenuTrigger asChild>
                {/* `aria-label`, not `tooltip`: `MenuTrigger asChild` claims the single button
                    node, so a nested tooltip trigger never binds. The label is what names the
                    row once the rail collapses to icons. */}
                <SidebarMenuButton
                  aria-label={active.label}
                  className="group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  size="lg"
                >
                  <SidebarIdentity collapsed={collapsed} responsive>
                    <SidebarIdentityIcon>
                      <LandmarkIcon />
                    </SidebarIdentityIcon>
                    <SidebarIdentityText>
                      <SidebarIdentityLabel>{active.label}</SidebarIdentityLabel>
                      <SidebarIdentityDescription>{active.description}</SidebarIdentityDescription>
                    </SidebarIdentityText>
                  </SidebarIdentity>
                  <ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </MenuTrigger>

              {/* `--reference-width` is the trigger's width, exposed by Ark on the positioner, so
                  the menu reads as anchored to the button instead of floating beside the rail. */}
              <MenuContent className="w-(--reference-width) min-w-60">
                <MenuGroup heading="Workspaces">
                  {INSTANCES.map((entry) => (
                    <MenuItem
                      key={entry.id}
                      onClick={() => {
                        setInstance(entry.id);
                        closeMobile();
                      }}
                      value={entry.id}
                    >
                      {/* The same identity block as the trigger, minus `responsive`: this one is
                          portaled to the body and never collapses with the rail. */}
                      <SidebarIdentity>
                        <SidebarIdentityIcon>
                          <LandmarkIcon />
                        </SidebarIdentityIcon>
                        <SidebarIdentityText>
                          <SidebarIdentityLabel>{entry.label}</SidebarIdentityLabel>
                          <SidebarIdentityDescription>{entry.description}</SidebarIdentityDescription>
                        </SidebarIdentityText>
                      </SidebarIdentity>
                      <Show when={entry.id === instance}>
                        <CheckIcon className="ms-auto" />
                      </Show>
                    </MenuItem>
                  ))}
                </MenuGroup>
                <MenuSeparator />
                <MenuItem
                  onClick={() => toast.create({ title: "New workspace", type: "info" })}
                  value="create-workspace"
                >
                  <PlusIcon />
                  Create workspace
                </MenuItem>
              </MenuContent>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* `<nav>` is ours to write: `SidebarGroup` is a `div`, and a titled group is a landmark. */}
        <nav aria-label="Platform">
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={path === item.href}
                    tooltip={item.title}
                  >
                    {/* `asChild` is the routing seam: a framework's own `Link` goes here. */}
                    <a href={item.href} onClick={closeMobile}>
                      {item.icon}
                      <span className="truncate">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Menu positioning={{ placement: isMobile ? "bottom-end" : "right-end", gutter: 4 }}>
              <MenuTrigger asChild>
                {/* Collapsed, the button is a 32px square the avatar fills edge to edge, so round
                    the button too — otherwise its `overflow-hidden` clips the circle square. */}
                <SidebarMenuButton
                  aria-label={USER.name}
                  className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  size="lg"
                >
                  <SidebarIdentity collapsed={collapsed} responsive>
                    <SidebarIdentityAvatar>
                      <AvatarFallback>{initialsOf(USER.name)}</AvatarFallback>
                    </SidebarIdentityAvatar>
                    <SidebarIdentityText>
                      <SidebarIdentityLabel>{USER.name}</SidebarIdentityLabel>
                      <SidebarIdentityDescription>{USER.email}</SidebarIdentityDescription>
                    </SidebarIdentityText>
                  </SidebarIdentity>
                  <ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </MenuTrigger>

              <MenuContent className="w-(--reference-width) min-w-56">
                <div className="px-2 py-1.5">
                  <SidebarIdentity>
                    <SidebarIdentityAvatar>
                      <AvatarFallback>{initialsOf(USER.name)}</AvatarFallback>
                    </SidebarIdentityAvatar>
                    <SidebarIdentityText>
                      <SidebarIdentityLabel>{USER.name}</SidebarIdentityLabel>
                      <SidebarIdentityDescription>{USER.email}</SidebarIdentityDescription>
                    </SidebarIdentityText>
                  </SidebarIdentity>
                </div>
                <MenuSeparator />
                <MenuItem
                  onClick={() => toast.create({ title: "Profile", type: "info" })}
                  value="profile"
                >
                  <UserIcon />
                  Profile
                </MenuItem>
                {/* keasy keeps Settings out of the rail: it is reached from here. */}
                <MenuItem
                  onClick={() => toast.create({ title: "Settings", type: "info" })}
                  value="settings"
                >
                  <SettingsIcon />
                  Settings
                </MenuItem>
                <MenuSeparator />
                {/* Log out is an entry with a destructive tint, not a prop: the product owns the
                    confirmation and the wording. */}
                <MenuItem
                  onClick={() => toast.create({ title: "Logged out", type: "info" })}
                  value="log-out"
                  variant="destructive"
                >
                  <LogOutIcon />
                  Log out
                </MenuItem>
              </MenuContent>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default KeasyShowcase;
