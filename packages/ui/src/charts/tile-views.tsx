"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { cn } from "../lib/cn.js";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "../simples/card.js";
import { ChartCard } from "./chart-card.js";
import type { ChartConfig } from "./chart-config.js";
import type { TableTile, Tile, TileKind } from "./dashboard-spec.js";
import { DashboardStat } from "./dashboard-stat.js";
import { DetailTable } from "./detail-table.js";
import { EditTileButton } from "./edit-tile-button.js";
import type { FieldStat } from "./field-stats.js";
import { tileTitle } from "./tile-kinds.js";

/**
 * **How each kind of tile is drawn** — one row per kind, mapped over `TileKind` like `KINDS` and
 * `TILE_EDITORS`, so a kind without a view does not compile. Nothing here edits: the editor is
 * `tile-fields.tsx`, which a read-only dashboard never loads.
 */

/** What a tile is drawn with: the relation, its fields, and an edit button when there is an editor. */
export interface TileViewProps<T extends Tile> {
  table: TableExpr;
  fields: readonly FieldStat[];
  tile: T;
  config?: Readonly<Record<string, ChartConfig>>;
  onEdit?: () => void;
  className?: string;
}

type Views = { [K in TileKind]: { View: (props: TileViewProps<Extract<Tile, { kind: K }>>) => React.ReactNode } };

/** A `TableTile`: the rows under the selection in a titled card. */
function TableCard({ table, fields, tile, onEdit, className }: TileViewProps<TableTile>) {
  return (
    <Card className={cn("[--space:--spacing(4)] min-w-0 gap-3", className)}>
      <CardHeader>
        <CardTitle className="truncate font-medium text-sm">{tileTitle(tile)}</CardTitle>
        {onEdit ? (
          <CardAction className="-my-1">
            <EditTileButton label="Edit table" onClick={onEdit} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <DetailTable columns={tile.columns} fields={fields} table={table} />
      </CardContent>
    </Card>
  );
}

export const TILE_VIEWS: Views = {
  // A figure has no series, so `config` is not passed on.
  stat: {
    View: ({ tile, table, fields, onEdit, className }) => (
      <DashboardStat className={className} fields={fields} onEdit={onEdit} stat={tile} table={table} />
    ),
  },
  chart: { View: ({ tile, ...rest }) => <ChartCard {...rest} card={tile} /> },
  table: { View: TableCard },
};

/** A tile of any kind, drawn by its kind. */
export function TileView(props: TileViewProps<Tile>) {
  const { View } = TILE_VIEWS[props.tile.kind] as { View: (props: TileViewProps<Tile>) => React.ReactNode };
  return <View {...props} />;
}
