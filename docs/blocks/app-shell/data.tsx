import {
  BoxesIcon,
  DatabaseIcon,
  HouseIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Instance, SidebarNavItem } from "@kanzo-tech/ui";

/** One fake tenant's worth of data, so the block reads as a real product. */

export const INSTANCES: Instance[] = [
  { id: "kanzo", label: "Kanzo", description: "Owner" },
  { id: "acme", label: "ACME Data", description: "Member" },
  { id: "eu-open", label: "EU Open Data", description: "Member" },
];

export const USER = {
  name: "Ángel Iglesias",
  email: "angel@kanzo.tech",
};

export const NAV: SidebarNavItem[] = [
  { title: "Dashboard", href: "#/app", icon: <HouseIcon />, isActive: true },
  {
    title: "Data",
    icon: <DatabaseIcon />,
    items: [
      { title: "Connections", href: "#/app/connections" },
      { title: "Jobs", href: "#/app/jobs" },
      { title: "Datasets", href: "#/app/datasets" },
    ],
  },
  { title: "Catalog", href: "#/app/catalog", icon: <BoxesIcon /> },
  { title: "Quality", href: "#/app/quality", icon: <ShieldCheckIcon /> },
  {
    title: "Settings",
    icon: <SettingsIcon />,
    items: [
      { title: "Cloud accounts", href: "#/app/settings/cloud" },
      { title: "AI providers", href: "#/app/settings/ai" },
      { title: "Preferences", href: "#/app/settings/preferences" },
    ],
  },
];

export interface Connection {
  id: string;
  name: string;
  location: string;
  url: string;
  status: "ready" | "syncing" | "failed";
  rows: number;
}

// Enough rows that sorting, filtering and pagination all have something to bite on.
export const CONNECTIONS: Connection[] = [
  { id: "c1", name: "aemet-observations", location: "Azure — production", url: "abfss://raw@kanzo/aemet", status: "ready", rows: 1_204_882 },
  { id: "c2", name: "eu-datasets", location: "S3 — eu-west-1", url: "s3://kanzo-open/eu-datasets", status: "syncing", rows: 48_120 },
  { id: "c3", name: "internal-crm", location: "Local", url: "file:///var/data/crm.parquet", status: "failed", rows: 0 },
  { id: "c4", name: "vocab-skos", location: "Azure — production", url: "https://vocab.kanzo.tech/skos", status: "ready", rows: 9_842 },
  { id: "c5", name: "ine-census-2021", location: "Azure — production", url: "abfss://raw@kanzo/ine", status: "ready", rows: 830_517 },
  { id: "c6", name: "opendata-barcelona", location: "S3 — eu-west-1", url: "s3://kanzo-open/bcn", status: "ready", rows: 212_003 },
  { id: "c7", name: "who-indicators", location: "Azure — production", url: "abfss://raw@kanzo/who", status: "syncing", rows: 74_600 },
  { id: "c8", name: "worldbank-gdp", location: "S3 — us-east-1", url: "s3://kanzo-open/wb-gdp", status: "ready", rows: 33_915 },
  { id: "c9", name: "legacy-oracle-dump", location: "Local", url: "file:///var/data/oracle.parquet", status: "failed", rows: 0 },
  { id: "c10", name: "eurostat-nuts", location: "Azure — production", url: "abfss://raw@kanzo/eurostat", status: "ready", rows: 156_240 },
  { id: "c11", name: "geonames-places", location: "S3 — eu-west-1", url: "s3://kanzo-open/geonames", status: "ready", rows: 11_002_450 },
  { id: "c12", name: "spotify-charts", location: "S3 — us-east-1", url: "s3://kanzo-open/spotify", status: "syncing", rows: 640_120 },
];
