// The chrome around the archive: the tenant switcher, the nav and who is signed in.
//
// Nothing else. The graph corpus is `./graph-data` and the analytical relation is the world's own
// `@/example/sightings` — both are read only inside client-only islands, so keeping them out of this
// module keeps DuckDB and a 120 kB literal out of the shell's RSC prerender.

import {
  CoinsIcon,
  EyeIcon,
  PawPrintIcon,
  ScrollTextIcon,
  SettingsIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { INSTANCES as HALL_INSTANCES, NAV as WORLD_NAV } from "@/example/nav";
import { VIEWER } from "@/example/people";

// `Instance` and `SidebarNavItem` are this app's shapes, not the library's — the composites that
// took them as props are gone, and an array of `ReactNode`s was a layout tree written as an
// attribute: you cannot reorder it, wrap a region or spread props onto one. So the arrangement
// lives in the showcase and the shapes live with it.

/** A switchable hall. */
export interface Instance {
  id: string;
  label: string;
  description: string;
}

/** A leaf under a nav group. */
export interface SidebarNavSubItem {
  title: string;
  href: string;
}

/** A navigation entry: a leaf with an `href`, or a group with `items`. */
export interface SidebarNavItem {
  title: string;
  href?: string;
  icon?: ReactNode;
  items?: SidebarNavSubItem[];
}

/** `NAV` names its icons rather than holding elements, so the world stays React-free. */
const ICONS: Record<string, ReactNode> = {
  ScrollText: <ScrollTextIcon />,
  Swords: <SwordsIcon />,
  Users: <UsersIcon />,
  PawPrint: <PawPrintIcon />,
  Eye: <EyeIcon />,
  Coins: <CoinsIcon />,
  Settings: <SettingsIcon />,
};

/** The tenant switcher's rows are the five halls — the same five the canvas clusters by. */
export const INSTANCES: Instance[] = HALL_INSTANCES;

/**
 * The route the shell is on. One string, prefix-matched by the library's `isActivePath`, rather
 * than an `isActive` flag per row: the flag has to be kept in sync with the router by hand, and it
 * cannot tell a group that one of its children is the live one.
 *
 * The archive is reached from the ledger — it is what the ledger is a summary of.
 */
export const ACTIVE_PATH = "#/ledger";

export const NAV: SidebarNavItem[] = WORLD_NAV.map((entry) => ({
  title: entry.title,
  href: entry.href,
  icon: entry.icon ? ICONS[entry.icon] : undefined,
  items: entry.items?.map((child) => ({ title: child.title, href: child.href })),
}));

/** The signed-in viewer is on the roster like everyone else — the Amber Hall's quartermaster. */
export const USER = { name: VIEWER.name, email: VIEWER.email };
