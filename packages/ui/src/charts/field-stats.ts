"use client";

import { type TableExpr, jsType, type Coordinator, Query, sql } from "@kanzo-tech/mosaic";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { chartTableKey } from "./chart-spec.js";
import { useMosaic } from "./mosaic-provider.js";

/**
 * What a relation's columns can do in a dashboard, read from one DuckDB `SUMMARIZE`.
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
 * something to aggregate, and an `identifier` names a row: an `id`, a URI, a value nearly every row
 * has its own of. Identifiers are searched, never grouped.
 */
export type FieldRole = "dimension" | "measure" | "identifier";

export interface FieldStat {
  name: string;
  /** DuckDB's type for the column, as `SUMMARIZE` reports it. */
  type: string;
  kind: FieldKind;
  role: FieldRole;
  /** `approx_unique`: an estimate, which is all a default needs. */
  distinct: number;
  /** The extent of a numeric or temporal field — a temporal one in epoch milliseconds. */
  min?: number;
  max?: number;
}

export interface FieldStatsOptions {
  /** Columns that are the host's bookkeeping rather than data: a key, a layout's coordinates. */
  exclude?: readonly string[];
}

/** One `SUMMARIZE` row, under the column names DuckDB gives it. */
export interface SummarizeRow {
  column_name: unknown;
  column_type: unknown;
  approx_unique: unknown;
  min: unknown;
  max: unknown;
  count: unknown;
}

const ID_NAME = /(^id$|_id$|Id$|^uri$|^iri$)/;

/** A category with more values than this reads as a key, not as something to group by. */
const DIMENSION_LIMIT = 50;

function kindOf(type: string): FieldKind | null {
  let js: string;
  try {
    js = jsType(type);
  } catch {
    return null;
  }
  if (js === "number") return "numeric";
  if (js === "date") return "temporal";
  if (js === "string" || js === "boolean") return "categorical";
  return null;
}

function roleOf(name: string, kind: FieldKind, distinct: number, rows: number): FieldRole {
  if (ID_NAME.test(name)) return "identifier";
  if (kind === "numeric") return "measure";
  if (kind === "temporal") return "dimension";
  return distinct <= DIMENSION_LIMIT || distinct < rows / 2 ? "dimension" : "identifier";
}

function extent(kind: FieldKind, value: unknown): number | undefined {
  if (value == null || kind === "categorical") return undefined;
  const text = String(value);
  // DuckDB prints a whole-hour offset as `+02`, which `Date.parse` rejects without its minutes.
  const parsed = kind === "numeric" ? Number(text) : Date.parse(text.replace(" ", "T").replace(/(:\d{2}(?:\.\d+)?[+-]\d{2})$/, "$1:00"));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * A relation's fields and columns from `SUMMARIZE` rows — what `useFieldStats` reads, or rows a host
 * fetched itself with its own connection.
 */
export function fieldStats(rows: readonly SummarizeRow[], options: FieldStatsOptions = {}): FieldStats {
  const hidden = new Set(options.exclude);
  const total = Math.max(0, ...rows.map((row) => Number(row.count ?? 0)));
  const fields = rows.flatMap((row) => {
    const name = String(row.column_name);
    const type = String(row.column_type);
    const kind = kindOf(type);
    if (!kind || hidden.has(name)) return [];
    const distinct = Number(row.approx_unique ?? 0);
    const field: FieldStat = { name, type, kind, role: roleOf(name, kind, distinct, total), distinct };
    const [min, max] = [extent(kind, row.min), extent(kind, row.max)];
    if (min !== undefined && max !== undefined) Object.assign(field, { min, max });
    return [field];
  });
  return { fields, columns: rows.map((row) => String(row.column_name)) };
}

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
 * A relation's fields, read with one `SUMMARIZE` on the provider's coordinator — a TanStack Query
 * query on the host's `QueryClient`, so every part of the page that asks for the same relation
 * shares one read (`/docs/design/reads`). The read is the relation's, and `exclude` is applied to
 * it afterwards, so two parts that hide different columns still read once.
 *
 * It never retries, and it is kept for the page's life: a new relation is a new key, and a failure
 * is not kept, so the next part to ask reads again. Without a `QueryClientProvider` above it, it
 * throws TanStack's own *No QueryClient set*.
 */
export function useFieldStats(table: TableExpr, options?: FieldStatsOptions): FieldStatsState {
  const { coordinator, onFailure } = useMosaic();
  const exclude = (options?.exclude ?? []).join("\u0000");
  const select = useCallback(
    (rows: readonly SummarizeRow[]) => fieldStats(rows, { exclude: exclude ? exclude.split("\u0000") : [] }),
    [exclude],
  );
  const read = useQuery({
    // The keys are the library's, not an API: what was read, and on which coordinator.
    queryKey: ["@kanzo-tech/ui", "summarize", coordinatorKey(coordinator), chartTableKey(table)],
    queryFn: async ({ signal }) => {
      // The coordinator takes a statement as a string or a `Query`; a fragment is neither, and
      // renders to the same text either way.
      const result = coordinator.query(String(summarizeQuery(table)));
      // Every part that asked has gone: a read still queued is taken off the coordinator's queue.
      signal.addEventListener("abort", () => coordinator.cancel([result]), { once: true });
      return Array.from((await result) as Iterable<SummarizeRow>);
    },
    select,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const error: unknown = read.error;
  useEffect(() => {
    if (error) onFailure(error);
  }, [error, onFailure]);

  if (read.data) return { ...read.data, error: null };
  return { fields: null, columns: null, error: error ?? null };
}
