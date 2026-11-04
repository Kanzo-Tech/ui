"use client";

import { Fragment } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  EmptyTitle,
  GatedBadge,
  GatedContent,
  GatedRoot,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  ShellMain,
  Show,
  StatDelta,
  StatLabel,
  StatRoot,
  StatTrend,
  StatValue,
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
  TourTrigger,
} from "@kanzo-tech/ui";
import { ArchiveIcon, CalendarClockIcon, CompassIcon, WorkflowIcon } from "lucide-react";
import { BoardTable } from "./board-table";
import { ACTIVITY, KPIS, ROUTES, SETUP, STANDING } from "./data";
import { ScreenHeader } from "./header";

/** The screen keasy opens on: a KPI row, one actionable table and a rail of supporting cards. */
export function Dashboard() {
  return (
    <>
      <ScreenHeader crumbs={[]} />

      <ShellMain className="bg-background">
        <SectionRoot>
          <SectionHeader scale="page">
            <SectionTitleGroup>
              <SectionTitle level={1} scale="page">
                Dashboard
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
              <Button asChild size="sm">
                <a href={ROUTES.discover}>
                  <WorkflowIcon />
                  Discover
                </a>
              </Button>
            </SectionActions>
          </SectionHeader>

          <SectionBody scale="page">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" id="tour-kpis">
              {KPIS.map((kpi) => (
                <StatRoot key={kpi.label}>
                  <StatLabel>{kpi.label}</StatLabel>
                  <StatValue>{kpi.value.toLocaleString("en-US")}</StatValue>
                  <StatTrend values={kpi.trend} />
                  <StatDelta goodWhenUp={kpi.delta.goodWhenUp} value={kpi.delta.value}>
                    {kpi.delta.label}
                  </StatDelta>
                </StatRoot>
              ))}
            </div>

            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SectionRoot fill={false} className="min-w-0 gap-3">
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
                    <EmptyRoot className="border">
                      <EmptyHeader>
                        <EmptyIndicator variant="icon">
                          <ArchiveIcon />
                        </EmptyIndicator>
                        <EmptyTitle asChild>
                          <h3>Nothing archived yet</h3>
                        </EmptyTitle>
                        <EmptyDescription>
                          Runs you archive are kept for 90 days and stay searchable from here.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button size="sm" variant="outline">
                          Browse runs
                        </Button>
                      </EmptyContent>
                    </EmptyRoot>
                  </TabsContent>
                </Tabs>

                {/* `inert` takes the card out of the accessibility tree as well as out of reach,
                    so the group is named here and the badge is the only thing read. The margin
                    leaves room for the badge's overhang; padding would move the card instead. */}
                <GatedRoot aria-label="Scheduled runs" className="mt-6">
                  <GatedContent>
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
                  </GatedContent>
                  <GatedBadge>Coming soon</GatedBadge>
                </GatedRoot>
              </SectionRoot>

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
    </>
  );
}
