import {
  cardFor,
  detailColumns,
  isMeasure,
  measureLabel,
  normalizeCard,
  type ChartTile,
  type StatTile,
  type TableTile,
  type Tile,
  type TileKind,
} from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";

/**
 * **What each kind of tile is, as data**: how one is made from a relation's fields, what it is
 * called, and what it keeps when a tile of another kind becomes one. No React: how a kind is drawn
 * is `TILE_VIEWS` (`tile-views.tsx`) and how it is edited is `TILE_EDITORS` (`tile-fields.tsx`),
 * after Grafana's panel plugins, where a panel type is one definition read by every surface.
 *
 * The three tables are mapped over `TileKind`, so a kind missing a row in any of them is a compile
 * error. A new kind is a member of the spec's schema and one row in each table; `newTile`,
 * `tileTitle` and `changeKind` switch on nothing and do not change. The set is closed to hosts.
 */
export interface KindSpec<T extends Tile> {
  /** A new tile, chosen from the fields the way the automatic dashboard would choose it. `null` when the relation cannot make one. */
  create(fields: readonly FieldStat[], tiles: readonly Tile[], id: string): T | null;
  /** The title a tile of this kind is drawn under when it has none of its own. */
  title(tile: T): string;
  /** `to`, carrying over what it can from `from`, a tile of another kind. */
  convertFrom(from: Tile, to: T, fields: readonly FieldStat[]): T;
}

type Kinds = { [K in TileKind]: KindSpec<Extract<Tile, { kind: K }>> };

export const KINDS: Kinds = {
  stat: {
    // The mean of a measure no figure shows yet, else the count.
    create: (fields, tiles, id): StatTile => {
      const measure = fields.find((f) => isMeasure(f) && !tiles.some((t) => t.kind === "stat" && t.measure.field === f.name));
      return { id, kind: "stat", measure: measure ? { op: "avg", field: measure.name } : { op: "count" } };
    },
    title: (tile) => measureLabel(tile.measure),
    // A chart's aggregate becomes the figure.
    convertFrom: (from, to) => (from.kind === "chart" && from.y.op !== "value" ? { ...to, measure: from.y } : to),
  },
  chart: {
    // The best chart of the first field a rule draws on its own, preferring one not charted yet.
    create: (fields, tiles, id): ChartTile | null => {
      const used = new Set(tiles.flatMap((t) => (t.kind === "chart" ? [t.x] : [])));
      const card = [...fields]
        .sort((a, b) => Number(used.has(a.name)) - Number(used.has(b.name)))
        .map((f) => cardFor(f))
        .find((c) => c !== null);
      return card ? { ...card, id } : null;
    },
    title: (tile) =>
      tile.type === "dot" || tile.type === "regression"
        ? `${tile.x} × ${tile.y.field}`
        : `${measureLabel(tile.y)} by ${tile.x}${tile.color ? ` and ${tile.color}` : ""}`,
    // A figure's measure becomes the chart's, when the chart can draw it.
    convertFrom: (from, to, fields) =>
      from.kind === "stat" && from.measure.op !== "share" ? (normalizeCard({ ...to, y: from.measure }, fields) ?? to) : to,
  },
  table: {
    create: (fields, _tiles, id): TableTile => ({ id, kind: "table", span: 3, columns: detailColumns(fields) }),
    title: () => "Rows",
    convertFrom: (_from, to) => to,
  },
};

/** A kind's row, read for a tile whose kind is only known at run time. */
const kind = (k: TileKind) => KINDS[k] as unknown as KindSpec<Tile>;

/**
 * A new tile of `kind` with the id `id` — what *Add tile* opens the editor on. The caller mints the
 * id, so this stays pure. `null` when the relation cannot make that kind.
 */
export function newTile(k: TileKind, fields: readonly FieldStat[], tiles: readonly Tile[], id: string): Tile | null {
  return kind(k).create(fields, tiles, id);
}

/** The title a tile is drawn under: its own, or one derived from what it reads. */
export function tileTitle(tile: Tile): string {
  return tile.title ?? kind(tile.kind).title(tile);
}

/**
 * The tile as another kind, keeping what carries over, its id and — between a chart and a table —
 * its width. A title goes, since it
 * described the tile it was written for. `null` when the relation cannot make that kind.
 */
export function changeKind(tile: Tile, k: TileKind, fields: readonly FieldStat[], tiles: readonly Tile[]): Tile | null {
  if (tile.kind === k) return tile;
  const made = kind(k).create(fields, tiles, tile.id);
  // A width carries over between the kinds that have one; a figure has none to give or take.
  const sized = made && "span" in made && "span" in tile ? { ...made, span: tile.span } : made;
  return sized && kind(k).convertFrom(tile, sized, fields);
}

/**
 * Whether a tile is drawn in the band of figures above the grid. A figure is one number and its
 * trend, as short as a line of text; beside a chart in a grid row it would stand as tall as the
 * chart. The band is where Few's *Information Dashboard Design* and every KPI strip put them.
 */
export const inBand = (tile: Tile): tile is StatTile => tile.kind === "stat";

/** The tiles drawn with `tile` — its band or its grid — in spec order, itself left out. */
export function peersOf(tiles: readonly Tile[], tile: Tile): Tile[] {
  return tiles.filter((t) => t.id !== tile.id && inBand(t) === inBand(tile));
}

/**
 * The spec's tiles with `tile` at `position` among its peers, in place of the tile with its id. A
 * position past the last peer puts it after them; a first figure goes before everything, a first
 * grid tile after everything.
 */
export function placeTile(tiles: readonly Tile[], tile: Tile, position: number): Tile[] {
  const rest = tiles.filter((t) => t.id !== tile.id);
  const peers = peersOf(rest, tile);
  const before = peers[position];
  const last = peers.at(-1);
  const at = before ? rest.indexOf(before) : last ? rest.indexOf(last) + 1 : inBand(tile) ? 0 : rest.length;
  return [...rest.slice(0, at), tile, ...rest.slice(at)];
}
