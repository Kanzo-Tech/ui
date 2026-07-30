"use client";

import { Fragment, useState } from "react";
import {
  AppearanceToggle,
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Float,
  InstanceSwitcher,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  MadeWith,
  Preferences,
  Ribbon,
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
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarUser,
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
} from "@kanzo-tech/ui";

import {
  ArchiveIcon,
  BellIcon,
  CalendarClockIcon,
  CompassIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { overdueQuests } from "@/example/quests";
import { hall, type HallId, HOME_HALL } from "@/example/world";
import { CommandPalette } from "./command-palette";
import { ACTIVITY, INSTANCES, KPIS, NAV, SETUP, SETUP_DONE, STANDING, SUPPORT, USER } from "./data";
import { BoardTable } from "./board-table";

/** The header's notice count is the board's overdue contracts, not a decoration. */
const OVERDUE = overdueQuests().length;

const TOUR_STEPS: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome to the hall",
    description: "Four stops around the screen a quartermaster opens every morning.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "halls",
    type: "tooltip",
    target: () => document.getElementById("tour-halls"),
    title: "Your halls",
    description: "Switch hall here. ⌘B collapses the whole rail to icons.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "kpis",
    type: "tooltip",
    target: () => document.getElementById("tour-kpis"),
    title: "The board in four numbers",
    description: "Each tile carries its own trend and a delta against the week before.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "board",
    type: "tooltip",
    target: () => document.getElementById("tour-board-toolbar"),
    title: "Work the board",
    description: "Search, facet by state or region, hide columns, then select rows to act on them.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Done", action: "dismiss" },
    ],
  },
];

/**
 * The screen a product opens on: a collapsing rail, a header, a KPI row, one actionable table
 * and a rail of supporting cards.
 *
 * The layout follows the shadcn model DESIGN.md calls canonical — `SidebarProvider` is the
 * viewport frame, and the header and footer live INSIDE `SidebarInset`, to the inline end of the
 * fixed rail, never spanning it. `ShellMain` owns the page's single `<main>`; everything nested
 * under it is a `<section>`.
 */
export function AppShellShowcase() {
  const [instance, setInstance] = useState<HallId>(HOME_HALL);

  return (
    <Tour steps={TOUR_STEPS}>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div id="tour-halls">
              <InstanceSwitcher
                actions={[
                  {
                    label: "Charter a hall",
                    icon: <PlusIcon />,
                    onSelect: () => toast.create({ title: "New hall", type: "info" }),
                  },
                ]}
                activeId={instance}
                instances={INSTANCES}
                label="Halls"
                onSelect={(id) => setInstance(id as HallId)}
              />
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* The group heading follows the switcher, so changing hall changes the whole rail. */}
            <SidebarNav items={NAV} label={hall(instance).short} />
            <SidebarNav items={SUPPORT} label="Reference" />
          </SidebarContent>

          <SidebarFooter>
            <SidebarUser
              menuItems={[
                {
                  label: "Profile",
                  icon: <UserIcon />,
                  onSelect: () => toast.create({ title: "Profile", type: "info" }),
                },
                {
                  label: "Settings",
                  icon: <SettingsIcon />,
                  onSelect: () => toast.create({ title: "Settings", type: "info" }),
                },
                {
                  label: "Log out",
                  icon: <LogOutIcon />,
                  variant: "destructive",
                  separatorBefore: true,
                  onSelect: () => toast.create({ title: "Logged out", type: "info" }),
                },
              ]}
              user={USER}
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <ShellHeader className="h-12 flex-row items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator className="h-4" orientation="vertical" />
            <Breadcrumbs
              items={[{ label: hall(instance).short, href: "#/board" }, { label: "Overview" }]}
            />

            <div className="ms-auto flex items-center gap-1.5">
              <CommandPalette />
              {/* The canonical Float use: the wrapper is the positioned ancestor, Float pins
                  the count to its corner. */}
              <div className="relative">
                <Button
                  aria-label="Notices"
                  onClick={() =>
                    toast.create({ title: `${OVERDUE} contracts overdue`, type: "warning" })
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <BellIcon />
                </Button>
                <Float className="-end-0.5 -top-0.5" placement="top-end">
                  <Badge className="rounded-full" size="xs" variant="destructive">
                    {OVERDUE}
                  </Badge>
                </Float>
              </div>
              <AppearanceToggle size="icon-sm" />
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
                    Everything on the board today, and everyone the hall can still send.
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
                    Post a contract
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
                        <SectionTitle level={2}>The board</SectionTitle>
                        <SectionDescription>
                          Every contract posted, whichever hall posted it.
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
                        <TabsTrigger value="active">Posted</TabsTrigger>
                        <TabsTrigger value="archived">Archive</TabsTrigger>
                      </TabsList>

                      <TabsContent value="active">
                        <BoardTable />
                      </TabsContent>

                      <TabsContent value="archived">
                        <div className="rounded-lg border border-border">
                          <EmptyState
                            action={
                              <Button size="sm" variant="outline">
                                Browse the board
                              </Button>
                            }
                            description="Contracts you retire stay in the archive for a season, and remain searchable from here."
                            icon={<ArchiveIcon />}
                            title="Nothing archived yet"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Ribbon gates the whole card: dimmed and `inert`, so the feature is
                        visible but unusable. */}
                    <Ribbon className="mt-6" disabled label="Coming soon">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Standing orders</CardTitle>
                          <CardDescription>Patrols the hall will post on a cadence.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-3">
                          <ItemGroup className="gap-0">
                            {STANDING.map((order, index) => (
                              <Fragment key={order.id}>
                                <Show when={index > 0}>
                                  <ItemSeparator className="my-0" />
                                </Show>
                                <Item>
                                  <ItemMedia>
                                    <CalendarClockIcon />
                                  </ItemMedia>
                                  <ItemContent>
                                    {/* A hall names its own patrols, so clamp. */}
                                    <ItemTitle className="line-clamp-1">{order.name}</ItemTitle>
                                    <ItemDescription>
                                      {order.cadence} ·{" "}
                                      <code className="font-mono text-xs">#{order.tag}</code>
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
                    </Ribbon>
                  </section>

                  <div className="min-w-0 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Finish setting up</CardTitle>
                        <CardDescription>
                          Two steps left before the first party leaves.
                        </CardDescription>
                        <CardAction>
                          <Badge size="sm" variant="secondary">
                            {SETUP_DONE}/{SETUP.length}
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <Steps count={SETUP.length} defaultStep={SETUP_DONE} orientation="vertical">
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
                                  <AvatarFallback>{entry.initials}</AvatarFallback>
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
            The board is open
            <span className="ms-auto tabular-nums">Chartered {hall(instance).founded}</span>
            <Separator className="h-3" orientation="vertical" />
            <MadeWith href="#/about" />
          </ShellFooter>
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

      {/* The library's own live-theming drawer, raised clear of the footer. */}
      <Preferences hotkey="t" triggerClassName="bottom-12" />
    </Tour>
  );
}

export default AppShellShowcase;
