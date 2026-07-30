// The furniture a screen needs before it can show anything: navigation, commands, the tenant list.
//
// Icons are not here. They are `lucide-react` elements, which would make this a `.tsx` and drag
// React into every module that only wanted a hall's name; the examples that need an icon pick it
// where they render.

import { HALLS, type HallId, QUEST_STATUSES, REGIONS } from "./world";

export interface NavItem {
  title: string;
  href?: string;
  /** Lucide icon *name*, resolved at the call site. */
  icon?: string;
  items?: NavItem[];
}

export const NAV: NavItem[] = [
  { title: "The board", href: "#/board", icon: "ScrollText" },
  {
    title: "Contracts",
    icon: "Swords",
    items: [
      { title: "Open", href: "#/board/open" },
      { title: "Afield", href: "#/board/afield" },
      { title: "Settled", href: "#/board/settled" },
    ],
  },
  { title: "Roster", href: "#/roster", icon: "Users" },
  { title: "Bestiary", href: "#/bestiary", icon: "PawPrint" },
  { title: "Sightings", href: "#/sightings", icon: "Eye" },
  { title: "Ledger", href: "#/ledger", icon: "Coins" },
  {
    title: "Hall",
    icon: "Settings",
    items: [
      { title: "Members", href: "#/hall/members" },
      { title: "Heraldry", href: "#/hall/heraldry" },
      { title: "Charter", href: "#/hall/charter" },
    ],
  },
];

/** The tenant switcher's rows — the same five halls, shaped the way `InstanceSwitcher` wants them. */
export const INSTANCES = HALLS.map((entry) => ({
  id: entry.id as HallId,
  label: entry.short,
  description: entry.standing,
}));

export interface Command {
  id: string;
  label: string;
  group: string;
  /** Lucide icon name. */
  icon?: string;
  shortcut?: string;
}

export const COMMANDS: Command[] = [
  { id: "post", label: "Post a contract", group: "Board", icon: "Plus", shortcut: "⌘N" },
  { id: "claim", label: "Claim a contract", group: "Board", icon: "Hand" },
  { id: "overdue", label: "Show overdue contracts", group: "Board", icon: "Clock" },
  { id: "roster", label: "Find a member", group: "Roster", icon: "Search", shortcut: "⌘K" },
  { id: "available", label: "Who is ready today", group: "Roster", icon: "UserCheck" },
  { id: "bestiary", label: "Open the bestiary", group: "Reference", icon: "BookOpen" },
  { id: "rules", label: "Edit the party rules", group: "Reference", icon: "FileCode" },
  { id: "heraldry", label: "Change the hall's colours", group: "Hall", icon: "Palette" },
];

/** Filter chips / segmented controls that recur: the board's own two axes. */
export const BOARD_FILTERS = {
  status: QUEST_STATUSES.map((state) => ({ value: state.id, label: state.label })),
  region: REGIONS.map((region) => ({ value: region, label: region })),
};
