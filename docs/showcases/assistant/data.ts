/**
 * The files the person brought, as the profile read them: columns, rows, a key, and which column's
 * values are all found in another file's key. In a product this is `@fossil-lang/profile` run on the
 * page's DuckDB; here it is written down, because the showcase is about the screens above it.
 */

export interface Source {
  file: string;
  /** The type its rows become. */
  type: string;
  rows: number;
  key: string;
  columns: { name: string; kind: "text" | "number" | "date" }[];
}

export const SOURCES: Source[] = [
  {
    file: "awards.csv",
    type: "Award",
    rows: 1026,
    key: "id",
    columns: [
      { name: "id", kind: "text" },
      { name: "year", kind: "number" },
      { name: "category", kind: "text" },
      { name: "motivation", kind: "text" },
      { name: "laureate", kind: "text" },
      { name: "affiliation", kind: "text" },
    ],
  },
  {
    file: "laureates.csv",
    type: "Laureate",
    rows: 1018,
    key: "id",
    columns: [
      { name: "id", kind: "text" },
      { name: "name", kind: "text" },
      { name: "gender", kind: "text" },
      { name: "born", kind: "date" },
      { name: "country", kind: "text" },
    ],
  },
  {
    file: "institutions.csv",
    type: "Institution",
    rows: 379,
    key: "id",
    columns: [
      { name: "id", kind: "text" },
      { name: "name", kind: "text" },
      { name: "city", kind: "text" },
      { name: "country", kind: "text" },
    ],
  },
];

/** A column whose every value is another file's key: the profile's inclusion, read as a link. */
export interface Link {
  from: string;
  column: string;
  to: string;
  /** How many of the column's values were found, of how many. */
  found: number;
  of: number;
}

export const LINKS: Link[] = [
  { from: "Award", column: "laureate", to: "Laureate", found: 1026, of: 1026 },
  { from: "Award", column: "affiliation", to: "Institution", found: 781, of: 781 },
];

/**
 * Everything a question may stand on: each type's columns (`Laureate.gender`) and each link
 * (`Award→Laureate`). Computed from the profile, never asked of the model — the closed vocabulary
 * the requirements Task's schema is an enum of.
 */
export const CONCEPTS: string[] = [
  ...SOURCES.flatMap((s) => s.columns.filter((c) => c.name !== s.key && !LINKS.some((l) => l.from === s.type && l.column === c.name)).map((c) => `${s.type}.${c.name}`)),
  ...LINKS.map((l) => `${l.from}→${l.to}`),
];

const words: Record<string, string> = {
  Award: "prize",
  Laureate: "laureate",
  Institution: "institution",
};

/** A concept in the person's words: `Laureate.gender` is "laureate's gender". */
export function say(concept: string): string {
  const link = concept.split("→");
  if (link.length === 2) return `${words[link[0]!] ?? link[0]} → ${words[link[1]!] ?? link[1]}`;
  const [type, column] = concept.split(".");
  const thing = words[type!] ?? type!;
  return column ? `${thing}'s ${column}` : thing;
}

/** What the corpus answers each question with, once it is built: canned, as the model is. */
export const ANSWERS: Record<string, string> = {
  "Which institutions have the most Physics prizes?": "University of California — 9, Harvard University — 8, Stanford University — 7",
  "How many women have won a prize in each category?": "Peace — 19, Literature — 17, Medicine — 13, Chemistry — 8, Physics — 5, Economics — 3",
  "In which countries were the most laureates born?": "USA — 289, United Kingdom — 93, Germany — 84",
  "Which laureates won more than one prize?": "Marie Curie, Linus Pauling, John Bardeen, Frederick Sanger, and 2 organisations",
  "What was each prize awarded for, by year?": "1,026 prizes, 1901 to 2025, each with its motivation",
};
