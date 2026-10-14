"use client";

import type { RelationExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { cn } from "../lib/cn.js";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "../simples/card.js";
import { ChartCard } from "./chart-card.js";
import type { ChartConfig } from "./chart-config.js";
import type { TableTile, Tile, TileKind, TileSpan } from "./dashboard-spec.js";
import { DashboardStat } from "./dashboard-stat.js";
import { DetailTable } from "./detail-table.js";
import { EditTileButton } from "./edit-tile-button.js";
import type { FieldStat } from "./field-stats.js";
import { tileTitle } from "./tile-kinds.js";
import { MosaicClients } from "./mosaic-provider.js";
import { useTile } from "./use-tile.js";

/**
 * **How each kind of tile is drawn** — one row per kind, mapped over `TileKind` like `KINDS` and
 * `TILE_EDITORS`, so a kind without a view does not compile. Nothing here edits: the editor is
 * `tile-fields.tsx`, which a read-only dashboard never loads.
 */

/** What a tile is drawn with: the relation, its fields, and an edit button when there is an editor. */
export interface TileViewProps<T extends Tile = Tile> {
  /** The relation the tile reads, as `ChartRoot` takes it; the tile narrows it by its own `where` and `top`. */
  relation: RelationExpr;
  fields: readonly FieldStat[];
  tile: T;
  /** Series vocabulary per field, for a chart's `color`. See `ChartCard`. */
  config?: Readonly<Record<string, ChartConfig>>;
  /** Puts an edit button in the header; the host opens the editor. */
  onEdit?: () => void;
  /** The host's own controls in the header, before the pencil — icon buttons, as the pencil is. */
  actions?: React.ReactNode;
  className?: string;
}

type Views = { [K in TileKind]: { View: (props: TileViewProps<Extract<Tile, { kind: K }>>) => React.ReactNode } };

/** A `TableTile`: the rows under the selection, narrowed by the tile's own question, in a titled card. */
function TableCard({ relation, fields, tile, onEdit, actions, className }: TileViewProps<TableTile>) {
  const read = useTile(relation, tile, fields);
  return (
    <Card className={cn("[--space:--spacing(4)] min-w-0 gap-3", className)}>
      <CardHeader>
        <CardTitle className="truncate font-medium text-sm">{tileTitle(tile)}</CardTitle>
        {onEdit || actions ? (
          <CardAction className="-my-1 flex items-center gap-1">
            {actions}
            {onEdit ? <EditTileButton label="Edit table" onClick={onEdit} /> : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {"missing" in read.query ? (
          <p className="text-muted-foreground text-sm">{`The relation has no ${read.query.missing.join(", ")} any more.`}</p>
        ) : (
          <MosaicClients relation={read.relation ?? undefined}>
            <DetailTable columns={tile.columns} fields={fields} relation={read.query.table} />
          </MosaicClients>
        )}
      </CardContent>
    </Card>
  );
}

export const TILE_VIEWS: Views = {
  // A figure has no series, so `config` is not passed on.
  stat: {
    View: ({ tile, relation, fields, onEdit, actions, className }) => (
      <DashboardStat actions={actions} className={className} fields={fields} onEdit={onEdit} relation={relation} stat={tile} />
    ),
  },
  chart: { View: ({ tile, ...rest }) => <ChartCard {...rest} card={tile} /> },
  table: { View: TableCard },
};

// Container queries on `Dashboard`'s own width, not the viewport's: beside a dock or in a pane the
// grid is narrower than the screen, and the screen is the wrong thing to measure. Outside a
// dashboard's container they match nothing.
const SPAN: Record<TileSpan, string> = {
  1: "",
  2: "@3xl/dashboard:col-span-2",
  3: "@3xl/dashboard:col-span-2 @6xl/dashboard:col-span-3",
};

/** The columns of the dashboard's grid a tile of `span` takes — on its view, and on its editor. */
export const tileSpan = (span: TileSpan): string => SPAN[span];

/**
 * **A tile of any kind, drawn by its kind** — `ChartCard`, `DashboardStat`, or the rows in a titled
 * card — over its relation narrowed by the tile's own question. What a dashboard draws each tile with,
 * and what draws a tile made outside one: an answer to a question.
 */
export function TileView(props: TileViewProps<Tile>) {
  const { View } = TILE_VIEWS[props.tile.kind] as { View: (props: TileViewProps<Tile>) => React.ReactNode };
  return <View {...props} />;
}
