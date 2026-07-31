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
import type { Instance, SidebarNavItem } from "@kanzo-tech/ui";
import { INSTANCES as HALL_INSTANCES, NAV as WORLD_NAV } from "@/example/nav";
import { VIEWER } from "@/example/people";

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

export const NAV: SidebarNavItem[] = WORLD_NAV.map((entry) => ({
  title: entry.title,
  href: entry.href,
  icon: entry.icon ? ICONS[entry.icon] : undefined,
  // The archive is reached from the ledger — it is what the ledger is a summary of.
  isActive: entry.href === "#/ledger",
  items: entry.items?.map((child) => ({ title: child.title, href: child.href })),
}));

/** The signed-in viewer is on the roster like everyone else — the Amber Hall's quartermaster. */
export const USER = { name: VIEWER.name, email: VIEWER.email };
