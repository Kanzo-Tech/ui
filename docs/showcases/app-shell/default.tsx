"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Breadcrumbs,
  Button,
  ComingSoon,
  EmptyState,
  InstanceSwitcher,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
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
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  toast,
} from "@kanzo-tech/ui";
import { type ColumnDef, DataTable, sortableHeader } from "@kanzo-tech/ui/table";
import {
  BoxesIcon,
  BriefcaseIcon,
  CloudIcon,
  DatabaseIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { type Connection, CONNECTIONS, INSTANCES, NAV, USER } from "./data";

const STATUS_VARIANT = {
  ready: "success",
  syncing: "info",
  failed: "destructive",
} as const;

const numberFmt = new Intl.NumberFormat("en-US");

function connectionColumns(onDelete: (c: Connection) => void): ColumnDef<Connection>[] {
  return [
    {
      accessorKey: "name",
      header: sortableHeader("Name"),
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "rows",
      header: sortableHeader("Rows"),
      // Numeric column: right-aligned, so magnitudes line up when sorted.
      cell: ({ getValue }) => (
        <span className="block text-right font-mono text-muted-foreground text-xs tabular-nums">
          {numberFmt.format(getValue<number>())}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const s = getValue<Connection["status"]>();
        return (
          <Badge size="sm" variant={STATUS_VARIANT[s]}>
            {s}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row.original);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];
}

/**
 * A realistic product screen at full viewport — the shell as a consumer actually assembles
 * it: Sidebar (switcher + nav + user) around a SidebarInset holding a real page.
 */
export function AppShellShowcase() {
  const [instance, setInstance] = useState("kanzo");
  const columns = useMemo(
    () =>
      connectionColumns((c) => toast.create({ title: `Delete ${c.name}?`, type: "warning" })),
    [],
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
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
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav items={NAV} label="Platform" />
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
              // Log out is just another item — the product owns the flow, the copy and any
              // confirmation. The library no longer ships an auth mechanism.
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
        <header className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
          <SidebarTrigger />
          <Breadcrumbs items={[{ label: "Kanzo", href: "#/app" }, { label: "Dashboard" }]} />
        </header>

        <div className="flex-1">
          <SectionRoot>
            <SectionHeader scale="page">
              <SectionTitleGroup>
                <SectionTitle level={1} scale="page">Dashboard</SectionTitle>
                <SectionDescription>
                  Everything this workspace publishes, at a glance.
                </SectionDescription>
              </SectionTitleGroup>
              <SectionActions>
                <Button size="sm">
                  <PlusIcon />
                  New connection
                </Button>
              </SectionActions>
            </SectionHeader>

            <SectionBody scale="page">
              <div className="space-y-8">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard href="#/app/settings/cloud" status="success">
                    <MetricCardHeader>
                      <MetricCardIcon>
                        <CloudIcon />
                      </MetricCardIcon>
                      <MetricCardLabel>Cloud Accounts</MetricCardLabel>
                    </MetricCardHeader>
                    <MetricCardValue>3</MetricCardValue>
                    <MetricCardDescription>accounts configured</MetricCardDescription>
                  </MetricCard>
                  <MetricCard href="#/app/connections" status="success">
                    <MetricCardHeader>
                      <MetricCardIcon>
                        <DatabaseIcon />
                      </MetricCardIcon>
                      <MetricCardLabel>Connections</MetricCardLabel>
                    </MetricCardHeader>
                    <MetricCardValue>4</MetricCardValue>
                    <MetricCardDescription>connections configured</MetricCardDescription>
                  </MetricCard>
                  <MetricCard href="#/app/jobs" status="danger">
                    <MetricCardHeader>
                      <MetricCardIcon>
                        <BriefcaseIcon />
                      </MetricCardIcon>
                      <MetricCardLabel>Jobs</MetricCardLabel>
                    </MetricCardHeader>
                    <MetricCardValue>12</MetricCardValue>
                    <MetricCardDescription>last run failed</MetricCardDescription>
                  </MetricCard>
                  <MetricCard href="#/app/catalog">
                    <MetricCardHeader>
                      <MetricCardIcon>
                        <BoxesIcon />
                      </MetricCardIcon>
                      <MetricCardLabel>DCAT Catalogs</MetricCardLabel>
                    </MetricCardHeader>
                    <MetricCardValue>7</MetricCardValue>
                    <MetricCardDescription>catalogs generated</MetricCardDescription>
                  </MetricCard>
                </div>

                <section className="space-y-3">
                  <SectionHeader scale="page">
                    <SectionTitleGroup>
                      <SectionTitle level={1} scale="page">Connections</SectionTitle>
                      <SectionDescription>
                        Sources this workspace reads from.
                      </SectionDescription>
                    </SectionTitleGroup>
                    <SectionActions>
                      <Button size="sm" variant="outline">
                        View all
                      </Button>
                    </SectionActions>
                  </SectionHeader>

                  <Tabs defaultValue="data">
                    <TabsList>
                      <TabsTrigger value="data">Data</TabsTrigger>
                      <TabsTrigger value="vocab">Vocabularies</TabsTrigger>
                    </TabsList>

                    <TabsContent value="data">
                      <DataTable
                        columns={columns}
                        data={CONNECTIONS}
                        onRowClick={(c) => toast.create({ title: c.name, type: "info" })}
                        pageSize={6}
                        searchKey="name"
                        searchPlaceholder="Search connections…"
                        toolbarActions={
                          <Button size="sm">
                            <PlusIcon />
                            New connection
                          </Button>
                        }
                      />
                    </TabsContent>

                    <TabsContent value="vocab">
                      <div className="rounded-lg border border-border">
                        <EmptyState
                          action={
                            <Button size="sm" variant="outline">
                              <PlusIcon />
                              Add vocabulary
                            </Button>
                          }
                          description="Vocabulary connections resolve the terms your mappings reference."
                          icon={<BoxesIcon />}
                          title="No vocabulary connections"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </section>

                <section className="space-y-3">
                  <SectionHeader scale="page">
                    <SectionTitleGroup>
                      <SectionTitle level={1} scale="page">Scheduled runs</SectionTitle>
                      <SectionDescription>
                        Not available yet in this workspace.
                      </SectionDescription>
                    </SectionTitleGroup>
                  </SectionHeader>
                  <ComingSoon>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-sm">Run on a schedule</p>
                        <p className="text-muted-foreground text-xs">
                          Trigger this workspace&apos;s jobs on a cron expression.
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Configure
                      </Button>
                    </div>
                  </ComingSoon>
                </section>
              </div>
            </SectionBody>
          </SectionRoot>
        </div>
      </SidebarInset>

      <Toaster />
    </SidebarProvider>
  );
}

export default AppShellShowcase;
