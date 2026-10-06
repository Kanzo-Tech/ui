"use client";

import { Selection, bridgeSelection, type ClauseMap, type TableExpr } from "@kanzo-tech/mosaic";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { inBand, newTile, placeTile } from "./tile-kinds.js";
import { TileView, tileSpan } from "./tile-views.js";
import { autoDashboard, edited, plotRelation, type DashboardSpec, type Tile } from "./dashboard-spec.js";
import { useFieldStats, type FieldStat } from "./field-stats.js";

export interface DashboardProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The relation every filter and tile reads — a table, or a `relationQuery` over a join graph. */
  table: TableExpr;
  /**
   * The saved dashboard. `undefined` draws the automatic one from the relation's field stats —
   * which is what a host persists nothing for until somebody edits it.
   */
  value?: DashboardSpec;
  /**
   * Makes everything editable. Called with the whole next spec — the automatic one included, on the
   * first edit — or with `undefined` when the dashboard goes back to automatic: the host deletes
   * what it stored for this relation, and the dashboard follows the stats again.
   */
  onChange?: (spec: DashboardSpec | undefined) => void;
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
 * a band of figures, then charts and tables in a three-column grid — every one of them on the provider's
 * crossfilter. The host brings the `MosaicProvider`, the relation and somewhere to keep the spec;
 * the fields, the automatic layout and the editor are this component's.
 */
export function Dashboard(props: DashboardProps) {
  const { table, value, onChange, exclude, config, rowNoun, publish, className, slot, ...rest } = props;
  const { fields, columns, error } = useFieldStats(table, { exclude });
  const page = useMosaic();
  const [own] = useState(() => Selection.crossfilter());
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
      <Bridge map={publish} to={page.crossfilter} />
      {body}
    </MosaicProvider>
  ) : (
    body
  );
}

/**
 * The dashboard's crossfilter, bridged to the page's. Inside the dashboard's provider, so retracting
 * the page's clause is the provider's `retract`: it resets the tiles' own selections too, which a
 * reset of the crossfilter alone never reaches.
 */
function Bridge({ to, map }: { to: Selection; map: ClauseMap }) {
  const { crossfilter, retract } = useMosaic();
  useEffect(() => bridgeSelection(crossfilter, to, map, { retract }), [crossfilter, to, map, retract]);
  return null;
}

/**
 * The editor, loaded the first time somebody edits. A read-only dashboard never fetches its code —
 * the kind picker, the field pickers, `Select`, `Listbox` and `RadioGroup` — and a
 * `dashboard-layering.test.ts` holds that against this module's static imports.
 */
const TileEditor = lazy(() => import("./tile-editor.js").then((m) => ({ default: m.TileEditor })));

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
  onChange?: (spec: DashboardSpec | undefined) => void;
  config?: Readonly<Record<string, ChartConfig>>;
  rowNoun?: string;
}) {
  const auto = useMemo(() => autoDashboard(fields), [fields]);
  const spec = value ?? auto;
  // The tile in the editor; one `spec.tiles` does not hold is being added.
  const [editing, setEditing] = useState<Tile | null>(null);
  const band = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const edit = onChange && ((patch: Partial<DashboardSpec>) => onChange({ ...spec, ...patch }));

  const save = (tile: Tile, position: number) => {
    edit?.({ tiles: placeTile(spec.tiles, edited(spec.tiles.find((t) => t.id === tile.id), tile), position) });
    setEditing(null);
  };
  const add = () => {
    // The one place an id is minted: everything below it is pure.
    const id = globalThis.crypto.randomUUID();
    const tile = newTile("chart", fields, spec.tiles, id) ?? newTile("stat", fields, spec.tiles, id);
    if (tile) setEditing(tile);
  };
  const open = edit && ((tile: Tile) => () => setEditing(tile));
  // A tile being added has a slot of its own at the end of its band or grid, so its popover has
  // somewhere to anchor; a tile whose kind changes moves to the other one with its draft.
  const slots = editing && !spec.tiles.some((t) => t.id === editing.id) ? [...spec.tiles, editing] : spec.tiles;
  const shownIn = (band: boolean) => slots.filter((t) => inBand(editing?.id === t.id ? editing : t) === band);
  const groups = [
    // The figures share one row, equally, and wrap when they run out of room.
    { name: "dashboard-figures", tiles: shownIn(true), ref: band, className: "grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4" },
    { name: "dashboard-tiles", tiles: shownIn(false), ref: grid, className: "grid gap-4 @3xl/dashboard:grid-cols-2 @6xl/dashboard:grid-cols-3" },
  ];

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
                <MenuItem disabled={value === undefined} onSelect={() => onChange?.(undefined)} value="reset">
                  Reset to automatic
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        ) : null}
      </DashboardFilters>

      {groups.map(({ name, tiles, ref, className }) =>
        tiles.length > 0 ? (
          <div className={className} data-slot={name} key={name} ref={ref}>
            {tiles.map((tile) => {
              // The tile being edited draws its draft, in the same slot and the same view, so opening
              // the editor neither remounts it nor queries again.
              const shown = editing?.id === tile.id ? editing : tile;
              return (
                <TileView
                  className={inBand(shown) ? undefined : tileSpan(shown.span)}
                  config={config}
                  fields={fields}
                  key={tile.id}
                  onEdit={open?.(tile)}
                  table={table}
                  tile={shown}
                />
              );
            })}
          </div>
        ) : null,
      )}

      {edit && editing ? (
        <Suspense fallback={null}>
          <TileEditor
            anchor={() => {
              const { ref, tiles } = groups[inBand(editing) ? 0 : 1]!;
              return (ref.current?.children[tiles.findIndex((t) => t.id === editing.id)] as HTMLElement | undefined) ?? null;
            }}
            fields={fields}
            key={editing.id}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onRemove={() => {
              edit({ tiles: spec.tiles.filter((t) => t.id !== editing.id) });
              setEditing(null);
            }}
            onSave={save}
            tile={editing}
            tiles={spec.tiles}
          />
        </Suspense>
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
