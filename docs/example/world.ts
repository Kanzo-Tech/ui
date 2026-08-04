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

/** The five status families `Badge`, `Status`, `Alert` and `StatTile` all share. */
export type Tone = "default" | "success" | "info" | "warning" | "destructive";

/* -------------------------------------------------------------------------------------------- */
/* The halls                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * A guild hall — the world's tenant.
 *
 * `heraldry` is a real seed pair: `brand` and `base` are the two inputs `derivePalette` takes,
 * so switching halls IS the white-label story rather than a fixture that demonstrates theming.
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
  heraldry: { brand: string; base: string };
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
    heraldry: { brand: "#c97a1e", base: "#6f6152" },
  },
  {
    id: "salt",
    name: "The Order of Salt",
    short: "Salt",
    motto: "Nothing keeps forever",
    seat: "Saltmere",
    founded: 1131,
    standing: "Member",
    heraldry: { brand: "#1c7f92", base: "#586a70" },
  },
  {
    id: "nine",
    name: "The Nine",
    short: "The Nine",
    motto: "Count again",
    seat: "Coldiron",
    founded: 1247,
    standing: "Member",
    heraldry: { brand: "#5a4bc8", base: "#616188" },
  },
  {
    id: "ash",
    name: "Ash & Company",
    short: "Ash Co.",
    motto: "Bring it back cold",
    seat: "Ashfall Reach",
    founded: 1268,
    standing: "Member",
    heraldry: { brand: "#b03a35", base: "#6e6764" },
  },
  {
    id: "lanternwood",
    name: "The Lanternwood Compact",
    short: "Lanternwood",
    motto: "Someone has to walk it",
    seat: "Duskfen",
    founded: 1301,
    standing: "Invited",
    heraldry: { brand: "#3f7f4e", base: "#5d6a5c" },
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

/** Six — the size that makes a `FacetFilter` worth opening, and one a categorical scheme covers. */
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

/** Six roles, each with a duty a rule can require — which is what lets `rules.ts` mean something. */
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

/** Five ranks, ordered cheapest first, so a bar, a slider and a sort agree on "further along". */
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
 * `terminal` is what lets an example show a destructive action legal on only some rows.
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

/** Difficulty 1–5, named as well as numbered: a `Rating` wants the number, a tooltip the word. */
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
 * The board's free tags — unordered and overlapping, because that is what a tag vocabulary is.
 *
 * The closed enums above are what a rule reasons about; this is what a poster types.
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
 * The day the world is frozen on. Every date derives from it, never from `Date.now()`.
 *
 * A fixture that reads the clock makes the committed output differ from the rebuild, and a
 * date-picker example that opens on "today" cannot be screenshotted twice. Overdue stays overdue.
 */
export const TODAY = new Date("1312-09-14T00:00:00Z");

/** The year is deliberately not 2026: `1312-09-14` in a field is unmistakably the example world. */
export function day(offset: number): Date {
  const date = new Date(TODAY);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

/** `1312-09-14` — the form ISO dates and CSV columns use. */
export function isoDay(offset: number): string {
  return day(offset).toISOString().slice(0, 10);
}
