"use client";

import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import type { TableExpr } from "@kanzo-tech/mosaic";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { ark } from "@ark-ui/react/factory";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import type { ChartConfig } from "./chart-config.js";
import { MosaicClients, useEditorAside, useRelation, useTileEditorOpen } from "./mosaic-provider.js";
import { DashboardFilters } from "./dashboard-filters.js";
import { chartTableKey } from "./chart-spec.js";
import { inBand, newTile, placeTile } from "./tile-kinds.js";
import { TileView, tileSpan } from "./tile-views.js";
import { autoDashboard, edited, plotRelation, type DashboardSpec, type Tile } from "./dashboard-spec.js";
import { useFieldStats, type FieldStat } from "./field-stats.js";

export interface DashboardProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /**
   * The pattern of the provider's graph every filter and tile reads — what a `RelationPicker` gives.
   * Its fields are `variable.property`, described by the graph. Its clauses are published on it, so a
   * graph or another relation beside the dashboard is filtered by what the tiles show; and a clause on
   * another relation reaches every tile the same way.
   */
  relation: Pattern;
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
}

/**
 * A whole dashboard from a relation and, optionally, a saved spec: its filters, drawn in the page's
 * `FilterBar`, and the tiles — a band of figures, then charts and tables in a three-column grid —
 * every one of them on the page's selection, edited in the page's `TileEditorAside`. The host
 * brings the `MosaicProvider`, the relation and somewhere to keep the spec; the fields, the
 * automatic layout and the editor are this component's.
 */
export function Dashboard(props: DashboardProps) {
  const { relation, value, onChange, exclude, config, className, slot, ...rest } = props;
  const read = useRelation(relation);
  const table = read.table as TableExpr;
  const stats = useFieldStats(relation, { exclude });
  // Everything below reads the relation the plots can: see `plotRelation`.
  const readable = useMemo(
    () => plotRelation(table, stats),
    // `chartTableKey` stands in for the identity of `table`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, chartTableKey(table)],
  );

  return (
    <ark.div className={cn("@container/dashboard flex flex-col gap-4", className)} {...rest} data-slot={slot ?? "dashboard"}>
      {/* The tiles read the relation projected for the plots, and are clients of the relation itself. */}
      <MosaicClients relation={read.relation ?? undefined}>
        <Board config={config} fields={readable.fields} onChange={onChange} table={readable.table} value={value} />
      </MosaicClients>
    </ark.div>
  );
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
}: {
  table: TableExpr;
  fields: FieldStat[];
  value?: DashboardSpec;
  onChange?: (spec: DashboardSpec | undefined) => void;
  config?: Readonly<Record<string, ChartConfig>>;
}) {
  const auto = useMemo(() => autoDashboard(fields), [fields]);
  const spec = value ?? auto;
  // The tile in the editor; one `spec.tiles` does not hold is being added.
  const [editing, setEditing] = useState<Tile | null>(null);
  const band = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  // Editing is drawn in the page's aside, so a page without one has a read-only dashboard.
  const aside = useEditorAside();
  const open = useTileEditorOpen();
  const edit =
    onChange && aside.element ? (patch: Partial<DashboardSpec>) => onChange({ ...spec, ...patch }) : undefined;
  // The host shows its aside on this, and the editor draws once it is shown, so it opens in view
  // and can take focus.
  const { edit: setOpen } = aside;
  const drafting = editing !== null;
  useEffect(() => {
    if (!drafting) return;
    setOpen(true);
    return () => setOpen(false);
  }, [setOpen, drafting]);

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
  const pencil = edit && ((tile: Tile) => () => setEditing(tile));
  // A tile being added has a slot of its own at the end of its band or grid, so its preview has
  // somewhere to be; a tile whose kind changes moves to the other one with its draft.
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
        relation={table}
      />
      {edit ? (
        <div className="flex items-center justify-end gap-1" data-slot="dashboard-toolbar">
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
        </div>
      ) : null}

      {groups.map(({ name, tiles, ref, className }) =>
        tiles.length > 0 ? (
          <div className={className} data-slot={name} key={name} ref={ref}>
            {tiles.map((tile) => {
              // The tile being edited draws its draft, in the same slot and the same view, so opening
              // the editor neither remounts it nor queries again.
              const shown = editing?.id === tile.id ? editing : tile;
              return (
                <TileView
                  // The tile being edited is the preview, and says so.
                  className={cn(
                    inBand(shown) ? undefined : tileSpan(shown.span),
                    editing?.id === tile.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  config={config}
                  fields={fields}
                  key={tile.id}
                  onEdit={pencil?.(tile)}
                  relation={table}
                  tile={shown}
                />
              );
            })}
          </div>
        ) : null,
      )}

      {/* The page's aside, and not a panel of the board's: the board keeps its width and its scroll. */}
      {edit && editing && open && aside.element ? createPortal(
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
        </Suspense>,
        aside.element,
      ) : null}
    </>
  );
}
