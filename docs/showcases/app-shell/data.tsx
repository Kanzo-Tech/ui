import {
  ActivityIcon,
  BookOpenIcon,
  DatabaseIcon,
  HouseIcon,
  LayersIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Instance, SidebarNavItem, StatTileProps } from "@kanzo-tech/ui";

/** One fake tenant's worth of data, so the screen reads as a product rather than a catalogue. */

export const INSTANCES: Instance[] = [
  { id: "kanzo", label: "Kanzo", description: "Owner" },
  { id: "acme", label: "ACME Data", description: "Member" },
  { id: "northwind", label: "Northwind", description: "Member" },
];

export const USER = {
  name: "Ángel Iglesias",
  email: "angel@kanzo.tech",
};

export const NAV: SidebarNavItem[] = [
  { title: "Overview", href: "#/app", icon: <HouseIcon />, isActive: true },
  {
    title: "Data",
    icon: <DatabaseIcon />,
    items: [
      { title: "Connections", href: "#/app/connections" },
      { title: "Datasets", href: "#/app/datasets" },
      { title: "Pipelines", href: "#/app/pipelines" },
    ],
  },
  { title: "Runs", href: "#/app/runs", icon: <ActivityIcon /> },
  { title: "Reports", href: "#/app/reports", icon: <LayersIcon /> },
  { title: "Quality", href: "#/app/quality", icon: <ShieldCheckIcon /> },
  {
    title: "Settings",
    icon: <SettingsIcon />,
    items: [
      { title: "Members", href: "#/app/settings/members" },
      { title: "Integrations", href: "#/app/settings/integrations" },
      { title: "Billing", href: "#/app/settings/billing" },
    ],
  },
];

export const SUPPORT: SidebarNavItem[] = [
  { title: "Documentation", href: "#/docs", icon: <BookOpenIcon /> },
  { title: "Send feedback", href: "#/feedback", icon: <MessageSquareIcon /> },
];

/** Four headline numbers — the dataviz answer to "a handful of KPIs" is a stat-tile row. */
export const KPIS: StatTileProps[] = [
  {
    label: "Rows ingested",
    value: 12_400_000,
    delta: { value: 840_000, label: "vs last week" },
    trend: [8.4, 9.1, 8.8, 9.6, 10.2, 9.9, 10.8, 11.1, 10.6, 11.5, 11.9, 12.4],
  },
  {
    label: "Pipeline runs",
    value: 1_284,
    delta: { value: 96, label: "vs last week" },
    trend: [980, 1010, 1042, 998, 1105, 1150, 1121, 1188, 1204, 1230, 1266, 1284],
  },
  {
    label: "Failed runs",
    value: 7,
    // Fewer failures is better, so a negative delta is the green one.
    delta: { value: -3, label: "vs last week", goodWhenUp: false },
    trend: [12, 14, 11, 15, 13, 10, 12, 9, 11, 8, 10, 7],
  },
  {
    label: "Active connections",
    value: 24,
    delta: { value: 2, label: "vs last week" },
    trend: [18, 18, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24],
  },
];

export type RunStatus = "succeeded" | "running" | "failed";

export interface Run {
  id: string;
  pipeline: string;
  source: string;
  environment: "Production" | "Staging";
  status: RunStatus;
  rows: number;
  /** Seconds. */
  duration: number;
  started: string;
}

// Enough rows that sorting, faceting, column hiding and pagination all have something to bite on.
export const RUNS: Run[] = [
  { id: "r1", pipeline: "orders-daily", source: "postgres-prod", environment: "Production", status: "running", rows: 482_119, duration: 214, started: "2 min ago" },
  { id: "r2", pipeline: "inventory-sync", source: "warehouse-eu", environment: "Production", status: "succeeded", rows: 96_430, duration: 132, started: "18 min ago" },
  { id: "r3", pipeline: "sessions-rollup", source: "events-stream", environment: "Production", status: "failed", rows: 0, duration: 41, started: "26 min ago" },
  { id: "r4", pipeline: "billing-export", source: "warehouse-eu", environment: "Production", status: "succeeded", rows: 12_804, duration: 76, started: "41 min ago" },
  { id: "r5", pipeline: "catalog-refresh", source: "sftp-partners", environment: "Staging", status: "succeeded", rows: 3_902, duration: 58, started: "1 h ago" },
  { id: "r6", pipeline: "users-dedupe", source: "postgres-prod", environment: "Staging", status: "running", rows: 210_775, duration: 302, started: "1 h ago" },
  { id: "r7", pipeline: "revenue-rollup", source: "warehouse-eu", environment: "Production", status: "succeeded", rows: 1_204_882, duration: 611, started: "2 h ago" },
  { id: "r8", pipeline: "logs-archive", source: "events-stream", environment: "Production", status: "failed", rows: 0, duration: 12, started: "3 h ago" },
  { id: "r9", pipeline: "regions-enrich", source: "api-gateway", environment: "Staging", status: "succeeded", rows: 8_120, duration: 44, started: "3 h ago" },
  { id: "r10", pipeline: "prices-import", source: "sftp-partners", environment: "Production", status: "succeeded", rows: 74_600, duration: 189, started: "5 h ago" },
  { id: "r11", pipeline: "shipments-sync", source: "api-gateway", environment: "Production", status: "succeeded", rows: 33_915, duration: 97, started: "6 h ago" },
  { id: "r12", pipeline: "reviews-index", source: "events-stream", environment: "Staging", status: "failed", rows: 0, duration: 8, started: "7 h ago" },
  { id: "r13", pipeline: "traffic-daily", source: "api-gateway", environment: "Production", status: "succeeded", rows: 640_120, duration: 268, started: "9 h ago" },
  { id: "r14", pipeline: "vendors-merge", source: "postgres-prod", environment: "Staging", status: "succeeded", rows: 11_002, duration: 63, started: "11 h ago" },
];

export interface Activity {
  id: string;
  who: string;
  initials: string;
  action: string;
  target: string;
  when: string;
}

export const ACTIVITY: Activity[] = [
  { id: "a1", who: "Ana Ruiz", initials: "AR", action: "re-ran", target: "sessions-rollup", when: "4 min ago" },
  { id: "a2", who: "Marc Oliver", initials: "MO", action: "connected", target: "warehouse-eu", when: "1 h ago" },
  { id: "a3", who: "Lena Fischer", initials: "LF", action: "published", target: "Revenue by region", when: "3 h ago" },
  { id: "a4", who: "Ángel Iglesias", initials: "ÁI", action: "invited", target: "sam@northwind.io", when: "yesterday" },
];

export interface SetupStep {
  title: string;
  description: string;
}

export const SETUP: SetupStep[] = [
  { title: "Create a workspace", description: "Done — Kanzo" },
  { title: "Connect a source", description: "Done — 24 connections" },
  { title: "Schedule a pipeline", description: "Pick a cadence for orders-daily" },
  { title: "Invite your team", description: "Nobody else has joined yet" },
];

export interface Schedule {
  id: string;
  name: string;
  cadence: string;
  cron: string;
}

export const SCHEDULES: Schedule[] = [
  { id: "s1", name: "Nightly full sync", cadence: "Every day at 02:00 UTC", cron: "0 2 * * *" },
  { id: "s2", name: "Hourly incremental", cadence: "Every hour", cron: "0 * * * *" },
  { id: "s3", name: "Weekly rebuild", cadence: "Sundays at 04:00 UTC", cron: "0 4 * * 0" },
];

export interface CommandEntry {
  label: string;
  value: string;
  group: string;
}

export const COMMANDS: CommandEntry[] = [
  { label: "New pipeline", value: "new-pipeline", group: "Actions" },
  { label: "New connection", value: "new-connection", group: "Actions" },
  { label: "Invite a teammate", value: "invite", group: "Actions" },
  { label: "Re-run failed runs", value: "rerun-failed", group: "Actions" },
  { label: "Overview", value: "go-overview", group: "Go to" },
  { label: "Datasets", value: "go-datasets", group: "Go to" },
  { label: "Reports", value: "go-reports", group: "Go to" },
  { label: "Members", value: "go-members", group: "Go to" },
];
