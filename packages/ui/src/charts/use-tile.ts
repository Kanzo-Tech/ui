"use client";

import { type TableExpr } from "@kanzo-tech/mosaic";
import { JoinResolver, type RelationExpr, type RelationRef } from "@kanzo-tech/relations";
import { useMemo } from "react";
import { chartTableKey } from "./chart-spec.js";
import { tileQuery, type Tile, type TileQuery } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useMosaic, useRelation } from "./mosaic-provider.js";

/**
 * A tile on the page, compiled once (`tileQuery`) against the relation its part is pointed at and
 * the page's resolver: what a chart's marks, a figure and a table read. The relation as the page
 * knows it comes back beside it, so a part reading the narrowed SQL is still a client of that
 * relation.
 */
export function useTile(expr: RelationExpr, tile: Tile, fields: readonly FieldStat[]): { query: TileQuery; relation: RelationRef | null; table: TableExpr } {
  const { selection } = useMosaic();
  const read = useRelation(expr);
  const table = read.table!;
  const resolver = selection.resolver instanceof JoinResolver ? selection.resolver : undefined;
  // What the tile reads, without what only names or places it.
  const key = JSON.stringify({ ...tile, id: undefined, title: undefined, span: undefined, origin: undefined });
  const relationKey = JSON.stringify(read.relation);
  const query = useMemo(
    () => tileQuery(table, tile, { fields, relation: read.relation, resolver }),
    // `chartTableKey`, `key` and `relationKey` stand in for the identities of `table`, `tile` and the relation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartTableKey(table), key, relationKey, fields, resolver],
  );
  return { query, relation: read.relation, table };
}
