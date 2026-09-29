import type { TileAddress, TileMatrixSet } from "@fossil-lang/corpus";
import { refine } from "./refine";
import { RequestScheduler } from "./scheduler";
import { Tile, type TileLoader } from "./tile";
import { centreOf, parentOf, selectLevel, tileId, type Viewport } from "./tile-matrix";

/** deck.gl's `DEFAULT_CACHE_SCALE`: the cache holds five times what is selected. */
const DEFAULT_CACHE_SCALE = 5;

export interface TilesetOptions {
  load: TileLoader;
  onTileLoad?: (tile: Tile) => void;
  onTileError?: (error: unknown, tile: Tile) => void;
  onTileUnload?: (tile: Tile) => void;
  /** Tiles kept; five times the selected count when absent. */
  maxCacheSize?: number;
  /** Bytes kept; unbounded when absent. */
  maxCacheByteSize?: number;
  /** One: see `RequestScheduler`. */
  maxRequests?: number;
  debounceTime?: number;
}

/**
 * **deck.gl's `Tileset2D` with the loader swapped for the corpus** — `modules/geo-layers/src/
 * tileset-2d/tileset-2d.ts`, its names kept so either can be read from the other.
 *
 * `update(viewport)` selects, then sets tile states, then prunes requests, then resizes the cache,
 * in deck.gl's order. Where it departs is `/docs/design/graph`'s table: a tile is fossil's
 * `{ type, z, tile }`, the level is chosen by published row counts, a tile is in view by its
 * published box, and an in-flight tile nobody wants is always aborted, because the one slot is
 * the only one.
 */
export class Tileset2D {
  readonly #options: TilesetOptions;
  readonly #scheduler: RequestScheduler<Tile>;
  readonly #cache = new Map<string, Tile>();
  #matrix: TileMatrixSet | null = null;
  #planned: ReadonlyMap<number, ReadonlySet<number>> = new Map();
  #selected: Tile[] = [];
  #viewport: Viewport | null = null;
  #limit = 0;
  #z: number | null = null;
  #stale = true;
  #frame = 0;
  #signature = "";

  constructor(options: TilesetOptions) {
    this.#options = options;
    this.#scheduler = new RequestScheduler({
      debounceTime: options.debounceTime,
      maxRequests: options.maxRequests ?? 1,
    });
  }

  get tiles(): Tile[] {
    return [...this.#cache.values()].sort((a, b) => a.z - b.z);
  }

  get selectedTiles(): readonly Tile[] {
    return this.#selected;
  }

  /** Moves whenever the selected or visible set, or what a tile holds, may have changed. */
  get frame(): number {
    return this.#frame;
  }

  /** The zoom the last selection chose, or `null` before one. */
  get z(): number | null {
    return this.#z;
  }

  get isLoaded(): boolean {
    return this.#selected.every((tile) => tile.isLoaded);
  }

  get maxCacheSize(): number {
    return this.#options.maxCacheSize ?? DEFAULT_CACHE_SCALE * Math.max(1, this.#selected.length);
  }

  get maxCacheByteSize(): number {
    return this.#options.maxCacheByteSize ?? Number.POSITIVE_INFINITY;
  }

  /** The matrices, from `corpus.tileMatrix(type)`. A new set empties the cache. */
  setMatrix(matrix: TileMatrixSet): void {
    if (matrix === this.#matrix) return;
    this.#matrix = matrix;
    this.finalize();
    this.#stale = true;
  }

  /** The tiles `scan.plan()` kept, by zoom — asked once per question, never per camera move. */
  setPlan(planned: readonly TileAddress[]): void {
    const byZoom = new Map<number, Set<number>>();
    for (const { tile, z } of planned) {
      let tiles = byZoom.get(z);
      if (!tiles) byZoom.set(z, (tiles = new Set()));
      tiles.add(tile);
    }
    this.#planned = byZoom;
    this.#stale = true;
  }

  /**
   * The question changed: every tile is marked for reload and keeps its content until the new
   * answer arrives — `TileLayer`'s `reloadAll` when its `data` moves. A cached tile that is not
   * selected is dropped, since nothing will ask it again under the old question.
   */
  reloadAll(): void {
    for (const [id, tile] of this.#cache) {
      if (!this.#selected.includes(tile)) {
        tile.abort();
        this.#cache.delete(id);
        this.#options.onTileUnload?.(tile);
      } else {
        tile.setNeedsReload();
      }
    }
    this.#rebuildTree();
    this.#stale = true;
  }

  /**
   * Select what the viewport needs and refine; returns a frame number that moves whenever the
   * visible set may have changed.
   */
  update(viewport: Viewport, limit: number): number {
    const matrix = this.#matrix;
    if (!matrix) return this.#frame;
    const moved =
      this.#stale ||
      limit !== this.#limit ||
      !this.#viewport ||
      viewport.xMin !== this.#viewport.xMin ||
      viewport.yMin !== this.#viewport.yMin ||
      viewport.xMax !== this.#viewport.xMax ||
      viewport.yMax !== this.#viewport.yMax;
    if (moved) {
      this.#stale = false;
      this.#viewport = viewport;
      this.#limit = limit;
      const level = selectLevel(matrix, viewport, limit, this.#planned);
      this.#z = level?.z ?? null;
      const wanted = level ? level.tiles.map((tile) => ({ type: matrix.type, z: level.z, tile })) : [];
      for (const tile of this.#selected) tile.isSelected = false;
      this.#selected = wanted.map((address) => this.#getTile(address));
      for (const tile of this.#selected) tile.isSelected = true;
      this.#rebuildTree();
      this.#loadSelected();
    }
    return this.#refresh();
  }

  /** Re-run refinement after a load, with no change of viewport. */
  refresh(): number {
    return this.#refresh();
  }

  /** Abort everything and forget the cache. */
  finalize(): void {
    for (const tile of this.#cache.values()) tile.abort();
    this.#scheduler.clear();
    this.#cache.clear();
    this.#selected = [];
    this.#z = null;
    this.#stale = true;
  }

  #refresh(): number {
    refine(this.#cache.values());
    this.#pruneRequests();
    this.#resizeCache();
    const shown = (tile: Tile) => `${tile.id}${tile.isVisible ? "+" : ""}${tile.isSelected ? "*" : ""}:${tile.content ? 1 : 0}`;
    const signature = [...this.#cache.values()].map(shown).join(",");
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#frame += 1;
    }
    return this.#frame;
  }

  #getTile(address: TileAddress): Tile {
    const id = tileId(address);
    let tile = this.#cache.get(id);
    if (!tile) {
      tile = new Tile(address);
      this.#cache.set(id, tile);
    }
    return tile;
  }

  #loadSelected(): void {
    for (const tile of this.#selected) {
      if (tile.isLoaded || tile.isLoading) continue;
      void tile.loadData({
        load: this.#options.load,
        scheduler: this.#scheduler,
        priority: (t) => this.#priority(t),
        onLoad: (t) => this.#options.onTileLoad?.(t),
        onError: (error, t) => this.#options.onTileError?.(error, t),
      });
    }
  }

  /** `_getRequestPriority`: `-1` drops a tile nobody wants; the rest go nearest the centre first. */
  #priority(tile: Tile): number {
    if (!tile.isSelected && !tile.isVisible) return -1;
    const matrix = this.#matrix;
    const view = this.#viewport;
    if (!matrix || !view) return 0;
    const centre = centreOf(matrix, tile.address);
    if (!centre) return 0;
    return Math.hypot(centre[0] - (view.xMin + view.xMax) / 2, centre[1] - (view.yMin + view.yMax) / 2);
  }

  /** Always, where deck.gl waits for `maxRequests` to be exceeded: the one slot is the only one. */
  #pruneRequests(): void {
    for (const tile of this.#cache.values()) {
      if (tile.isLoading && !tile.isSelected && !tile.isVisible) tile.abort();
    }
  }

  /** Evicts tiles neither visible nor selected, in insertion order — deck.gl's, and not LRU. */
  #resizeCache(): void {
    let bytes = 0;
    for (const tile of this.#cache.values()) bytes += tile.byteLength;
    if (this.#cache.size <= this.maxCacheSize && bytes <= this.maxCacheByteSize) return;
    for (const [id, tile] of this.#cache) {
      if (this.#cache.size <= this.maxCacheSize && bytes <= this.maxCacheByteSize) break;
      if (tile.isVisible || tile.isSelected) continue;
      bytes -= tile.byteLength;
      tile.abort();
      this.#cache.delete(id);
      this.#options.onTileUnload?.(tile);
    }
    this.#rebuildTree();
  }

  /** Each tile's parent is its nearest ancestor in the cache — `_rebuildTree`. */
  #rebuildTree(): void {
    const matrix = this.#matrix;
    for (const tile of this.#cache.values()) {
      tile.parent = null;
      tile.children = [];
    }
    if (!matrix) return;
    for (const tile of this.#cache.values()) {
      let up = parentOf(matrix, tile.address);
      while (up) {
        const found = this.#cache.get(tileId(up));
        if (found) {
          tile.parent = found;
          found.children.push(tile);
          break;
        }
        up = parentOf(matrix, up);
      }
    }
  }
}
