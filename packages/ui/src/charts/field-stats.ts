"use client";

import type { Graph, Pattern, Stats } from "@kanzo-tech/graphar-duckdb";
import { jsType } from "@kanzo-tech/mosaic";
import { useMemo } from "react";
import { useMosaic } from "./mosaic-provider.js";

/**
 * **What a pattern's columns can do in a dashboard**, from what the graph says of them — never from a
 * column's name or a threshold (`/docs/design/fields`).
 *
 * What a column is comes from its property, as the `Graph` describes it: its DuckDB type and whether it
 * is its type's primary key. What it holds comes from the property's `stats`, which the chunks'
 * Parquet `Statistics` state — the nulls, the extent and the distinct count. Nothing is read: a
 * property the statistics say nothing of is a field with no count and no extent.
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
 * something to aggregate, and an `identifier` names a row: its type's primary key. Identifiers are
 * searched, never grouped.
 */
export type FieldRole = "dimension" | "measure" | "identifier";

export interface FieldStat {
  /** `variable.property`: `u.name`. */
  name: string;
  /** DuckDB's type for the column. */
  type: string;
  kind: FieldKind;
  role: FieldRole;
  /**
   * Its distinct values, as the statistics bound them: the exact count, or the least the chunks allow
   * where they only bound it; 0 where they say nothing.
   */
  distinct: number;
  /** The extent of a numeric or temporal field — a temporal one in epoch milliseconds. */
  min?: number;
  max?: number;
}

export interface FieldStatsOptions {
  /** Columns that are the host's bookkeeping rather than data: a key, a layout's coordinates. */
  exclude?: readonly string[];
}

/** A column as `fieldStats` reads it: its name in the relation, its DuckDB type, whether it is a key, and its statistics. */
export interface FieldColumn {
  readonly name: string;
  readonly type: string;
  readonly primary?: boolean;
  readonly stats?: Stats;
}

/**
 * **A pattern's columns, described** — what `relationOver` reads: a column per named vertex holding
 * its index, which is no field, then one per property of every named element, `variable.property`,
 * as the `Graph` describes the property.
 */
export function patternColumns(graph: Graph, pattern: Pattern): { columns: string[]; described: FieldColumn[] } {
  const named = pattern.filter((element) => element.as !== undefined);
  const vertices = named.flatMap((element) => ("type" in element ? [element.as!] : []));
  const described = named.flatMap((element) => {
    const of = "type" in element ? graph.vertexTypes.find((t) => t.type === element.type) : undefined;
    return (of?.properties ?? []).map((p) => ({
      name: `${element.as}.${p.name}`,
      type: p.type,
      primary: p.primary,
      ...(p.stats === undefined ? {} : { stats: p.stats }),
    }));
  });
  return { columns: [...vertices, ...described.map((c) => c.name)], described };
}

function kindOf(column: FieldColumn): FieldKind | null {
  let js: string;
  try {
    js = jsType(column.type);
  } catch {
    return null;
  }
  return js === "number" ? "numeric" : js === "date" ? "temporal" : js === "string" || js === "boolean" ? "categorical" : null;
}

function roleOf(column: FieldColumn, kind: FieldKind): FieldRole {
  if (column.primary) return "identifier";
  return kind === "numeric" ? "measure" : "dimension";
}

/** An extent, from a bound's text: a number's, a time's in epoch milliseconds. */
function extent(kind: FieldKind, value: string | undefined): number | undefined {
  if (value === undefined || kind === "categorical") return undefined;
  if (kind === "numeric") return finite(Number(value));
  // DuckDB prints a whole-hour offset as `+02`, which `Date.parse` rejects without its minutes.
  return finite(Date.parse(value.replace(" ", "T").replace(/(:\d{2}(?:\.\d+)?[+-]\d{2})$/, "$1:00")));
}

const finite = (n: number) => (Number.isFinite(n) ? n : undefined);

/** The distinct count the statistics state, or the least they allow. */
const distinctOf = (stats: Stats | undefined) => (stats?.distinct === undefined ? 0 : "exact" in stats.distinct ? stats.distinct.exact : stats.distinct.atLeast);

/**
 * **Fields from columns' descriptions**: a field's kind is its type's; it is an identifier when it is
 * its type's primary key, and otherwise a number is a measure and the rest a dimension. Nothing is
 * queried and nothing is guessed.
 */
export function fieldStats(described: readonly FieldColumn[], options: FieldStatsOptions = {}): FieldStat[] {
  const hidden = new Set(options.exclude);
  return described.flatMap((column) => {
    const kind = kindOf(column);
    if (!kind || hidden.has(column.name)) return [];
    const field: FieldStat = { name: column.name, type: column.type, kind, role: roleOf(column, kind), distinct: distinctOf(column.stats) };
    const [min, max] = [extent(kind, column.stats?.min), extent(kind, column.stats?.max)];
    if (min !== undefined && max !== undefined) Object.assign(field, { min, max });
    return [field];
  });
}

export interface FieldStats {
  fields: FieldStat[];
  /** Every column of the relation, fields or not, in its own order. */
  columns: string[];
}

/**
 * **A pattern's fields**, over the page's graph — what `Dashboard` reads. Nothing is read: the
 * descriptions and the counts are the `Graph`'s. Throws where the page has no graph.
 */
export function useFieldStats(pattern: Pattern, options?: FieldStatsOptions): FieldStats {
  const { graph } = useMosaic();
  const exclude = (options?.exclude ?? []).join("\u0000");
  const key = JSON.stringify(pattern);
  return useMemo(() => {
    if (!graph) throw new Error("a pattern's fields are its graph's, and the page has none");
    const { columns, described } = patternColumns(graph, pattern);
    return { fields: fieldStats(described, { exclude: exclude ? exclude.split("\u0000") : [] }), columns };
    // `key` stands in for the identity of `pattern`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, key, exclude]);
}
