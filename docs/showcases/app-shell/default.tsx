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
import { CommandPalette } from "./command-palette";
import { ACTIVITY, INSTANCES, KPIS, NAV, SCHEDULES, SETUP, SUPPORT, USER } from "./data";
import { RunsTable } from "./runs-table";

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
  const [instance, setInstance] = useState("kanzo");

  return (
    <Tour steps={TOUR_STEPS}>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div id="tour-workspace">
              <InstanceSwitcher
                actions={[
                  {
                    label: "Create workspace",
                    icon: <PlusIcon />,
                    onSelect: () => toast.create({ title: "New workspace", type: "info" }),
                  },
                ]}
                activeId={instance}
                instances={INSTANCES}
                label="Workspaces"
                onSelect={setInstance}
              />
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarNav items={NAV} label="Platform" />
            <SidebarNav items={SUPPORT} label="Support" />
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
            <Breadcrumbs items={[{ label: "Kanzo", href: "#/app" }, { label: "Overview" }]} />

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
                        <RunsTable />
                      </TabsContent>

                      <TabsContent value="archived">
                        <div className="rounded-lg border border-border">
                          <EmptyState
                            action={
                              <Button size="sm" variant="outline">
                                Browse runs
                              </Button>
                            }
                            description="Runs you archive are kept for 90 days and stay searchable from here."
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
                          <CardTitle className="text-base">Scheduled runs</CardTitle>
                          <CardDescription>Cadences you will set per pipeline.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-3">
                          <ItemGroup className="gap-0">
                            {SCHEDULES.map((schedule, index) => (
                              <Fragment key={schedule.id}>
                                <Show when={index > 0}>
                                  <ItemSeparator className="my-0" />
                                </Show>
                                <Item>
                                  <ItemMedia>
                                    <CalendarClockIcon />
                                  </ItemMedia>
                                  <ItemContent>
                                    <ItemTitle>{schedule.name}</ItemTitle>
                                    <ItemDescription>
                                      {schedule.cadence} ·{" "}
                                      <code className="font-mono text-xs">{schedule.cron}</code>
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
                                  <AvatarFallback>{entry.initials}</AvatarFallback>
                                </Avatar>
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{entry.who}</ItemTitle>
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
