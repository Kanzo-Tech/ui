"use client";

// The shape, read. Everything the showcase knows about the ledger's columns comes through here,
// and here reads exactly one document: `SLIP_SHAPE`.
//
// rudof — the SHACL/ShEx stack — runs the parse and the validation in wasm. There is no JS
// re-implementation of either: `loadShapes` hands back the shape's own IR, so the column list IS
// the shape, and `validate` is the real SHACL validator rather than a lookalike written here.
// `@kanzo-tech/ui` never sees any of it; the admission rule bars RDF from the library, and a
// showcase is where specificity is allowed to live.

import { SLIP_SHAPE } from "./shape";

const XSD = "http://www.w3.org/2001/XMLSchema#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SLIP_CLASS = "https://kanzo.tech/ns/sighting#SightingSlip";
const ROW_BASE = "https://kanzo.tech/row/";

/**
 * How a row's subject IRI is minted.
 *
 * A row and a graph neighbourhood are the same object seen twice, and the W3C standardises BOTH
 * directions — but with two different specs, and only one of them is ours:
 *
 * - table → RDF is CSVW's *Generating RDF from Tabular Data* (Rec 2015), where `aboutUrl` mints
 *   the subject and `propertyUrl` the predicate. That is the direction **fossil** runs, and it is
 *   why fossil takes CSVW as an input descriptor. It is not this file's direction.
 * - RDF → table is *SPARQL 1.1 Query Results CSV/TSV* (Rec 2013): one row per solution, one
 *   column per projected variable. That IS our direction, and `toCsv` is shaped like it.
 *
 * Neither spec mints our subject for us, so it is stated here rather than guessed. The slip
 * number is the identity, which is what makes the graph worth having: read the same photograph
 * twice and the two runs merge instead of doubling. A row without one yet — freshly added by hand,
 * or a slip the model could not read — falls back to its local id, which is honest: it has no
 * identity, and nothing should merge on it.
 */
const IDENTITY = "slip";
const subjectOf = (row: Row) => {
  const key = row.cells[IDENTITY];
  return `${ROW_BASE}${key ? `slip/${key}` : `local/${row.id}`}`;
};

/** The four lexical shapes a cell can carry, straight off `sh:datatype`. */
export type CellType = "date" | "string" | "decimal" | "integer";

/** One column, projected out of one `sh:property`. Nothing here is authored twice. */
export interface Column {
  /** The property path's local name — the key a `Row` holds its cell under. */
  key: string;
  iri: string;
  /** `sh:name`, and the header the CSV writes. */
  label: string;
  /** `sh:description` — what tells the model which value on the paper is this one. The hall
   *  prints a standing rate and a bounty paid; only this sentence says which one `bounty` means. */
  description?: string;
  /** `sh:order`, and the column order everywhere. */
  order: number;
  type: CellType;
  /** `sh:pattern`, when the value has a printed format. */
  pattern?: string;
  /** `sh:in` — a closed vocabulary, which is also the select's options. */
  options?: string[];
  /** `sh:minCount >= 1`. A missing required cell is a violation, which is how a cell the model
   *  could not read reaches the screen at all. */
  required: boolean;
}

/** A row of the ledger. A cell is the string a human would type; "" means absent. */
export interface Row {
  id: string;
  cells: Record<string, string>;
}

export type Severity = "violation" | "warning" | "info";

export interface Issue {
  rowId: string;
  /** The column's `key`, or "" for a whole-row finding. */
  key: string;
  message: string;
  severity: Severity;
  /** The `sh:sourceConstraintComponent` local name — `Pattern`, `MinCount`, `In`, `Datatype`… */
  constraint: string;
}

export interface Ledger {
  columns: Column[];
  validate: (rows: Row[]) => Issue[];
  /** The rows as Turtle — the same graph the validator just ran on. */
  turtle: (rows: Row[]) => string;
  /**
   * The rows read back OUT of that graph, one solution per subject and one column per `sh:path`
   * in `sh:order` — the projection the CSV is written from.
   *
   * This is the trip the showcase claims to make, so it makes it: the writer does not read the
   * editable `Row[]` and call the result a serialisation of RDF. A star of fixed arity and a table
   * row are the same object, and this is the function that says so out loud.
   */
  table: (rows: Row[]) => Row[];
}

// ── The shape's IR, as it crosses the wasm boundary ──────────────────────────
// Only the parts this showcase reads. `metadata-form`'s `ShapeIR` is the full one.

interface IrTerm {
  termType: string;
  value: string;
}

interface IrProperty {
  path: { kind: string; iri: string };
  cardinality?: { min?: number; max?: number };
  value?: { datatype?: string; pattern?: string; in?: IrTerm[] };
  logical?: { in?: IrTerm[] };
  presentation?: {
    names?: { value: string; language: string }[];
    descriptions?: { value: string; language: string }[];
    order?: number;
  };
}

interface IrShapeModel {
  nodeShapes: { id: string; properties: IrProperty[] }[];
}

interface RudofResult {
  focusNode: IrTerm;
  path?: IrTerm;
  value?: IrTerm;
  message: string[];
  severity?: string;
  sourceConstraintComponent?: string;
}

interface RudofQuad {
  subject: IrTerm;
  predicate: IrTerm;
  object: IrTerm;
}

interface RudofSession {
  loadShapes: (text: string, mediaType: string) => IrShapeModel;
  newData: () => void;
  add: (s: unknown, p: unknown, o: unknown) => void;
  /** Pattern match over the in-wasm store; a null position is a wildcard. */
  quads: (s: unknown, p: unknown, o: unknown) => RudofQuad[];
  serialize: (mediaType: string) => string;
  validate: (shapeId: string | null) => { conforms: boolean; results: RudofResult[] };
}

const local = (iri: string) => iri.slice(Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/")) + 1);

function cellType(datatype: string | undefined): CellType {
  switch (datatype) {
    case `${XSD}date`:
      return "date";
    case `${XSD}decimal`:
      return "decimal";
    case `${XSD}integer`:
      return "integer";
    default:
      return "string";
  }
}

function toColumn(p: IrProperty): Column {
  const iri = p.path.iri;
  const options = (p.value?.in ?? p.logical?.in)?.map((t) => t.value);
  return {
    key: local(iri),
    iri,
    label: p.presentation?.names?.[0]?.value ?? local(iri),
    description: p.presentation?.descriptions?.[0]?.value,
    order: p.presentation?.order ?? Number.MAX_SAFE_INTEGER,
    type: cellType(p.value?.datatype),
    pattern: p.value?.pattern,
    options: options?.length ? options : undefined,
    required: (p.cardinality?.min ?? 0) >= 1,
  };
}

// ── Lexical forms ────────────────────────────────────────────────────────────

/** What the cell holds is what a Spanish keyboard types; what the graph holds is the XSD lexical
 *  form. A comma that stays a comma is a `Datatype` violation, which is the correct answer for
 *  "12,3,4" and the wrong one for "46,02" — so the comma is normalised and nothing else is. */
function lexical(value: string, type: CellType): string {
  return type === "decimal" ? value.replace(",", ".") : value;
}

/** The inverse, for the trip back out of the graph. Two functions rather than one because the two
 *  forms are genuinely different: `46.02` is what `xsd:decimal` requires and `46,02` is what the
 *  keyboard and the spreadsheet use. */
function display(value: string, type: CellType): string {
  return type === "decimal" ? value.replace(".", ",") : value;
}

const literal = (value: string, type: CellType) => ({
  termType: "Literal",
  value,
  datatype: `${XSD}${type}`,
});

const named = (value: string) => ({ termType: "NamedNode", value });

// ── The engine ───────────────────────────────────────────────────────────────

let sessionOnce: Promise<RudofSession> | undefined;

/** Instantiate the wasm once, and only on success — caching a rejected promise would leave every
 *  later mount permanently broken with no recovery but a reload. */
async function session(): Promise<RudofSession> {
  if (!sessionOnce) {
    const attempt = (async () => {
      const wasm = await import("@kanzo-tech/rudof-wasm");
      await wasm.default();
      return new wasm.Session() as unknown as RudofSession;
    })();
    sessionOnce = attempt;
    attempt.catch(() => {
      if (sessionOnce === attempt) sessionOnce = undefined;
    });
  }
  return sessionOnce;
}

/**
 * The engine's default message and the shape's `sh:message` arrive in one array with nothing
 * marking which is which, and the order is not stable. This is the single place the code guesses:
 * every message rudof writes itself says "not satisfied", and none of the shape's do.
 */
const spoken = (messages: string[]) =>
  messages.find((m) => !m.includes("not satisfied")) ?? messages[0] ?? "No cumple la forma.";

const severityOf = (iri: string | undefined): Severity =>
  iri?.endsWith("Warning") ? "warning" : iri?.endsWith("Info") ? "info" : "violation";

/** Parse the shape and return the ledger it describes. */
export async function openLedger(shape: string = SLIP_SHAPE): Promise<Ledger> {
  const s = await session();
  const model = s.loadShapes(shape, "text/turtle");
  const columns = (model.nodeShapes[0]?.properties ?? [])
    .map(toColumn)
    .sort((a, b) => a.order - b.order);
  const byKey = new Map(columns.map((c) => [c.key, c]));

  const load = (rows: Row[]) => {
    s.newData();
    for (const row of rows) {
      const focus = named(subjectOf(row));
      s.add(focus, named(RDF_TYPE), named(SLIP_CLASS));
      for (const column of columns) {
        const value = row.cells[column.key] ?? "";
        if (!value) continue; // absent, which is what `sh:minCount` is for
        s.add(focus, named(column.iri), literal(lexical(value, column.type), column.type));
      }
    }
  };

  return {
    columns,
    validate(rows) {
      load(rows);
      const bySubject = new Map(rows.map((row) => [subjectOf(row), row.id]));
      return s.validate(null).results.map((r) => ({
        rowId: bySubject.get(r.focusNode.value) ?? r.focusNode.value,
        key: r.path ? (byKey.has(local(r.path.value)) ? local(r.path.value) : "") : "",
        message: spoken(r.message),
        severity: severityOf(r.severity),
        constraint: local(r.sourceConstraintComponent ?? "").replace("ConstraintComponent", ""),
      }));
    },
    turtle(rows) {
      load(rows);
      return s.serialize("text/turtle");
    },
    table(rows) {
      load(rows);
      return rows.map((row) => {
        const focus = named(subjectOf(row));
        const cells: Record<string, string> = {};
        for (const column of columns) {
          // `sh:maxCount 1` on every property is what makes taking the first quad honest. A shape
          // that dropped it would need the CSV to decide between repeating the row, joining the
          // values, or spilling to a second table — which is the point where a flat file stops
          // being able to hold the graph.
          const [quad] = s.quads(focus, named(column.iri), null);
          cells[column.key] = quad ? display(quad.object.value, column.type) : "";
        }
        return { id: row.id, cells };
      });
    },
  };
}
