// Fixtures for the metadata-form showcase.
//
// The design system owns error PRESENTATION, never error PRODUCTION (see DESIGN.md and
// `.planning/FORMS-DECISION.md`): `Field` takes a boolean + a `ReactNode`, and where the
// boolean came from is the product's business. So the whole SHACL/ShEx validation engine
// is FAKED here — a plain `validate(values)` function that walks a HealthDCAT-AP-shaped
// value object and returns `Issue[]`, exactly the way the discovery showcase fakes its
// graph. No RDF, no SHACL runtime, no `@kanzo-tech/ui` domain leak — just fixtures.

import type { Suggestion } from "@kanzo-tech/ui";

// ── The shape ────────────────────────────────────────────────────────────────

export type Severity = "violation" | "warning" | "info";

export type GroupId = "general" | "provenance" | "health" | "distributions";

export interface Group {
  id: GroupId;
  label: string;
  /** The SHACL node shape this group edits — shown only in the Source panel. */
  shape: string;
}

export const GROUPS: Group[] = [
  { id: "general", label: "General", shape: "dcat:Dataset" },
  { id: "provenance", label: "Provenance", shape: "dct:ProvenanceStatement" },
  { id: "health", label: "Health-specific", shape: "healthdcatap:HealthDataset" },
  { id: "distributions", label: "Distributions", shape: "dcat:Distribution" },
];

/** A repeatable single-literal value (multilingual descriptions, keywords, themes…). Carries
 *  a stable `id` so `FieldArray` keeps focus across edits — never key a row by its index. */
export interface Entry {
  id: string;
  value: string;
}

/** dct:publisher → foaf:Agent — a compound object, 0..1, required by the shape. */
export interface Publisher {
  name: string;
  homepage: string;
  email: string;
}

/** dcat:contactPoint → vcard:Kind — a compound object, repeatable. */
export interface Contact {
  id: string;
  fn: string;
  email: string;
}

/** dcat:distribution → dcat:Distribution — a compound object, repeatable. */
export interface Distribution {
  id: string;
  accessURL: string;
  format: string;
  license: string;
}

export interface FormValues {
  title: string; // dct:title
  descriptions: Entry[]; // dct:description (language-tagged literals)
  keywords: Entry[]; // dcat:keyword
  themes: Entry[]; // dcat:theme
  accessRights: string; // dct:accessRights
  issued: string | null; // dct:issued
  modified: string | null; // dct:modified
  publisher: Publisher | null; // dct:publisher
  contacts: Contact[]; // dcat:contactPoint
  healthThemes: Entry[]; // healthdcatap:healthCategory
  populationCoverage: string; // healthdcatap:populationCoverage
  numberOfRecords: string; // healthdcatap:numberOfRecords
  codingSystems: Entry[]; // healthdcatap:hasCodingSystem
  distributions: Distribution[]; // dcat:distribution
}

// ── Controlled-vocabulary options (the `Select` sources) ─────────────────────

export const ACCESS_RIGHTS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "PUBLIC", label: "Public" },
  { value: "RESTRICTED", label: "Restricted" },
  { value: "NON_PUBLIC", label: "Non-public" },
];

export const DATA_THEMES: { value: string; label: string }[] = [
  { value: "", label: "Select a data theme…" },
  { value: "HEAL", label: "Health" },
  { value: "ENVI", label: "Environment" },
  { value: "SOCI", label: "Population & society" },
  { value: "GOVE", label: "Government & public sector" },
  { value: "TECH", label: "Science & technology" },
];

export const HEALTH_CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "Select a health category…" },
  { value: "public-health", label: "Public health & surveillance" },
  { value: "care", label: "Healthcare provision" },
  { value: "research", label: "Biomedical research" },
  { value: "determinants", label: "Health determinants" },
  { value: "medicines", label: "Medicines & devices" },
];

export const FORMATS: { value: string; label: string }[] = [
  { value: "", label: "Select a format…" },
  { value: "parquet", label: "Apache Parquet" },
  { value: "csv", label: "CSV" },
  { value: "jsonld", label: "JSON-LD" },
  { value: "graphar", label: "GraphAr" },
  { value: "ttl", label: "Turtle" },
];

// ── Stable-id helper ─────────────────────────────────────────────────────────

let seq = 0;
/** A stable row id. Not `crypto.randomUUID()` — that is not needed and this keeps the
 *  fixtures deterministic on the server render. */
export const uid = (prefix = "row") => `${prefix}-${(seq += 1)}`;

// ── The two seeded datasets (the `Data` switcher in the top strip) ───────────

export const EMPTY_DATASET: FormValues = {
  title: "",
  descriptions: [],
  keywords: [],
  themes: [],
  accessRights: "",
  issued: null,
  modified: null,
  publisher: null,
  contacts: [],
  healthThemes: [],
  populationCoverage: "",
  numberOfRecords: "",
  codingSystems: [],
  distributions: [],
};

/** A complete, shape-satisfying dataset — mirrors the real app's "COVID-19 registry" that
 *  flips the header badge from "3 issues" to "Valid". */
export const COVID_DATASET: FormValues = {
  title: "COVID-19 case registry (Spain, 2020–2023)",
  descriptions: [
    {
      id: "d-covid-1",
      value:
        "Anonymised national registry of confirmed COVID-19 cases across Spanish autonomous communities, aggregated weekly with demographic and clinical outcome fields.",
    },
  ],
  keywords: [
    { id: "k-covid-1", value: "covid-19" },
    { id: "k-covid-2", value: "epidemiology" },
    { id: "k-covid-3", value: "public health" },
  ],
  themes: [{ id: "t-covid-1", value: "HEAL" }],
  accessRights: "RESTRICTED",
  issued: "2023-01-15",
  modified: null,
  publisher: {
    name: "National Health Institute",
    homepage: "https://isciii.es",
    email: "opendata@isciii.es",
  },
  contacts: [
    { id: "c-covid-1", fn: "Open Data Office", email: "opendata@isciii.es" },
  ],
  healthThemes: [{ id: "h-covid-1", value: "public-health" }],
  populationCoverage: "National — all residents of Spain, all ages.",
  numberOfRecords: "13800000",
  codingSystems: [
    { id: "cs-covid-1", value: "http://purl.bioontology.org/ontology/ICD10" },
  ],
  distributions: [
    {
      id: "dist-covid-1",
      accessURL: "https://opendata.isciii.es/covid/registry.parquet",
      format: "parquet",
      license: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
};

export interface DatasetOption {
  id: string;
  label: string;
  values: FormValues;
}

export const DATASETS: DatasetOption[] = [
  { id: "empty", label: "Empty (new dataset)", values: EMPTY_DATASET },
  { id: "covid", label: "COVID-19 registry", values: COVID_DATASET },
];

// ── The faked validation engine ──────────────────────────────────────────────

export interface Issue {
  /** Field key — how the summary and per-field lookup group issues. */
  field: string;
  /** Human field label — what the summary shows on the left. */
  label: string;
  group: GroupId;
  severity: Severity;
  /** The message the product resolved — the `ReactNode` the library will just display. */
  message: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const nonEmpty = (list: Entry[]) => list.some((e) => e.value.trim().length > 0);

/**
 * Stand-in for the SHACL/ShEx engine over the whole graph. Deliberately returns a flat
 * `Issue[]` with resolved messages — the library never sees a shape, a `sh:message` or a
 * severity term. Seeded so `EMPTY_DATASET` yields exactly the three `sh:minCount` violations
 * (Title, Description, Publisher) the real app reports, while `COVID_DATASET` yields none.
 */
export function validate(v: FormValues): Issue[] {
  const out: Issue[] = [];
  const add = (
    field: string,
    label: string,
    group: GroupId,
    severity: Severity,
    message: string,
  ) => out.push({ field, label, group, severity, message });

  // General — the required core.
  if (!v.title.trim())
    add("title", "Title", "general", "violation", "This field is required.");
  else if (v.title.trim().length < 6)
    add("title", "Title", "general", "warning", "A title under 6 characters is rarely descriptive enough.");

  if (!nonEmpty(v.descriptions))
    add("descriptions", "Description", "general", "violation", "This field is required.");

  if (!nonEmpty(v.keywords))
    add("keywords", "Keywords", "general", "info", "Datasets without keywords surface poorly in search.");

  // Provenance.
  if (!v.publisher || !v.publisher.name.trim())
    add("publisher", "Publisher", "provenance", "violation", "This field is required.");
  if (v.publisher?.email.trim() && !EMAIL.test(v.publisher.email.trim()))
    add("publisher", "Publisher", "provenance", "violation", "Publisher email is not a valid address.");
  if (v.issued && new Date(v.issued) > new Date())
    add("issued", "Release date", "provenance", "warning", "The release date is in the future.");
  if (v.modified && v.issued && new Date(v.modified) < new Date(v.issued))
    add("modified", "Modification date", "provenance", "warning", "Modified predates the release date.");
  v.contacts.forEach((c, i) => {
    if (c.email.trim() && !EMAIL.test(c.email.trim()))
      add("contacts", `Contact point ${i + 1}`, "provenance", "violation", "Contact email is not a valid address.");
  });

  // Health-specific.
  const records = v.numberOfRecords.trim() ? Number(v.numberOfRecords) : null;
  if (records != null && (Number.isNaN(records) || records < 0))
    add("numberOfRecords", "Number of records", "health", "violation", "Must be a non-negative number.");
  if (!nonEmpty(v.healthThemes))
    add("healthThemes", "Health theme", "health", "info", "A health category is recommended for HealthDCAT-AP.");

  // Distributions.
  v.distributions.forEach((d, i) => {
    if (!d.accessURL.trim())
      add("distributions", `Distribution ${i + 1}`, "distributions", "violation", "Access URL is required.");
    else if (!/^(https?:|s3:|abfss:)/.test(d.accessURL.trim()))
      add("distributions", `Distribution ${i + 1}`, "distributions", "warning", "Access URL should be a resolvable URL.");
    if (!d.format)
      add("distributions", `Distribution ${i + 1}`, "distributions", "warning", "A media type (dct:format) is recommended.");
  });

  return out;
}

// ── The SHACL source (the `Source` panel) — a static fixture ─────────────────

/** Number of node shapes in the shapes graph — the count on the `Source` toggle. */
export const SHAPE_COUNT = GROUPS.length + 1; // groups + the publisher agent shape

export const SHAPES_TTL = `@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix dcat:   <http://www.w3.org/ns/dcat#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix healthdcatap: <http://healthdataportal.eu/ns/health#> .

healthdcatap:HealthDatasetShape
    a sh:NodeShape ;
    sh:targetClass dcat:Dataset ;
    sh:property [ sh:path dct:title ;       sh:minCount 1 ; sh:datatype xsd:string ] ;
    sh:property [ sh:path dct:description ; sh:minCount 1 ; sh:datatype rdf:langString ] ;
    sh:property [ sh:path dct:publisher ;   sh:minCount 1 ; sh:node :AgentShape ] ;
    sh:property [ sh:path dcat:distribution ; sh:node dcat:DistributionShape ] .`;

// ── Live serialisation (the `Output` panel) — faked, derived from the values ─

const esc = (s: string) => s.replace(/"/g, '\\"');

/** A toy Turtle serialiser — enough to show the form's output live, not a real writer. */
export function toTurtle(v: FormValues): string {
  const lines: string[] = ["<urn:dataset> a dcat:Dataset ;"];
  if (v.title.trim()) lines.push(`  dct:title "${esc(v.title.trim())}" ;`);
  for (const d of v.descriptions)
    if (d.value.trim()) lines.push(`  dct:description "${esc(d.value.trim())}"@en ;`);
  for (const k of v.keywords)
    if (k.value.trim()) lines.push(`  dcat:keyword "${esc(k.value.trim())}" ;`);
  for (const t of v.themes) if (t.value) lines.push(`  dcat:theme theme:${t.value} ;`);
  if (v.accessRights) lines.push(`  dct:accessRights dct:${v.accessRights} ;`);
  if (v.issued) lines.push(`  dct:issued "${v.issued}"^^xsd:date ;`);
  if (v.modified) lines.push(`  dct:modified "${v.modified}"^^xsd:date ;`);
  if (v.publisher?.name.trim())
    lines.push(`  dct:publisher [ a foaf:Agent ; foaf:name "${esc(v.publisher.name.trim())}" ] ;`);
  if (v.numberOfRecords.trim())
    lines.push(`  healthdcatap:numberOfRecords ${v.numberOfRecords.trim()} ;`);
  for (const d of v.distributions)
    if (d.accessURL.trim())
      lines.push(`  dcat:distribution [ dcat:accessURL <${d.accessURL.trim()}> ] ;`);
  // Close the statement.
  const body = lines.join("\n");
  return body.endsWith(";") ? `${body.slice(0, -1)}.` : `${body} .`;
}

/** A toy JSON-LD serialiser — the second tab of the `Output` panel. */
export function toJsonLd(v: FormValues): string {
  const node: Record<string, unknown> = {
    "@context": {
      dcat: "http://www.w3.org/ns/dcat#",
      dct: "http://purl.org/dc/terms/",
      healthdcatap: "http://healthdataportal.eu/ns/health#",
    },
    "@id": "urn:dataset",
    "@type": "dcat:Dataset",
  };
  if (v.title.trim()) node["dct:title"] = v.title.trim();
  const descs = v.descriptions.map((d) => d.value.trim()).filter(Boolean);
  if (descs.length) node["dct:description"] = descs;
  const kws = v.keywords.map((k) => k.value.trim()).filter(Boolean);
  if (kws.length) node["dcat:keyword"] = kws;
  if (v.issued) node["dct:issued"] = v.issued;
  if (v.publisher?.name.trim())
    node["dct:publisher"] = { "@type": "foaf:Agent", "foaf:name": v.publisher.name.trim() };
  if (v.numberOfRecords.trim())
    node["healthdcatap:numberOfRecords"] = Number(v.numberOfRecords.trim());
  const dists = v.distributions
    .filter((d) => d.accessURL.trim())
    .map((d) => ({ "dcat:accessURL": d.accessURL.trim() }));
  if (dists.length) node["dcat:distribution"] = dists;
  return JSON.stringify(node, null, 2);
}

/** Rough triple count — the number on the `Output` toggle. */
export function tripleCount(v: FormValues): number {
  return toTurtle(v).split("\n").filter((l) => /[;.]$/.test(l.trim())).length;
}

// ── Faked AI streams (SuggestMenu + CompletionField) ─────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KEYWORD_POOL: Suggestion[] = [
  { value: "public health", rationale: "Common HealthDCAT-AP discovery keyword" },
  { value: "epidemiology", rationale: "Study of disease distribution" },
  { value: "surveillance", rationale: "Ongoing health monitoring" },
  { value: "clinical outcomes", rationale: "Frequently queried facet" },
  { value: "primary care", rationale: "Care-setting keyword" },
  { value: "vaccination", rationale: "Related intervention" },
  { value: "mortality", rationale: "Outcome measure" },
  { value: "comorbidity", rationale: "Clinical qualifier" },
];

/** SuggestMenu's `suggest` — streams candidate keywords one at a time. */
export async function* suggestKeywords(
  signal?: AbortSignal,
): AsyncIterable<Suggestion> {
  for (const s of KEYWORD_POOL) {
    await sleep(180);
    if (signal?.aborted) return;
    yield s;
  }
}

/** CompletionField's `complete` — streams a canned continuation for a description literal. */
export async function* completeDescription(
  value: string,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const continuation =
    " The dataset is updated on a weekly cadence, covers all Spanish autonomous communities, and includes demographic breakdowns suitable for secondary research use.";
  const words = continuation.split(/(?<=\s)/);
  for (const w of words) {
    await sleep(45);
    if (signal?.aborted) return;
    yield w;
  }
}
