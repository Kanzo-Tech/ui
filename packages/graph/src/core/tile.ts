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

/** deck.gl's `getTileData`, with fossil's address where deck.gl has `{ x, y, z }`. */
export type TileLoader = (address: TileAddress, signal: AbortSignal) => Promise<TileContent>;

export interface TileLoad {
  load: TileLoader;
  scheduler: RequestScheduler<Tile>;
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

  #controller: AbortController | null = null;
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
    this.#loaded = false;
    this.#cancelled = false;
    this.#needsReload = false;
    this.#loaderId += 1;
    const loader = this.#load(options);
    this.#loader = loader;
    return loader;
  }

  /** A finished tile has nothing to abort; a queued or running one is cancelled. */
  abort(): void {
    if (this.#loaded || this.#loader === null) return;
    this.#cancelled = true;
    this.#controller?.abort();
  }

  setNeedsReload(): void {
    if (this.isLoading) {
      this.abort();
      this.#loader = null;
    }
    this.#needsReload = true;
  }

  async #load({ load, onError, onLoad, priority, scheduler }: TileLoad): Promise<void> {
    const loaderId = this.#loaderId;
    const controller = new AbortController();
    this.#controller = controller;
    const token = await scheduler.schedule(this, priority);
    if (loaderId !== this.#loaderId) {
      token?.done();
      return;
    }
    if (!token || this.#cancelled) {
      token?.done();
      this.#cancelled = true;
      this.#loader = null;
      return;
    }
    let content: TileContent | null = null;
    let failure: unknown = null;
    try {
      content = await load(this.address, controller.signal);
    } catch (error) {
      failure = error ?? new Error("the tile failed to load");
    } finally {
      token.done();
    }
    if (loaderId !== this.#loaderId) return;
    this.#loader = null;
    this.#controller = null;
    if (this.#cancelled || controller.signal.aborted) {
      this.#cancelled = true;
      return;
    }
    this.#loaded = true;
    if (content) this.content = content;
    if (failure !== null) onError(failure, this);
    else onLoad(this);
  }
}
