import type { Batch, EdgeBatch, Gap, TileAddress } from "@fossil-lang/corpus";
import type { RequestScheduler } from "./scheduler";
import { tileId } from "./tile-matrix";

/** What one tile holds once read: its rows, the relations incident to it, and what was declined. */
export interface TileContent {
  readonly rows: Batch;
  readonly edges: readonly EdgeBatch[];
  readonly declined: readonly Gap[];
  readonly byteLength: number;
}

/**
 * deck.gl's `getTileData`, over a batch: fossil's addresses where deck.gl has `{ x, y, z }`, and one
 * content per address, in order, because the corpus reads a run of consecutive tiles in one statement.
 */
export type TileLoader = (addresses: readonly TileAddress[], signal: AbortSignal) => Promise<readonly TileContent[]>;

export interface TileLoad {
  scheduler: RequestScheduler<Tile, TileContent>;
  priority: (tile: Tile) => number;
  onLoad: (tile: Tile) => void;
  onError: (error: unknown, tile: Tile) => void;
}

/**
 * deck.gl's `Tile2DHeader`: one tile's load, abort and content, and its place in the tree.
 *
 * **Content outlives a reload.** A tile marked for reload keeps what it last read until the new
 * answer arrives, and an aborted or failed reload keeps it too, so a change of question never
 * shows a hole. deck.gl drops it on a cancelled reload; the one departure, and it is what
 * `/docs/design/graph` asks of a change of data.
 */
export class Tile {
  readonly address: TileAddress;
  readonly id: string;
  content: TileContent | null = null;
  isSelected = false;
  isVisible = false;
  parent: Tile | null = null;
  children: Tile[] = [];

  #scheduler: RequestScheduler<Tile, TileContent> | null = null;
  #loader: Promise<void> | null = null;
  #loaderId = 0;
  #loaded = false;
  #cancelled = false;
  #needsReload = false;

  constructor(address: TileAddress) {
    this.address = address;
    this.id = tileId(address);
  }

  get z(): number {
    return this.address.z;
  }

  /** Read at least once for the current question. */
  get isLoaded(): boolean {
    return this.#loaded && !this.#needsReload;
  }

  /** Queued or running, and not cancelled. */
  get isLoading(): boolean {
    return this.#loader !== null && !this.#cancelled;
  }

  get needsReload(): boolean {
    return this.#needsReload || this.#cancelled;
  }

  get byteLength(): number {
    return this.content?.byteLength ?? 0;
  }

  loadData(options: TileLoad): Promise<void> {
    this.#scheduler = options.scheduler;
    this.#loaded = false;
    this.#cancelled = false;
    this.#needsReload = false;
    this.#loaderId += 1;
    const loader = this.#load(options);
    this.#loader = loader;
    return loader;
  }

  /**
   * A finished tile has nothing to abort; a queued or running one is cancelled, and its batch is
   * aborted once no tile in it is wanted.
   */
  abort(): void {
    if (this.#loaded || this.#loader === null) return;
    this.#cancelled = true;
    this.#scheduler?.cancel(this);
  }

  setNeedsReload(): void {
    if (this.isLoading) {
      this.abort();
      this.#loader = null;
    }
    this.#needsReload = true;
  }

  async #load({ onError, onLoad, priority, scheduler }: TileLoad): Promise<void> {
    const loaderId = this.#loaderId;
    const outcome = await scheduler.schedule(this, priority);
    if (loaderId !== this.#loaderId) return;
    this.#loader = null;
    if (outcome === null || this.#cancelled) {
      this.#cancelled = true;
      return;
    }
    this.#loaded = true;
    if ("value" in outcome) {
      this.content = outcome.value;
      onLoad(this);
    } else {
      onError(outcome.error ?? new Error("the tile failed to load"), this);
    }
  }
}
