"use client";

import {
  type Coordinator,
  type JoinAnnotation,
  type JoinColumn,
  type JoinGraph,
  type Relation,
  type RelationExpr,
  type TableExpr,
  Query,
  jsType,
  relationColumns,
  sql,
} from "@kanzo-tech/mosaic";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { chartTableKey } from "./chart-spec.js";
import { useMosaic, useRelation } from "./mosaic-provider.js";

/**
 * **What a relation's columns can do in a dashboard**, from what the data says of them — never from a
 * column's name or a threshold (`/docs/design/fields`).
 *
 * What a column is comes from its description: over a corpus, the join graph's (`relationColumns`),
 * which is the manifest's; anywhere else, the engine's type alone. What it holds comes from the
 * corpus's profile, the counts its writer took; a relation with none is read with one `SUMMARIZE`.
 *
 * The type words are Mosaic's own `jsType`, so a column is numeric here exactly when it is numeric
 * to every mark and input on this subpath. A type `jsType` does not know (an interval, a bit
 * string) or one no chart can draw (a list, a struct, a blob) is not a field at all.
 *
 * That includes `TIMESTAMP_S`, `TIME WITH TIME ZONE` and `UHUGEINT`, which read as a time and a
 * number: every vgplot mark runs `jsType` on its columns before it queries, and throws on these, so
 * offering one is offering a chart that fails.
 */

/** What an axis can do with a field: bin a range, draw a time axis, or group by value. */
export type FieldKind = "numeric" | "temporal" | "categorical";

/**
 * The part a field plays by default. A `dimension` is something to group or filter by, a `measure`
 * something to aggregate, and an `identifier` names a row: the data says so — a writer's key, an
 * IRI, a column found never null and never repeated. Identifiers are searched, never grouped.
 */
export type FieldRole = "dimension" | "measure" | "identifier";

export interface FieldStat {
  name: string;
  /** DuckDB's type for the column. */
  type: string;
  kind: FieldKind;
  role: FieldRole;
  /** Its distinct values: the profile's exact count, or `SUMMARIZE`'s `approx_unique` where there is none. */
  distinct: number;
  /** The extent of a numeric or temporal field — a temporal one in epoch milliseconds. */
  min?: number;
  max?: number;
  /** Its commonest values, the commonest first, where the corpus's writer counted them. */
  values?: readonly string[];
  /** What the corpus annotates the column with — its `rdfs:label` among them — where it says. */
  annotations?: readonly JoinAnnotation[];
  /** What the field is called, where the data labels it (`relationColumns`): what a title and a chip read it as. */
  label?: string;
}

export interface FieldStatsOptions {
  /** Columns that are the host's bookkeeping rather than data: a key, a layout's coordinates. */
  exclude?: readonly string[];
}

/** A column as `fieldStats` reads it: as described, whether its type's writer found it a key, and what the data calls it. */
export type FieldColumn = JoinColumn & { readonly candidateKey?: boolean; readonly label?: string };

const XSD = "http://www.w3.org/2001/XMLSchema#";
/** The literal datatypes that are a time, whatever the column stores them as: a year is an integer. */
const TEMPORAL_DATATYPES: ReadonlySet<string> = new Set(["date", "dateTime", "gYear", "gYearMonth"].map((t) => `${XSD}${t}`));
/** The writer's roles that name a row rather than say anything of it. */
const IDENTIFYING_ROLES: ReadonlySet<string> = new Set(["address", "identity", "endpoint"]);
/** The term types whose values are names, not values: RML-Core's, which a mapping states, and R2RML's, which a corpus did. */
const NAMING_TERMS: ReadonlySet<string> = new Set(["IRI", "UnsafeIRI", "BlankNode", "rr:IRI", "rr:BlankNode", "http://www.w3.org/ns/r2rml#IRI", "http://www.w3.org/ns/r2rml#BlankNode"]);

function kindOf(column: FieldColumn): FieldKind | null {
  let js: string;
  try {
    js = jsType(column.type);
  } catch {
    return null;
  }
  const kind = js === "number" ? "numeric" : js === "date" ? "temporal" : js === "string" || js === "boolean" ? "categorical" : null;
  // A date or a time by its datatype, stored as a number or a time: `xsd:gYear` over an integer.
  if (kind !== "categorical" && kind !== null && column.datatype && TEMPORAL_DATATYPES.has(column.datatype)) return "temporal";
  return kind;
}

function roleOf(column: FieldColumn, kind: FieldKind): FieldRole {
  if (column.role && IDENTIFYING_ROLES.has(column.role)) return "identifier";
  if (column.termType && NAMING_TERMS.has(column.termType)) return "identifier";
  if (column.candidateKey) return "identifier";
  return kind === "numeric" ? "measure" : "dimension";
}

/** An extent, from a bound's lexical text: a number's, a time's in epoch milliseconds, a year's as its first day. */
function extent(kind: FieldKind, column: FieldColumn, value: string | undefined): number | undefined {
  if (value === undefined || kind === "categorical") return undefined;
  if (kind === "numeric") return finite(Number(value));
  if (jsType(column.type) === "number") return finite(Date.UTC(Number(value), 0, 1));
  // DuckDB prints a whole-hour offset as `+02`, which `Date.parse` rejects without its minutes.
  return finite(Date.parse(value.replace(" ", "T").replace(/(:\d{2}(?:\.\d+)?[+-]\d{2})$/, "$1:00")));
}

const finite = (n: number) => (Number.isFinite(n) ? n : undefined);

/**
 * **A relation's fields and columns from its columns' descriptions** — what `useFieldStats` reads,
 * or descriptions a host has: `relationColumns` over its join graph. Nothing is queried and nothing
 * is guessed: a field's kind is its type's, unless its datatype makes it a time; it is an identifier
 * when the data says so, and otherwise a number is a measure and the rest a dimension.
 */
export function fieldStats(columns: readonly FieldColumn[], options: FieldStatsOptions = {}): FieldStats {
  const hidden = new Set(options.exclude);
  const fields = columns.flatMap((column) => {
    const kind = kindOf(column);
    if (!kind || hidden.has(column.name)) return [];
    const { stats } = column;
    const field: FieldStat = { name: column.name, type: column.type, kind, role: roleOf(column, kind), distinct: stats?.distinctCount ?? 0 };
    const [min, max] = [extent(kind, column, stats?.minValue), extent(kind, column, stats?.maxValue)];
    if (min !== undefined && max !== undefined) Object.assign(field, { min, max });
    if (stats && stats.mostCommonVals.length > 0) field.values = stats.mostCommonVals;
    if (column.annotations?.length) field.annotations = column.annotations;
    if (column.label !== undefined) field.label = column.label;
    return [field];
  });
  return { fields, columns: columns.map((column) => column.name) };
}

/** One `SUMMARIZE` row, under the column names DuckDB gives it. */
interface SummarizeRow {
  column_name: unknown;
  column_type: unknown;
  approx_unique: unknown;
  null_percentage: unknown;
  min: unknown;
  max: unknown;
  count: unknown;
}

/** What a `SUMMARIZE` says a column is and holds: its type, and counts of its own, approximate. */
const summarized = (row: SummarizeRow): FieldColumn => ({
  name: String(row.column_name),
  type: String(row.column_type),
  stats: {
    nullCount: Math.round((parseFloat(String(row.null_percentage ?? 0)) / 100) * Number(row.count ?? 0)) || 0,
    distinctCount: Number(row.approx_unique ?? 0),
    ...(row.min == null ? {} : { minValue: String(row.min) }),
    ...(row.max == null ? {} : { maxValue: String(row.max) }),
    mostCommonVals: [],
    mostCommonFreqs: [],
  },
});

/** DuckDB's `SUMMARIZE` takes a query, so a relation of any shape — a table, a join — is summarized alike. */
const summarizeQuery = (table: TableExpr) => sql`SUMMARIZE ${Query.select("*").from(table)}`;

/**
 * Which coordinator a read was made on, as a key can say it. A key is hashed as JSON, and a
 * coordinator is neither serialisable nor the same across two providers on one client.
 */
const coordinators = new WeakMap<Coordinator, number>();
let coordinatorCount = 0;
const coordinatorKey = (coordinator: Coordinator) => {
  let id = coordinators.get(coordinator);
  if (id === undefined) coordinators.set(coordinator, (id = ++coordinatorCount));
  return id;
};

export interface FieldStats {
  fields: FieldStat[];
  /** Every column of the relation, fields or not, in its own order. */
  columns: string[];
}

export interface FieldStatsState {
  /** The fields, or `null` until the summary lands. */
  fields: FieldStat[] | null;
  /** Every column of the relation, or `null` until the summary lands. */
  columns: string[] | null;
  /** The thrown value, kept whole — and handed to the provider's `onFailure` as well. */
  error: unknown;
}

/**
 * **A relation's fields** — from the page's join graph where the relation is over it and the corpus
 * counted every column, with nothing read; otherwise with one `SUMMARIZE` on the provider's
 * coordinator, the graph's descriptions kept over its counts. The read is a TanStack Query query on
 * the host's `QueryClient`, so every part of the page that asks for the same relation shares one
 * (`/docs/design/reads`), and `exclude` is applied to it afterwards, so two parts that hide different
 * columns still read once.
 *
 * It never retries, and it is kept for the page's life: a new relation is a new key, and a failure
 * is not kept, so the next part to ask reads again. Without a `QueryClientProvider` above it, it
 * throws TanStack's own *No QueryClient set*.
 */
export function useFieldStats(relation: RelationExpr, options?: FieldStatsOptions): FieldStatsState {
  const { coordinator, joins, onFailure } = useMosaic();
  const { table } = useRelation(relation);
  const exclude = (options?.exclude ?? []).join("\u0000");
  const hidden = useMemo(() => (exclude ? exclude.split("\u0000") : []), [exclude]);
  const key = chartTableKey(table!);
  const described = useMemo(() => describe(joins, relation), [joins, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const counted = described !== null && described.length > 0 && described.every((c) => c.stats !== undefined);
  const select = useCallback(
    (rows: readonly SummarizeRow[]) => {
      // The summary's columns, each as the graph describes it where it does, counted where it is not.
      const byName = new Map(described?.map((c) => [c.name, c]));
      const columns = rows.map((row) => {
        const read = summarized(row);
        const given = byName.get(read.name);
        return given ? { ...given, type: given.type || read.type, stats: given.stats ?? read.stats } : read;
      });
      return fieldStats(columns, { exclude: hidden });
    },
    [described, hidden],
  );
  const read = useQuery({
    // The keys are the library's, not an API: what was read, and on which coordinator.
    queryKey: ["@kanzo-tech/ui", "summarize", coordinatorKey(coordinator), key],
    queryFn: async ({ signal }) => {
      // The coordinator takes a statement as a string or a `Query`; a fragment is neither, and
      // renders to the same text either way.
      const result = coordinator.query(String(summarizeQuery(table!)));
      // Every part that asked has gone: a read still queued is taken off the coordinator's queue.
      signal.addEventListener("abort", () => coordinator.cancel([result]), { once: true });
      return Array.from((await result) as Iterable<SummarizeRow>);
    },
    select,
    enabled: !counted,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const known = useMemo(() => (counted ? fieldStats(described!, { exclude: hidden }) : null), [counted, described, hidden]);

  const error: unknown = counted ? null : read.error;
  useEffect(() => {
    if (error) onFailure(error);
  }, [error, onFailure]);

  const data = known ?? read.data;
  if (data) return { ...data, error: null };
  return { fields: null, columns: null, error: error ?? null };
}

/** The relation's columns as the page's join graph describes them, or `null` for a relation it does not hold. */
function describe(joins: JoinGraph | null, relation: RelationExpr): FieldColumn[] | null {
  if (!joins) return null;
  if (typeof relation === "string") return joins.types.some((t) => t.name === relation) ? relationColumns(joins, relation) : null;
  return "root" in relation && "path" in relation ? relationColumns(joins, relation as Relation) : null;
}
