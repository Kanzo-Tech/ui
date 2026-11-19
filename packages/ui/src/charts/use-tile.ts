"use client";

import type { Relation, TableExpr } from "@kanzo-tech/mosaic";
import { useMemo } from "react";
import { chartTableKey } from "./chart-spec.js";
import { tileQuery, type Tile, type TileQuery } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useRelation, type RelationExpr } from "./mosaic-provider.js";

/**
 * A tile on the page, compiled once (`tileQuery`) against the relation its part is pointed at: what a
 * chart's marks, a figure and a table read. The relation as the page knows it comes back beside it, so
 * a part reading the narrowed SQL is still a client of that relation.
 */
export function useTile(expr: RelationExpr, tile: Tile, fields: readonly FieldStat[]): { query: TileQuery; relation: Relation | null; table: TableExpr } {
  const read = useRelation(expr);
  const table = read.table!;
  // What the tile reads, without what only names or places it.
  const key = JSON.stringify({ ...tile, id: undefined, title: undefined, span: undefined, origin: undefined });
  const query = useMemo(
    () => tileQuery(table, tile, { fields, relation: read.relation }),
    // `chartTableKey` and `key` stand in for the identities of `table` and `tile`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartTableKey(table), key, read.relation?.key, fields],
  );
  return { query, relation: read.relation, table };
}
