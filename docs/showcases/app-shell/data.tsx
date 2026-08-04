import {
  BookOpenIcon,
  CoinsIcon,
  EyeIcon,
  MessageSquareIcon,
  PawPrintIcon,
  ScrollTextIcon,
  SettingsIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { StatTileProps } from "@kanzo-tech/ui";
import { INSTANCES as HALL_INSTANCES, NAV as WORLD_NAV } from "@/example/nav";
import { initialsOf, membersOf, member, VIEWER } from "@/example/people";
import {
  boardValue,
  daysOverdue,
  FEATURED,
  openQuests,
  overdueQuests,
  postedByMonth,
  type Quest,
  QUESTS,
  questLabel,
} from "@/example/quests";
import { availableNow } from "@/example/roster";
import { hall, HOME_HALL, type Tag } from "@/example/world";

/**
 * The world, arranged for one screen.
 *
 * Almost nothing here is authored: the halls, the navigation and every headline number come from
 * `@/example`, so this screen and the tables elsewhere in the docs cannot disagree about how many
 * contracts are open or who is out. What is authored is called out where it appears.
 */

/**
 * `Instance` and `SidebarNavItem` are this app's shapes. A switcher and a nav column are layout
 * trees, so they are hand-composed in `default.tsx`, and the library has no reason to name the
 * data behind an arrangement it does not ship. That belongs to whoever holds it, which is here.
 */
export interface Instance {
  id: string;
  label: string;
  description?: string;
}

export interface SidebarNavSubItem {
  title: string;
  href: string;
}

export interface SidebarNavItem {
  title: string;
  href?: string;
  icon?: ReactNode;
  items?: SidebarNavSubItem[];
}

/** The route this screen pretends to be on. `isActivePath` prefix-matches every `href` against it. */
export const ACTIVE_PATH = "#/board";

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

/** The tenant switcher's rows are the five halls, already shaped the way `Instance` wants them. */
export const INSTANCES: Instance[] = HALL_INSTANCES;

/** The signed-in viewer is on the roster like everyone else — Ravenna, the Amber Hall's quartermaster. */
export const USER = { name: VIEWER.name, email: VIEWER.email };

export const NAV: SidebarNavItem[] = WORLD_NAV.map((entry) => ({
  title: entry.title,
  href: entry.href,
  icon: entry.icon ? ICONS[entry.icon] : undefined,
  items: entry.items?.map((child) => ({ title: child.title, href: child.href })),
}));

/** Reference the hall keeps, rather than work it posts — hence a second group, not a `NAV` entry. */
export const SUPPORT: SidebarNavItem[] = [
  { title: "Party rules", href: "#/rules", icon: <BookOpenIcon /> },
  { title: "Send word", href: "#/word", icon: <MessageSquareIcon /> },
];

/** Everything posted in the last seven days — a real week of intake, not a guessed delta. */
const POSTED_THIS_WEEK = QUESTS.filter((contract) => contract.postedDayOffset >= -7);
const GOLD_THIS_WEEK = POSTED_THIS_WEEK.reduce((total, contract) => total + contract.reward, 0);

/** Reward per posting month — the money twin of `postedByMonth()`, which the world does not carry. */
function goldByMonth(): number[] {
  const buckets = new Map<number, number>();
  for (const contract of QUESTS) {
    const month = Math.floor(contract.postedDayOffset / 30);
    buckets.set(month, (buckets.get(month) ?? 0) + contract.reward);
  }
  return [...buckets.keys()].sort((a, b) => a - b).map((month) => buckets.get(month) ?? 0);
}

// The board keeps a posting history; the roster keeps none. These two series are therefore the
// authored part of this file, shaped to land on the figure the world does know — the last point
// of each is the real one, and the point before it is what the delta below claims.
const READY_TREND = [21, 20, 22, 19, 20, 18, 19, 17, 19, 20, 18, availableNow().length];
const OVERDUE_TREND = [1, 0, 2, 1, 3, 2, 1, 2, 4, 3, 2, overdueQuests().length];

/** Four headline numbers — the dataviz answer to "a handful of KPIs" is a stat-tile row. */
export const KPIS: StatTileProps[] = [
  {
    label: "Open contracts",
    value: openQuests().length,
    delta: { value: POSTED_THIS_WEEK.length, label: "posted this week" },
    trend: postedByMonth(),
  },
  {
    label: "Gold on the board",
    value: boardValue(),
    delta: { value: GOLD_THIS_WEEK, label: "posted this week" },
    trend: goldByMonth(),
  },
  {
    label: "Members ready",
    value: availableNow().length,
    delta: { value: -2, label: "vs last week" },
    trend: READY_TREND,
  },
  {
    label: "Overdue",
    value: overdueQuests().length,
    // Falling behind is bad, so the rise is the red one.
    delta: { value: 1, label: "vs last week", goodWhenUp: false },
    trend: OVERDUE_TREND,
  },
];

export interface Activity {
  id: string;
  who: string;
  /** Derived once here rather than at each render — `@/example/people` already knows how. */
  initials: string;
  action: string;
  target: string;
  when: string;
}

/** Days before the world's own today — `TODAY` is 14 September 1312, and nothing reads the clock. */
function daysAgo(offset: number): string {
  const days = Math.max(0, -offset);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function activity(
  id: string,
  who: { name: string },
  action: string,
  contract: Quest,
  when: string,
): Activity {
  return {
    id,
    who: who.name,
    initials: initialsOf(who.name),
    action,
    target: questLabel(contract),
    when,
  };
}

/**
 * Members doing things to contracts, most recent first.
 *
 * Every name here is on the party the board records for that contract, so the rail cannot
 * contradict the table beside it: Dagfinn Roe really is on the overdue basilisk contract, and
 * Ravenna really did sign for the well in Greenhollow.
 */
export const ACTIVITY: Activity[] = [
  activity(
    "a1",
    member("roe"),
    "is overdue on",
    FEATURED.overdue,
    `${daysOverdue(FEATURED.overdue)} days late`,
  ),
  activity(
    "a2",
    member("wren"),
    "re-posted",
    FEATURED.reposted,
    daysAgo(FEATURED.reposted.postedDayOffset),
  ),
  activity("a3", VIEWER, "signed for", FEATURED.claimed, daysAgo(FEATURED.claimed.postedDayOffset)),
  activity("a4", member("grieve"), "took the writ", FEATURED.writ, daysAgo(FEATURED.writ.postedDayOffset)),
];

export interface SetupStep {
  title: string;
  description: string;
}

/** How far along the checklist is — the `Steps` cursor and the card's badge read the same number. */
export const SETUP_DONE = 2;

export const SETUP: SetupStep[] = [
  { title: "Charter the hall", description: `Done — ${hall(HOME_HALL).name}` },
  { title: "Muster a roster", description: `Done — ${membersOf(HOME_HALL).length} members` },
  { title: "Send out a party", description: `Pick a party for ${FEATURED.open.id}` },
  {
    title: "Bring in a fifth hall",
    description: `${hall("lanternwood").short} is invited, not yet chartered`,
  },
];

export interface StandingOrder {
  id: string;
  name: string;
  cadence: string;
  /** A board tag, so a patrol would post as a contract the board already understands. */
  tag: Tag;
}

// The one authored fixture with no world counterpart, and deliberately so: standing orders are the
// feature this screen gates behind a "Coming soon" `Ribbon`. The tags are real board tags.
export const STANDING: StandingOrder[] = [
  { id: "o1", name: "Night patrol, the cliff road", cadence: "Every night, dusk to the third bell", tag: "night-work" },
  { id: "o2", name: "Ward-check at the north gate", cadence: "Every seventh day", tag: "warding" },
  { id: "o3", name: "Standing bounty: revenants", cadence: "Whenever one is reported", tag: "bounty" },
];
