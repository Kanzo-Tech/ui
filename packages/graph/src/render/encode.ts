import { PAYLOAD_ADDRESS, PAYLOAD_COORDINATES } from "@fossil-lang/corpus";
import type { Binding } from "../core/channels";
import type { TileView } from "../core/store";

/**
 * The cell columns a view reads. fossil's barrel publishes the payload's role table and not the
 * cells', so these two are spelled here; `/docs/design/graph` lists it as open on fossil's side.
 */
const CELL_KEY = "cell_id";
const CELL_TALLY = "count";
const CELL_MODE = "mode";
const KEY = PAYLOAD_ADDRESS[0] as string;
const [X, Y] = PAYLOAD_COORDINATES as [string, string];

/**
 * Values to codes, in the order first seen — stable for the life of a binding. **The seed ranks
 * first, in its own order**: the manifest's ordinals or the host's named values, so a colour is
 * decided before a tile arrives. Only a value outside it is ranked by value, after the seed.
 */
export class Dictionary {
  readonly values: unknown[] = [];
  readonly #codes = new Map<unknown, number>();
  readonly #seeded: number;

  constructor(seed: readonly unknown[] = []) {
    for (const value of seed) this.code(value);
    this.#seeded = this.values.length;
  }

  code(value: unknown): number {
    const key = typeof value === "bigint" ? Number(value) : value;
    let code = this.#codes.get(key);
    if (code === undefined) {
      code = this.values.length;
      this.values.push(key);
      this.#codes.set(key, code);
    }
    return code;
  }

  /** Each code's rank: the seed's own order, then every other value seen, numbers before strings. */
  ranks(): Uint32Array {
    const ranks = new Uint32Array(this.values.length);
    for (let code = 0; code < this.#seeded; code++) ranks[code] = code;
    const rest = this.values.slice(this.#seeded).map((value, i) => ({ value, code: this.#seeded + i }));
    rest.sort((a, b) => compare(a.value, b.value));
    rest.forEach(({ code }, i) => {
      ranks[code] = this.#seeded + i;
    });
    return ranks;
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** One tile's rows and edges as the arrays a composition concatenates. */
export interface Encoded {
  readonly n: number;
  readonly cells: boolean;
  /** `[x0, y0, x1, y1, …]`. */
  readonly positions: Float32Array;
  /** `dense_id` at the payload, `cell_id` on a rung — what an edge's ends name. */
  readonly keys: Float64Array;
  /** Dictionary codes of the categorical column, or `null` when nothing is bound. */
  readonly codes: Uint32Array | null;
  /** The ramp: `r`'s column at the payload, a cell's `count` on a rung. */
  readonly sizes: Float32Array | null;
  /** Vertices each row stands for: one at the payload, a cell's `count` on a rung. */
  readonly counts: Float64Array;
  readonly titles: readonly string[] | null;
  /** `[src, dst, …]` in `keys`' space, every relation read from this tile, both directions. */
  readonly links: Float64Array;
  /** How many edges each link stands for: one at the payload, the quotient's `weight` on a rung. */
  readonly weights: Float32Array | null;
}

const numbers = (values: ArrayLike<unknown> | undefined, n: number): Float64Array => {
  const out = new Float64Array(n);
  if (values) for (let i = 0; i < n; i++) out[i] = Number(values[i] ?? Number.NaN);
  return out;
};

/**
 * **A tile is encoded once per binding**: the arrays are made when it arrives, and a composition is a
 * concatenation of arrays already made. A cell summarises one channel, so its colour is `mode` when
 * `fill` binds the column the tree's mode is of, its size can only be `count`, and it has no title.
 */
export function encode(
  view: TileView,
  binding: Binding,
  dictionary: Dictionary,
  modeColumn: string | null,
): Encoded {
  const { rows, edges } = view.content;
  const cells = view.kind === "cells";
  const n = rows.numRows;
  const xs = rows.getChild(X)?.toArray();
  const ys = rows.getChild(Y)?.toArray();
  const positions = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    positions[i * 2] = Number(xs?.[i] ?? Number.NaN);
    positions[i * 2 + 1] = Number(ys?.[i] ?? Number.NaN);
  }
  const keys = numbers(rows.getChild(cells ? CELL_KEY : KEY)?.toArray(), n);

  const categorical = cells ? (binding.category === modeColumn ? CELL_MODE : undefined) : binding.category;
  const category = categorical === undefined ? undefined : rows.getChild(categorical)?.toArray();
  let codes: Uint32Array | null = null;
  if (category) {
    codes = new Uint32Array(n);
    for (let i = 0; i < n; i++) codes[i] = dictionary.code(category[i] ?? null);
  }

  const counts = cells ? numbers(rows.getChild(CELL_TALLY)?.toArray(), n) : new Float64Array(n).fill(1);
  const ramp = cells ? (binding.size !== undefined ? counts : undefined) : binding.size;
  const sizes =
    ramp === undefined ? null : Float32Array.from(typeof ramp === "string" ? numbers(rows.getChild(ramp)?.toArray(), n) : ramp);

  const named = !cells && binding.title !== undefined ? rows.getChild(binding.title)?.toArray() : undefined;
  const titles = named ? Array.from({ length: n }, (_, i) => String(named[i] ?? "")) : null;

  let total = 0;
  for (const edge of edges) total += edge.src.length;
  const links = new Float64Array(total * 2);
  const weights = cells ? new Float32Array(total) : null;
  let at = 0;
  for (const edge of edges) {
    for (let e = 0; e < edge.src.length; e++, at++) {
      links[at * 2] = Number(edge.src[e]);
      links[at * 2 + 1] = Number(edge.dst[e]);
      if (weights) weights[at] = Number(edge.weight?.[e] ?? 1);
    }
  }

  return { n, cells, positions, keys, codes, sizes, counts, titles, links, weights };
}
