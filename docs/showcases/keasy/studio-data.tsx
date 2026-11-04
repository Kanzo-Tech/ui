/**
 * One org's worth of fixtures, so the studio reads as a product rather than a control gallery.
 *
 * The domain is the docs' running example — AEMET weather observations, the same dataset the
 * `CodeEditor` page already edits. A new showcase joins that story; it does not open a new one.
 */

export type ConnectionKind = "data" | "vocab";

export interface Connection {
  id: string;
  /** The name a program references as `@name/…`. */
  name: string;
  kind: ConnectionKind;
  url: string;
  /** Whether the org can also WRITE here — only a writable connection is a valid destination. */
  writable?: boolean;
}

export const CONNECTIONS: Connection[] = [
  {
    id: "c-aemet",
    name: "aemet",
    kind: "data",
    url: "https://opendata.aemet.es/opendata/api/valores/climatologicos",
  },
  { id: "c-stations", name: "stations", kind: "data", url: "s3://kanzo-lake/aemet/stations.csv" },
  { id: "c-lake", name: "lake", kind: "data", url: "s3://kanzo-lake/graphs", writable: true },
  { id: "c-archive", name: "archive", kind: "data", url: "azure://kanzo/archive", writable: true },
  { id: "c-sosa", name: "sosa", kind: "vocab", url: "http://www.w3.org/ns/sosa/" },
  { id: "c-dcat", name: "dcat", kind: "vocab", url: "http://www.w3.org/ns/dcat#" },
];

export const DESTINATIONS = CONNECTIONS.filter((c) => c.writable);

export type RunMode = "integrated" | "scheduled";

/** A program the studio can open. The last one is broken on purpose — see `analyse`. */
export interface Template {
  id: string;
  label: string;
  description: string;
  program: string;
}

const BLANK = `// A fossil program: declare prefixes, bind a source, map it.
// Type @ to reference one of the org's connections.

prefix ex: <https://example.org/>

`;

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    label: "Empty program",
    description: "Prefixes only — start from here.",
    program: BLANK,
  },
  {
    id: "stations",
    label: "Weather stations",
    description: "One CSV source, one mapping. The walking skeleton.",
    program: `// AEMET weather stations → a typed RDF graph.

prefix ex: <https://example.org/aemet/>
prefix sosa: <http://www.w3.org/ns/sosa/>

stations := io.csv("@stations/stations.csv")

Station : sosa:Platform from stations
    iri = \`\${ex:}station/\${.indicativo}\`
    ex:name = .nombre
    ex:province = .provincia
    ex:altitude = .altitud
`,
  },
  {
    id: "observations",
    label: "Stations + observations",
    description: "Two sources — the second one still needs wiring.",
    program: `// Stations and their daily observations. The join is the shared IRI
// template, not a SQL JOIN — see multi-source-join.fossil.
//
// The second source is an empty socket: drag a connection from the
// rail onto it, or click it and pick one.

prefix ex: <https://example.org/aemet/>
prefix sosa: <http://www.w3.org/ns/sosa/>

stations     := io.csv("@stations/stations.csv")
observations := io.csv("@?/daily-2026.csv")

Station : sosa:Platform from stations
    iri = \`\${ex:}station/\${.indicativo}\`
    ex:name = .nombre
    ex:province = .provincia

Observation : sosa:Observation from observations
    iri = \`\${ex:}obs/\${.indicativo}/\${.fecha}\`
    sosa:madeBySensor = \`\${ex:}station/\${.indicativo}\`
    ex:temperature = .tmed
    ex:rainfall = .prec
`,
  },
  {
    id: "broken",
    label: "A program with problems",
    description: "An unwired connection, an undeclared prefix and an empty mapping.",
    program: `// Three mistakes the studio should catch before you press Create.

prefix ex: <https://example.org/aemet/>

stations := io.csv("@meteogalicia/stations.csv")

Station : sosa:Platform from stations
    iri = \`\${ex:}station/\${.indicativo}\`
    ex:name = .nombre

Province : ex:Province from stations
`,
  },
];

/** The job the studio is about to create — what Review shows and Create would POST. */
export interface JobDraft {
  name: string;
  program: string;
  mode: RunMode;
  destinationId: string | null;
  dcat: boolean;
  /** Derived from the program's `@conn` references, never typed by hand. */
  connectionIds: string[];
}

/** The org identity DCAT-AP publication depends on. Toggled live from the panel. */
export const ORGANISATION = {
  legalName: "Kanzo Data S.L.",
  homepage: "https://kanzo.tech",
};

/** A fake round-trip, so the pending states are real rather than described. */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
