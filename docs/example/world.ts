// The Guild — the running example the whole documentation site shares.
//
// Why a single fiction. Before this, 327 examples each invented their own: a Select offered
// "My Dataset", a chart measured `requests` against `latency (ms)`, a graph held triples and a
// table listed pipelines. Every one was defensible alone, and together they read as a catalogue
// of unrelated widgets rather than as a design system — the reader had to re-learn the subject
// matter on every page, and never once got to see two components agree about anything.
//
// So: one world, five guild halls, one quest board. A reader meets it once (`/docs/the-guild`)
// and afterwards recognises Ravenna Sarkis wherever she turns up, notices that the bestiary in
// the tree view is the same bestiary the chart bins by, and can tell a component apart from the
// data flowing through it — which is the only way to judge a component at all.
//
// This file holds the **vocabulary**: the halls, the places, the ranks, the beasts, the states a
// quest can be in. It is deliberately free of records; those are `people.ts`, `quests.ts` and the
// generated relations, all of which draw their enums from here so nothing can drift.
//
// It is also, on purpose, the thinnest possible module: no React, no generation, no imports. The
// heavy fixtures import it, never the other way round, so a page that needs one hall's name does
// not pull a 300 kB CSV into its bundle.

/**
 * The status families a fixture is allowed to name.
 *
 * The five that `Badge`, `Status`, `Alert` and `StatTile` all share. Constraining the world to
 * these means a status in the data always has somewhere to land — the alternative is a fixture
 * inventing a sixth state and every consuming example hand-rolling a colour for it, which is how
 * the untokenised `text-white` got in.
 */
export type Tone = "default" | "success" | "info" | "warning" | "destructive";

/* -------------------------------------------------------------------------------------------- */
/* The halls                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * A guild hall — the world's tenant, and the reason it is a guild rather than, say, a bakery.
 *
 * `heraldry` is a real palette seed pair, not decoration: `brand` and `neutral` are exactly the
 * two inputs `@kanzo-tech/palette`'s `derivePalette` takes, so "this hall's colours" and "this
 * tenant's derived document" are the same sentence. The white-label story the library actually
 * has to tell — a client's colour reaching primary, the charts, the graph and the dashboards —
 * is told here by switching halls, with no fixture that exists only to demonstrate theming.
 *
 * `standing` gives the instance switcher something true to say. A tenant list where every row
 * reads "Member" is a tenant list that never tested its own secondary text.
 */
export interface Hall {
  id: string;
  /** How the hall signs a contract. */
  name: string;
  /** How members refer to it. Short enough for a sidebar, a badge or a table cell. */
  short: string;
  motto: string;
  /** Where the hall keeps its charter — the home region. */
  seat: Region;
  founded: number;
  standing: "Chartered" | "Member" | "Invited" | "Suspended";
  heraldry: { brand: string; neutral: string };
}

export const HALLS = [
  {
    id: "amber",
    name: "The Amber Hall",
    short: "Amber Hall",
    motto: "We were paid to be here",
    seat: "Thornmarch",
    founded: 1194,
    standing: "Chartered",
    heraldry: { brand: "#c97a1e", neutral: "#6f6152" },
  },
  {
    id: "salt",
    name: "The Order of Salt",
    short: "Salt",
    motto: "Nothing keeps forever",
    seat: "Saltmere",
    founded: 1131,
    standing: "Member",
    heraldry: { brand: "#1c7f92", neutral: "#586a70" },
  },
  {
    id: "nine",
    name: "The Nine",
    short: "The Nine",
    motto: "Count again",
    seat: "Coldiron",
    founded: 1247,
    standing: "Member",
    heraldry: { brand: "#5a4bc8", neutral: "#616188" },
  },
  {
    id: "ash",
    name: "Ash & Company",
    short: "Ash Co.",
    motto: "Bring it back cold",
    seat: "Ashfall Reach",
    founded: 1268,
    standing: "Member",
    heraldry: { brand: "#b03a35", neutral: "#6e6764" },
  },
  {
    id: "lanternwood",
    name: "The Lanternwood Compact",
    short: "Lanternwood",
    motto: "Someone has to walk it",
    seat: "Duskfen",
    founded: 1301,
    standing: "Invited",
    heraldry: { brand: "#3f7f4e", neutral: "#5d6a5c" },
  },
] as const satisfies readonly Hall[];

export type HallId = (typeof HALLS)[number]["id"];

/** The hall a screen opens on when it needs exactly one. */
export const HOME_HALL: HallId = "amber";

export function hall(id: HallId): Hall {
  const found = HALLS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such hall: ${id}`);
  return found;
}

/* -------------------------------------------------------------------------------------------- */
/* The places                                                                                    */
/* -------------------------------------------------------------------------------------------- */

/**
 * Six regions, which is a facet domain more than it is geography.
 *
 * Six because that is the size that makes a `FacetFilter` worth opening — three fits in a row of
 * toggles and needs no search, twenty needs pagination and stops being a facet. It is also the
 * count the validated categorical scheme covers comfortably, so a chart banded by region never
 * has to reach for a seventh slot.
 */
export const REGIONS = [
  "Thornmarch",
  "Saltmere",
  "Ashfall Reach",
  "Coldiron",
  "Greenhollow",
  "Duskfen",
] as const;

export type Region = (typeof REGIONS)[number];

/** Rough travel days from the Amber Hall, which is what makes distance a sortable column. */
export const REGION_DISTANCE: Record<Region, number> = {
  Thornmarch: 0,
  Greenhollow: 2,
  Saltmere: 4,
  Duskfen: 5,
  Coldiron: 8,
  "Ashfall Reach": 11,
};

/* -------------------------------------------------------------------------------------------- */
/* The people                                                                                    */
/* -------------------------------------------------------------------------------------------- */

/**
 * What a member does on a contract.
 *
 * Six roles, each with a job that a rule can require — which is the point. `rules.ts` needs to
 * say "a party this size must carry a cantor" and mean something; a role list of
 * "Admin / Editor / Viewer" could not carry that sentence, and permissions are the one domain
 * every design system's examples already use.
 */
export const ROLES = [
  { id: "warden", label: "Warden", duty: "Holds the line and signs for the party" },
  { id: "scout", label: "Scout", duty: "Walks it first, alone, and comes back" },
  { id: "cantor", label: "Cantor", duty: "Keeps the wards lit and the dead quiet" },
  { id: "sapper", label: "Sapper", duty: "Opens doors that were not doors" },
  { id: "alchemist", label: "Alchemist", duty: "Carries what must not be dropped" },
  { id: "archivist", label: "Archivist", duty: "Reads the contract before anyone signs it" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export function role(id: RoleId) {
  const found = ROLES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such role: ${id}`);
  return found;
}

/**
 * Five ranks, ordered, cheapest first.
 *
 * Ordered so that a progress bar, a slider, a stepper and a sort all have the same idea of
 * "further along" — an unordered enum makes every one of those examples pick its own order.
 */
export const RANKS = [
  { id: "copper", label: "Copper", tone: "default" },
  { id: "iron", label: "Iron", tone: "info" },
  { id: "silver", label: "Silver", tone: "info" },
  { id: "gold", label: "Gold", tone: "warning" },
  { id: "adamant", label: "Adamant", tone: "success" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

export type RankId = (typeof RANKS)[number]["id"];

/** Whether someone can be put on a contract today. */
export const AVAILABILITY = [
  { id: "ready", label: "Ready", tone: "success" },
  { id: "afield", label: "Afield", tone: "info" },
  { id: "resting", label: "Resting", tone: "default" },
  { id: "wounded", label: "Wounded", tone: "warning" },
  { id: "missing", label: "Missing", tone: "destructive" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

export type AvailabilityId = (typeof AVAILABILITY)[number]["id"];

/* -------------------------------------------------------------------------------------------- */
/* The work                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/**
 * The five states a contract passes through, in order.
 *
 * A closed set with a defined order and a tone each, so a status filter, a stepper, a badge and a
 * chart legend all agree — including about which two are terminal, which is what lets an example
 * show a destructive action that is only legal on some rows.
 */
export const QUEST_STATUSES = [
  {
    id: "open",
    label: "Open",
    tone: "info",
    description: "Posted to the board. Anyone chartered may claim it.",
    terminal: false,
  },
  {
    id: "claimed",
    label: "Claimed",
    tone: "default",
    description: "A party has signed, and has not left yet.",
    terminal: false,
  },
  {
    id: "afield",
    label: "Afield",
    tone: "warning",
    description: "The party is out. No word is expected before the due date.",
    terminal: false,
  },
  {
    id: "settled",
    label: "Settled",
    tone: "success",
    description: "Delivered, verified by an archivist, and paid.",
    terminal: true,
  },
  {
    id: "failed",
    label: "Failed",
    tone: "destructive",
    description: "Abandoned, expired, or the party did not come back.",
    terminal: true,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  tone: Tone;
  description: string;
  terminal: boolean;
}[];

export type QuestStatusId = (typeof QUEST_STATUSES)[number]["id"];

export function questStatus(id: QuestStatusId) {
  const found = QUEST_STATUSES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such status: ${id}`);
  return found;
}

/**
 * Difficulty, 1 to 5, named.
 *
 * Named as well as numbered because a `Rating` wants the number and a tooltip wants the word, and
 * an example that shows a bare `3` beside five stars has said nothing.
 */
export const GRADES = [
  { value: 1, label: "Errand", note: "A long walk with a bad smell at the end" },
  { value: 2, label: "Nuisance", note: "One thing, and it is smaller than you" },
  { value: 3, label: "Contract", note: "The ordinary work the halls were chartered for" },
  { value: 4, label: "Hazard", note: "Bring a cantor. Bring two." },
  { value: 5, label: "Writ", note: "Requires a hall's seal and a written heir" },
] as const;

export type Grade = (typeof GRADES)[number]["value"];

/** The sibling of `hall()`, `role()`, `beast()` and `questStatus()`, so grades need no `?.` guard. */
export function grade(value: Grade) {
  const found = GRADES.find((candidate) => candidate.value === value);
  if (!found) throw new Error(`No such grade: ${value}`);
  return found;
}

/**
 * Eight beasts — the categorical domain, sized to the eight-slot scheme on purpose.
 *
 * Eight is the number of categorical slots the palette checks actually validate, so a chart that
 * colours by beast is the one place in the docs where the data's cardinality and the scheme's
 * capacity are the same number by design rather than by luck.
 *
 * `kind` is here rather than only in the `BESTIARY` tree because grouping by class is the most
 * natural short grouping demo in the corpus, and reaching it through the tree meant two examples
 * transcribed the classes by hand. A test keeps the two agreeing.
 */
export const BEASTS = [
  { id: "wyrm", label: "Wyrm", kind: "Cold-blooded", habit: "Under granaries, following the warmth" },
  { id: "basilisk", label: "Basilisk", kind: "Cold-blooded", habit: "Quarries and cut stone" },
  { id: "grimalkin", label: "Grimalkin", kind: "Warm-blooded", habit: "Roofs, and only at the turn of the season" },
  { id: "boghound", label: "Bog-hound", kind: "Warm-blooded", habit: "Wet ground, in threes" },
  { id: "harpy", label: "Harpy", kind: "Warm-blooded", habit: "Cliffs above a road" },
  { id: "revenant", label: "Revenant", kind: "Unclassed", habit: "Where a ward was allowed to go out" },
  { id: "mimic", label: "Mimic", kind: "Unclassed", habit: "Anywhere with a door and a lock" },
  { id: "stoneback", label: "Stoneback", kind: "Cold-blooded", habit: "River fords, mistaken for the ford" },
] as const;

export type BeastId = (typeof BEASTS)[number]["id"];
export type BeastKind = (typeof BEASTS)[number]["kind"];

/** The three classes, in `BEASTS` order — a grouping demo's outer loop. */
export const BEAST_KINDS = [...new Set(BEASTS.map((entry) => entry.kind))];

export function beastsOfKind(kind: BeastKind) {
  return BEASTS.filter((entry) => entry.kind === kind);
}

export function beast(id: BeastId) {
  const found = BEASTS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such beast: ${id}`);
  return found;
}

/**
 * The board's free tags — a `TagsInput` domain, and a `Combobox` one.
 *
 * Twenty-odd, unordered and overlapping, because that is what a real tag vocabulary is. The
 * closed enums above are for the things a rule reasons about; this is for the things a poster
 * types.
 */
export const TAGS = [
  "escort",
  "bounty",
  "survey",
  "salvage",
  "warding",
  "night-work",
  "underground",
  "coastal",
  "winter",
  "sealed-orders",
  "no-magic",
  "livestock",
  "children-present",
  "standing-water",
  "bring-rope",
  "no-open-flame",
  "cartography",
  "recovery",
  "hall-honours",
  "second-attempt",
] as const;

export type Tag = (typeof TAGS)[number];

/* -------------------------------------------------------------------------------------------- */
/* The clock                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * The day the world is frozen on.
 *
 * Every date in every fixture is derived from this constant, never from `Date.now()`. Two reasons,
 * and the second is the one that bites: a build-time fixture that reads the clock makes the
 * committed output differ from the rebuild, and a date-picker example that opens on "today" cannot
 * be screenshotted twice. Overdue quests stay overdue.
 */
export const TODAY = new Date("1312-09-14T00:00:00Z");

/**
 * The calendar the world keeps, for date fixtures that need a real `Date`.
 *
 * The year is deliberately not 2026: a reader who sees `1312-09-14` in a date field knows at a
 * glance that it is the example world talking and not their own data.
 */
export function day(offset: number): Date {
  const date = new Date(TODAY);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

/** `1312-09-14` — the form ISO dates and CSV columns use. */
export function isoDay(offset: number): string {
  return day(offset).toISOString().slice(0, 10);
}
