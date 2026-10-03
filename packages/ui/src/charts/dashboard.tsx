"use client";

import { Selection, bridgeSelection, type ClauseMap, type TableExpr } from "@kanzo-tech/mosaic";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Skeleton } from "../simples/skeleton.js";
import type { ChartConfig } from "./chart-config.js";
import { MosaicProvider, useMosaic } from "./mosaic-provider.js";
import { DashboardFilters } from "./dashboard-filters.js";
import { chartTableKey } from "./chart-spec.js";
import { TileView } from "./tile-kinds.js";
import { TileEditor } from "./tile-editor.js";
import { autoDashboard, newTile, plotRelation, type DashboardSpec, type Tile, type TileSpan } from "./dashboard-spec.js";
import { useFieldStats, type FieldStat } from "./field-stats.js";

export interface DashboardProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The relation every filter and tile reads — a table, or a `relationQuery` over a join graph. */
  table: TableExpr;
  /**
   * The saved dashboard. `undefined` draws the automatic one from the relation's field stats —
   * which is what a host persists nothing for until somebody edits it.
   */
  value?: DashboardSpec;
  /** Makes everything editable; called with the whole next spec, the automatic one included. */
  onChange?: (spec: DashboardSpec) => void;
  /** Columns that are the host's bookkeeping rather than data. */
  exclude?: readonly string[];
  /** Series vocabulary per field, for a field drawn as `color`. See `ChartCard`. */
  config?: Readonly<Record<string, ChartConfig>>;
  /** What a row is, in the plural. Default `"rows"`. */
  rowNoun?: string;
  /**
   * What the page sees of the dashboard's clauses. Without it they are the page's own clauses, which
   * only a client of the same columns can answer. With it the tiles crossfilter each other in a
   * selection of the dashboard's, and the page gets the one clause this maps them to — for a relation
   * keyed by a vertex identity, `semiJoinOf(key, table)` — so a graph or another relation beside the
   * dashboard is filtered by what the tiles show. The page's clauses still reach every tile. Keep it
   * memoised: a new function republishes.
   */
  publish?: ClauseMap;
}

/**
 * A whole dashboard from a relation and, optionally, a saved spec: the filter bar and the tiles —
 * figures, charts and tables in one three-column grid — every one of them on the provider's
 * crossfilter. The host brings the `MosaicProvider`, the relation and somewhere to keep the spec;
 * the fields, the automatic layout and the editor are this component's.
 */
export function Dashboard(props: DashboardProps) {
  const { table, value, onChange, exclude, config, rowNoun, publish, className, slot, ...rest } = props;
  const { fields, columns, error } = useFieldStats(table, { exclude });
  const page = useMosaic();
  const [own] = useState(() => Selection.crossfilter());
  useEffect(() => (publish ? bridgeSelection(own, page.crossfilter, publish) : undefined), [own, page.crossfilter, publish]);
  // Everything below reads the relation the plots can: see `plotRelation`.
  const readable = useMemo(
    () =>
      fields && columns
        ? plotRelation(table, { fields, columns })
        : null,
    // `chartTableKey` stands in for the identity of `table`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, columns, chartTableKey(table)],
  );

  const body = (
    <ark.div className={cn("@container/dashboard flex flex-col gap-4", className)} {...rest} data-slot={slot ?? "dashboard"}>
      {error !== null ? (
        <Alert variant="destructive">
          <AlertTitle>The relation could not be summarized</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      ) : readable === null ? (
        <DashboardSkeleton />
      ) : (
        <Board
          config={config}
          fields={readable.fields}
          onChange={onChange}
          rowNoun={rowNoun}
          table={readable.table}
          value={value}
        />
      )}
    </ark.div>
  );
  return publish ? (
    <MosaicProvider coordinator={page.coordinator} crossfilter={own} onFailure={page.onFailure}>
      {body}
    </MosaicProvider>
  ) : (
    body
  );
}

// Container queries on `Dashboard`'s own width, not the viewport's: beside a dock or in a pane the
// grid is narrower than the screen, and the screen is the wrong thing to measure.
const SPAN: Record<TileSpan, string> = {
  1: "",
  2: "@3xl/dashboard:col-span-2",
  3: "@3xl/dashboard:col-span-2 @6xl/dashboard:col-span-3",
};


function Board({
  table,
  fields,
  value,
  onChange,
  config,
  rowNoun,
}: {
  table: TableExpr;
  fields: FieldStat[];
  value?: DashboardSpec;
  onChange?: (spec: DashboardSpec) => void;
  config?: Readonly<Record<string, ChartConfig>>;
  rowNoun?: string;
}) {
  const auto = useMemo(() => autoDashboard(fields), [fields]);
  const spec = value ?? auto;
  // The tile in the editor; one `spec.tiles` does not hold is being added.
  const [editing, setEditing] = useState<Tile | null>(null);
  const edit = onChange && ((patch: Partial<DashboardSpec>) => onChange({ ...spec, ...patch }));

  const save = (tile: Tile, index: number) => {
    const rest = spec.tiles.filter((t) => t.id !== tile.id);
    edit?.({ tiles: [...rest.slice(0, index), tile, ...rest.slice(index)] });
    setEditing(null);
  };
  const add = () => {
    const tile = newTile("chart", fields, spec.tiles) ?? newTile("stat", fields, spec.tiles);
    if (tile) setEditing(tile);
  };
  const open = edit && ((tile: Tile) => () => setEditing(tile));

  return (
    <>
      <DashboardFilters
        fields={fields}
        filters={spec.filters}
        onChange={edit && ((filters) => edit({ filters }))}
        rowNoun={rowNoun}
        table={table}
      >
        {edit ? (
          <>
            <Button onClick={add} size="sm" variant="outline">
              <PlusIcon />
              Add tile
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button aria-label="Dashboard options" size="icon-sm" variant="ghost">
                  <EllipsisIcon />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem disabled={value === undefined} onSelect={() => edit(auto)} value="reset">
                  Reset to automatic
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        ) : null}
      </DashboardFilters>

      {spec.tiles.length > 0 ? (
        <div className="grid gap-4 @3xl/dashboard:grid-cols-2 @6xl/dashboard:grid-cols-3" data-slot="dashboard-tiles">
          {spec.tiles.map((tile) => (
            <TileView
              className={SPAN[tile.span]}
              config={config}
              fields={fields}
              key={tile.id}
              onEdit={open?.(tile)}
              table={table}
              tile={tile}
            />
          ))}
        </div>
      ) : null}

      {edit ? (
        <TileEditor
          config={config}
          fields={fields}
          onClose={() => setEditing(null)}
          onRemove={() => {
            edit({ tiles: spec.tiles.filter((t) => t.id !== editing?.id) });
            setEditing(null);
          }}
          onSave={save}
          table={table}
          tile={editing}
          tiles={spec.tiles}
        />
      ) : null}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="grid gap-4 @3xl/dashboard:grid-cols-2 @6xl/dashboard:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton className="h-24 w-full rounded-lg" key={i} />
        ))}
        <Skeleton className="h-72 w-full rounded-lg @3xl/dashboard:col-span-2" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </>
  );
}
