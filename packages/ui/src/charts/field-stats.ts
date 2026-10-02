"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { jsType, type Coordinator } from "@uwdata/mosaic-core";
import { useEffect, useState } from "react";
import { chartTableKey } from "./chart-spec.js";
import { useMosaic } from "./mosaic-provider.js";

/**
 * What a relation's columns can do in a dashboard, read from one DuckDB `SUMMARIZE`.
 *
 * The type words are Mosaic's own `jsType`, so a column is numeric here exactly when it is numeric
 * to every mark and input on this subpath. A type `jsType` does not know (an interval, a bit
 * string) or one no chart can draw (a list, a struct, a blob) is not a field at all.
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

/** One `SUMMARIZE` row; the columns DuckDB names, as the coordinator returns them. */
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
  const parsed = kind === "numeric" ? Number(text) : Date.parse(text.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The fields of a relation, from its `SUMMARIZE` rows. */
export function fieldStats(rows: readonly SummarizeRow[], options: FieldStatsOptions = {}): FieldStat[] {
  const hidden = new Set(options.exclude);
  const total = Math.max(0, ...rows.map((row) => Number(row.count ?? 0)));
  return rows.flatMap((row) => {
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
}

/**
 * Ask the coordinator for a relation's fields. `SUMMARIZE` has no mosaic-sql builder, so this is
 * the one statement on the subpath written as text; the relation is the same identifier every
 * query here keys on.
 */
export async function queryFieldStats(
  coordinator: Coordinator,
  table: TableExpr,
  options?: FieldStatsOptions,
): Promise<FieldStats> {
  const rows = Array.from((await coordinator.query(`SUMMARIZE ${chartTableKey(table)}`)) as Iterable<SummarizeRow>);
  return { fields: fieldStats(rows, options), columns: rows.map((row) => String(row.column_name)) };
}

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
  error: Error | null;
}

/** `queryFieldStats` on the provider's coordinator, re-asked when the relation changes. */
export function useFieldStats(table: TableExpr, options?: FieldStatsOptions): FieldStatsState {
  const { coordinator } = useMosaic();
  const [state, setState] = useState<FieldStatsState>({ fields: null, columns: null, error: null });
  const key = chartTableKey(table);
  const exclude = (options?.exclude ?? []).join("\u0000");

  useEffect(() => {
    let live = true;
    setState({ fields: null, columns: null, error: null });
    queryFieldStats(coordinator, table, { exclude: exclude ? exclude.split("\u0000") : [] }).then(
      (stats) => live && setState({ ...stats, error: null }),
      (error: unknown) =>
        live &&
        setState({ fields: null, columns: null, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
    // `key` and `exclude` stand in for the identities of `table` and `options`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator, key, exclude]);

  return state;
}
