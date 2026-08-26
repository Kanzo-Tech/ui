"use client";

import { Fragment, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Float,
  isActivePath,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Preferences,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Separator,
  ShellFooter,
  ShellHeader,
  ShellMain,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Show,
  Status,
  StatTile,
  Steps,
  StepsDescription,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourProgressText,
  type TourStepType,
  TourTitle,
  TourTrigger,
  toast,
  useSidebar,
} from "@kanzo-tech/ui";

import {
  ArchiveIcon,
  BellIcon,
  CalendarClockIcon,
  CheckIcon,
  LandmarkIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CompassIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { CommandPalette } from "./command-palette";
import {
  ACTIVE_PATH,
  ACTIVITY,
  INSTANCES,
  KPIS,
  NAV,
  STANDING,
  SETUP,
  SUPPORT,
  USER,
  type SidebarNavItem,
} from "./data";
import { BoardTable } from "./board-table";

const TOUR_STEPS: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome to Kanzo",
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

/** One `<nav>` landmark per heading, which is what a labelled group of links is. */
const NAV_GROUPS: { label: string; items: SidebarNavItem[] }[] = [
  { label: "Platform", items: NAV },
  { label: "Support", items: SUPPORT },
];

/**
 * First letter of each of the first two words, uppercased — "Ángel Iglesias" → "ÁI".
 *
 * The one piece of the old `SidebarUser` that was logic rather than markup, and it is per-product
 * policy: a name is not always two words, and not every alphabet initialises the same way.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The screen a product opens on: a collapsing rail, a header, a KPI row, one actionable table
 * and a rail of supporting cards.
 *
 * The layout follows the canonical shadcn model — `SidebarProvider` is the
 * viewport frame, and the header and footer live INSIDE `SidebarInset`, to the inline end of the
 * fixed rail, never spanning it. `ShellMain` owns the page's single `<main>`; everything nested
 * under it is a `<section>`.
 *
 * Every arrangement here is written out from parts — the workspace switcher, the nav column, the
 * user footer, the breadcrumb trail, the empty state, the "coming soon" gate. That is the point
 * of the file: the library ships a vocabulary, and an arrangement is a showcase.
 */
export function AppShellShowcase() {
  return (
    <Tour steps={TOUR_STEPS}>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
        {/* The shell is its own component because the rail's switcher, nav and footer all read
            `useSidebar()`, and that context is only readable BELOW the provider. */}
        <Shell />
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

      {/* The library's own live-theming drawer, raised clear of the footer. */}
      <Preferences hotkey="p" triggerClassName="bottom-12" />
    </Tour>
  );
}

function Shell() {
  const [instance, setInstance] = useState("kanzo");
  const { isMobile, setOpenMobile, state } = useSidebar();

  const active = INSTANCES.find((entry) => entry.id === instance) ?? INSTANCES[0];
  const collapsed = state === "collapsed" && !isMobile;
  // Below `md` the rail is a drawer over the page, so a link that navigated behind it would leave
  // the drawer covering the destination. Closing on select is per-app policy, not a library rule.
  const closeMobile = () => setOpenMobile(false);

  return (
    <>
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
                  {/* `MenuGroup` is what associates the heading with the entries below it. */}
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
          {NAV_GROUPS.map((group) => (
            <nav aria-label={group.label} key={group.label}>
              <SidebarGroup>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const subs = item.items;

                    return subs ? (
                      <SidebarMenuItem key={item.title}>
                        {/* The group opens when one of its children is the current route: a closed
                            group hides the very row the active state exists to show. */}
                        <Collapsible
                          defaultOpen={subs.some((sub) => isActivePath(ACTIVE_PATH, sub.href))}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              className="[&[data-state=open]>svg:last-child]:rotate-90"
                              tooltip={item.title}
                            >
                              {item.icon}
                              <span className="truncate">{item.title}</span>
                              <ChevronRightIcon className="ms-auto shrink-0 transition-transform duration-200 motion-reduce:transition-none" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {subs.map((sub) => (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isActivePath(ACTIVE_PATH, sub.href)}
                                  >
                                    <a href={sub.href} onClick={closeMobile}>
                                      <span className="truncate">{sub.title}</span>
                                    </a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuItem>
                    ) : (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActivePath(ACTIVE_PATH, item.href)}
                          tooltip={item.title}
                        >
                          {/* `asChild` is the routing seam: a framework's own `Link` goes here, and
                              it reaches every part rather than the one a prop was wired to. */}
                          <a href={item.href} onClick={closeMobile}>
                            {item.icon}
                            <span className="truncate">{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </nav>
          ))}
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
                        <AvatarFallback>{initials(USER.name)}</AvatarFallback>
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
                        <AvatarFallback>{initials(USER.name)}</AvatarFallback>
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

      <SidebarInset>
        <ShellHeader className="h-12 flex-row items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator className="h-4" orientation="vertical" />

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  {/* Same routing seam as the nav: `asChild`, and a router link drops in. */}
                  <a href="#/app">Kanzo</a>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {/* A separator is a SIBLING of the item, never a child: both render an `li`, and an
                  `li` inside an `li` breaks the row count a screen reader announces. */}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Menu>
                  <MenuTrigger asChild>
                    {/* The accessible name sits on the BUTTON: `BreadcrumbEllipsis` is
                        `aria-hidden` decoration, and decoration cannot name its own control. */}
                    <Button
                      aria-label="Show the rest of the trail"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <BreadcrumbEllipsis />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem asChild value="workspaces">
                      <a href="#/app/workspaces">Workspaces</a>
                    </MenuItem>
                    <MenuItem asChild value="pipelines">
                      <a href="#/app/pipelines">Pipelines</a>
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {/* The leaf is `BreadcrumbPage`, which carries `aria-current="page"`. */}
                <BreadcrumbPage>Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ms-auto flex items-center gap-1.5">
            <CommandPalette />
            {/* The canonical Float use: the wrapper is the positioned ancestor, Float pins
                the count to its corner. */}
            <div className="relative">
              <Button
                aria-label="Notifications"
                onClick={() => toast.create({ title: "3 new notifications", type: "info" })}
                size="icon-sm"
                variant="ghost"
              >
                <BellIcon />
              </Button>
              <Float className="-end-0.5 -top-0.5" placement="top-end">
                <Badge className="rounded-full" size="xs" variant="destructive">
                  3
                </Badge>
              </Float>
            </div>
            {/* Appearance lives in Preferences, as a side card under Colour — the FAB bottom-end
                opens it. A toggle here would be the same preference twice. */}
          </div>
        </ShellHeader>

        <ShellMain className="bg-background">
          <SectionRoot>
            <SectionHeader scale="page">
              <SectionTitleGroup>
                <SectionTitle level={1} scale="page">
                  Overview
                </SectionTitle>
                <SectionDescription>
                  Everything this workspace ran in the last seven days.
                </SectionDescription>
              </SectionTitleGroup>
              <SectionActions>
                <TourTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <CompassIcon />
                    Take the tour
                  </Button>
                </TourTrigger>
                <Button size="sm">
                  <PlusIcon />
                  New pipeline
                </Button>
              </SectionActions>
            </SectionHeader>

            <SectionBody scale="page">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" id="tour-kpis">
                {KPIS.map((kpi) => (
                  <StatTile key={kpi.label} {...kpi} />
                ))}
              </div>

              <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="min-w-0 space-y-3">
                  <SectionHeader>
                    <SectionTitleGroup>
                      <SectionTitle level={2}>Pipeline runs</SectionTitle>
                      <SectionDescription>
                        Every execution across both environments.
                      </SectionDescription>
                    </SectionTitleGroup>
                    <SectionActions>
                      <Button size="sm" variant="outline">
                        View all
                      </Button>
                    </SectionActions>
                  </SectionHeader>

                  <Tabs defaultValue="active">
                    <TabsList>
                      <TabsTrigger value="active">Active</TabsTrigger>
                      <TabsTrigger value="archived">Archived</TabsTrigger>
                    </TabsList>

                    <TabsContent value="active">
                      <BoardTable />
                    </TabsContent>

                    <TabsContent value="archived">
                      <div className="rounded-lg border border-border">
                        {/* An empty state is one `Item` turned on its side: the media over the
                            text instead of beside it, centred, and capped so the sentence stays
                            readable. */}
                        <Item className="mx-auto max-w-[420px] flex-col gap-2 py-8 text-center">
                          {/* `ItemMedia` self-aligns to the start whenever the row has a
                              description — right for a row, wrong once the row is a column, and
                              the override has to carry the same variant to win the cascade. */}
                          <ItemMedia
                            className="group-has-data-[slot=item-description]/item:self-center text-muted-foreground [&_svg:not([class*='size-'])]:size-8"
                            variant="icon"
                          >
                            <ArchiveIcon />
                          </ItemMedia>
                          <ItemTitle className="text-base">Nothing archived yet</ItemTitle>
                          <ItemDescription>
                            Runs you archive are kept for 90 days and stay searchable from here.
                          </ItemDescription>
                          <ItemActions>
                            <Button size="sm" variant="outline">
                              Browse runs
                            </Button>
                          </ItemActions>
                        </Item>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* A status badge pinned to a whole region: `Float` over a positioned wrapper,
                      plus a `Badge`. The card is gated as well as labelled — `inert` (not
                      `aria-hidden`) leaves it readable to a screen reader while making every
                      control in it unreachable, and the dimming says the same thing visually.
                      Space it with MARGIN: padding would move the card and leave the badge
                      behind, overlapping the row above. */}
                  <div className="relative mt-6">
                    <div className="pointer-events-none opacity-50" inert>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Scheduled runs</CardTitle>
                          <CardDescription>Cadences you will set per pipeline.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-3">
                          <ItemGroup className="gap-0">
                            {STANDING.map((schedule, index) => (
                              <Fragment key={schedule.id}>
                                <Show when={index > 0}>
                                  <ItemSeparator className="my-0" />
                                </Show>
                                <Item>
                                  <ItemMedia>
                                    <CalendarClockIcon />
                                  </ItemMedia>
                                  <ItemContent>
                                    {/* A user names their own schedules, so clamp. */}
                                    <ItemTitle className="line-clamp-1">{schedule.name}</ItemTitle>
                                    <ItemDescription>
                                      {schedule.cadence} ·{" "}
                                      <code className="font-mono text-xs">{schedule.tag}</code>
                                    </ItemDescription>
                                  </ItemContent>
                                  <ItemActions>
                                    <Switch defaultChecked={index === 0} />
                                  </ItemActions>
                                </Item>
                              </Fragment>
                            ))}
                          </ItemGroup>
                        </CardContent>
                      </Card>
                    </div>

                    <Float className="-end-2 -top-2" placement="top-end">
                      <Badge size="xs">Coming soon</Badge>
                    </Float>
                  </div>
                </section>

                <div className="min-w-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Finish setting up</CardTitle>
                      <CardDescription>Two steps left before the first schedule.</CardDescription>
                      <CardAction>
                        <Badge size="sm" variant="secondary">
                          2/4
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <Steps count={SETUP.length} defaultStep={2} orientation="vertical">
                        <StepsList>
                          {SETUP.map((step, index) => (
                            <StepsItem
                              className="[&:not(:last-child)]:min-h-16"
                              index={index}
                              key={step.title}
                            >
                              <StepsTrigger>
                                <StepsIndicator>{index + 1}</StepsIndicator>
                                <span className="flex flex-col items-start gap-0.5">
                                  <StepsTitle>{step.title}</StepsTitle>
                                  <StepsDescription>{step.description}</StepsDescription>
                                </span>
                              </StepsTrigger>
                              <StepsSeparator />
                            </StepsItem>
                          ))}
                        </StepsList>
                      </Steps>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent activity</CardTitle>
                      <CardAction>
                        <Button size="sm" variant="ghost">
                          View all
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="px-3">
                      <ItemGroup className="gap-0">
                        {ACTIVITY.map((entry) => (
                          <Item key={entry.id}>
                            <ItemMedia>
                              <Avatar>
                                <AvatarFallback>{initials(entry.who)}</AvatarFallback>
                              </Avatar>
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="line-clamp-1">{entry.who}</ItemTitle>
                              <ItemDescription>
                                {entry.action}{" "}
                                <span className="font-medium text-foreground">{entry.target}</span>
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <span className="whitespace-nowrap text-muted-foreground text-xs">
                                {entry.when}
                              </span>
                            </ItemActions>
                          </Item>
                        ))}
                      </ItemGroup>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </SectionBody>
          </SectionRoot>
        </ShellMain>

        <ShellFooter className="h-9 flex-row items-center gap-2 px-3 text-muted-foreground text-xs">
          <Status size="sm" variant="success" />
          All systems operational
          <span className="ms-auto tabular-nums">v2.4.0</span>
        </ShellFooter>
      </SidebarInset>
    </>
  );
}

export default AppShellShowcase;
