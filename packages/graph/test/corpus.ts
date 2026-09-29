import type {
  Batch,
  Corpus,
  EdgeAnswer,
  EdgesParams,
  ScanParams,
  ScanTask,
  TileAddress,
  TileMatrix,
  TileMatrixSet,
} from "@fossil-lang/corpus";

/**
 * A corpus on a line, small enough to count by hand: vertex `i` sits at `(i, 0)`, a payload tile
 * holds `tileRows` consecutive vertices, and every vertex links to the next. Below the payload one
 * rung of cells, four vertices a cell, each at its members' centroid, with the quotient linking each
 * cell to the next.
 *
 * Reads are recorded and held until the test releases them, so a test can see what is in flight,
 * what was aborted, and what was never sent. A read is one call, and a call takes a batch of
 * addresses, as fossil's does.
 */
export interface Read {
  readonly kind: "rows" | "edges";
  readonly addresses: readonly TileAddress[];
  readonly direction?: "src" | "dst";
  readonly signal?: AbortSignal;
  released: boolean;
  release(): void;
}

export interface FakeCorpus {
  readonly corpus: Corpus;
  readonly reads: Read[];
  /** Resolve every held read, repeatedly, until nothing is left in flight. */
  settle(): Promise<void>;
  /** Scans built, with their params — a new scan is a new question. */
  readonly scans: ScanParams[];
}

const TYPE = "Node";
const PER_CELL = 4;

const column = (values: number[]) => ({ toArray: () => Float64Array.from(values) });

function batch(columns: Record<string, number[]>): Batch {
  const n = Object.values(columns)[0]?.length ?? 0;
  return { numRows: n, getChild: (name) => (columns[name] ? column(columns[name]) : null) };
}

export function fakeCorpus({ tileRows = 4, vertices = 16 }: { tileRows?: number; vertices?: number } = {}): FakeCorpus {
  const reads: Read[] = [];
  const scans: ScanParams[] = [];
  const cells = Math.ceil(vertices / PER_CELL);
  const tilesOf = (rows: number) => Math.ceil(rows / tileRows);
  const box = (lo: number, hi: number) => ({ x: lo, y: 0, w: hi - lo, h: 0 });

  const payload: TileMatrix = {
    z: 1,
    kind: "rows",
    count: BigInt(vertices),
    shift: 0,
    tileRows,
    tiles: Array.from({ length: tilesOf(vertices) }, (_, tile) => {
      const lo = tile * tileRows;
      const hi = Math.min(vertices, lo + tileRows) - 1;
      return { tile, rows: hi - lo + 1, bbox: box(lo, hi) };
    }),
  };
  const rung: TileMatrix = {
    z: 0,
    kind: "cells",
    count: BigInt(cells),
    shift: 2,
    tileRows,
    tiles: Array.from({ length: tilesOf(cells) }, (_, tile) => {
      const lo = tile * tileRows;
      const hi = Math.min(cells, lo + tileRows) - 1;
      return { tile, rows: hi - lo + 1, bbox: box(lo * PER_CELL, hi * PER_CELL + PER_CELL - 1) };
    }),
  };
  const matrix: TileMatrixSet = {
    type: TYPE,
    extent: box(0, vertices - 1),
    coordinates: "layout",
    tileMatrices: [rung, payload],
  };

  const held = <T>(read: Omit<Read, "release" | "released">, answer: () => T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(read.signal?.reason ?? new DOMException("aborted", "AbortError"));
      if (read.signal?.aborted) return onAbort();
      read.signal?.addEventListener("abort", onAbort, { once: true });
      const entry: Read = {
        ...read,
        released: false,
        release: () => {
          entry.released = true;
          resolve(answer());
        },
      };
      reads.push(entry);
    });

  const range = (address: TileAddress) => {
    const lo = address.tile * tileRows;
    const count = address.z === 1 ? vertices : cells;
    return Array.from({ length: Math.max(0, Math.min(count, lo + tileRows) - lo) }, (_, i) => lo + i);
  };

  const corpus = {
    url: "fake://corpus",
    types: {
      vertices: [
        {
          type: TYPE,
          count: BigInt(vertices),
          fields: ["dense_id", "subject", "x", "y", "cluster_id", "degree"].map((name) => ({ name, type: "UINTEGER" })),
          identity: "subject",
          geometry: true,
          indexed: false,
          channels: [{ name: "community", column: "cluster_id", scale: "categorical", domain: 4, derivedBy: null }],
        },
      ],
      edges: [],
    },
    addressing: { vertexType: () => ({ cells: { modeChannel: "community" } }) },
    tileMatrix: () => matrix,
    scan(params: ScanParams) {
      scans.push(params);
      const plan = (): ScanTask[] =>
        matrix.tileMatrices.flatMap((m) =>
          params.filter !== undefined && m.kind === "cells"
            ? []
            : m.tiles.map((t) => ({ type: TYPE, z: m.z, tile: t.tile, rows: t.rows, bbox: t.bbox, residual: null })),
        );
      const one = (address: TileAddress) => {
        const only = params.filter && "op" in params.filter && params.filter.op === "=" ? Number(params.filter.value) : null;
        const ids = range(address).filter((i) => only === null || i === only);
        return address.z === 1
            ? batch({ dense_id: ids, x: ids, y: ids.map(() => 0), cluster_id: ids.map((i) => i % 4), degree: ids.map((i) => i + 1) })
            : batch({
                cell_id: ids,
                x: ids.map((c) => c * PER_CELL + 1.5),
                y: ids.map(() => 0),
                count: ids.map(() => PER_CELL),
                mode: ids.map((c) => c % 4),
              });
      };
      const read = (addresses: readonly TileAddress[], options: { signal?: AbortSignal } = {}) =>
        held({ kind: "rows", addresses, signal: options.signal }, () => addresses.map(one));
      return { params, plan, read };
    },
    edges(params: EdgesParams): Promise<readonly EdgeAnswer[]> {
      const { direction, from: addresses, signal } = params;
      const declines = (from: TileAddress) => from.z === 0 && direction === "dst";
      const answer = (from: TileAddress): EdgeAnswer => {
        if (declines(from)) return { batches: [], declined: [{ edgeType: "linksTo", direction, reason: "not-declared" }] };
        const ids = range(from);
        const last = (from.z === 1 ? vertices : cells) - 1;
        const pairs = ids
          .map((i) => (direction === "src" ? [i, i + 1] : [i - 1, i]))
          .filter(([a, b]) => (a as number) >= 0 && (b as number) <= last);
        return {
          batches: [
            {
              edgeType: "linksTo",
              srcType: TYPE,
              dstType: TYPE,
              src: BigUint64Array.from(pairs.map(([a]) => BigInt(a as number))),
              dst: BigUint64Array.from(pairs.map(([, b]) => BigInt(b as number))),
              weight: from.z === 1 ? null : BigUint64Array.from(pairs.map(() => 3n)),
            },
          ],
          declined: [],
        };
      };
      if (addresses.every(declines)) return Promise.resolve(addresses.map(answer));
      return held({ kind: "edges", addresses, direction, signal }, () => addresses.map(answer));
    },
  } as unknown as Corpus;

  return {
    corpus,
    reads,
    scans,
    async settle() {
      const open = () => reads.filter((read) => !read.released && !read.signal?.aborted);
      for (let round = 0; round < 100; round++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const waiting = open();
        if (waiting.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (open().length === 0) return;
          continue;
        }
        for (const read of waiting) read.release();
      }
    },
  };
}
