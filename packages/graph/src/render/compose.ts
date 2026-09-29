import type { TileMatrixSet } from "@fossil-lang/corpus";
import type { Binding } from "../core/channels";
import { residentOf, vertexId, type Resident } from "../core/resident";
import type { TileContent } from "../core/tile";
import type { TileView } from "../core/store";
import { Dictionary, encode, type Encoded } from "./encode";

/** An edge shorter than this many screen pixels is a dot on its own ends, and is not composed. */
export const MIN_LINK_PIXELS = 3;

/** One buffer set for one cosmos.gl instance. */
export interface Composition {
  /** `[x, y, …]`: vertices first, then cells, then far ends drawn only so an edge has one. */
  readonly positions: Float32Array;
  /** `[src, dst, …]` as indices into `positions`. */
  readonly links: Float32Array;
  /** How many edges each link stands for; `null` when every link is one edge. */
  readonly weights: Float32Array | null;
  /** Slots that are drawn — vertices and cells. Past it, far ends. */
  readonly marks: number;
  /** How many of the marks are vertices; cells follow them. */
  readonly vertices: number;
  readonly resident: Resident;
  /** Per slot: the category's rank, or `0` when nothing is bound. */
  readonly categories: Uint32Array;
  /** Per slot: the ramp's raw value, or `null` when nothing is bound. */
  readonly sizes: Float32Array | null;
  /** Per vertex slot: its title, when `title` is bound. */
  readonly titles: readonly string[] | null;
  /** What each rank is, for a legend: the values the dictionary has seen, in rank order. */
  readonly domain: readonly unknown[];
  /** Vertices the marks stand for — a cell counts its members. */
  readonly represented: number;
}

export interface ComposeInput {
  readonly matrix: TileMatrixSet;
  readonly typeIndex: number;
  readonly binding: Binding;
  readonly modeColumn: string | null;
  readonly visible: readonly TileView[];
  readonly cached: readonly TileView[];
  /** Graph units per screen pixel when composed, for the stub discard. */
  readonly perPixel: number;
}

/**
 * **Visible tiles → one buffer set.** cosmos.gl replaces a whole buffer per setter, so what changed
 * is decided at the granularity it offers: the set of tiles. The same visible set under the same
 * binding composes to `null` — nothing new, and nothing to upload.
 */
export function createComposer(): (input: ComposeInput) => Composition | null {
  let bindingKey = "";
  let dictionary = new Dictionary();
  let encoded = new WeakMap<TileContent, Encoded>();
  let setKey = "";

  const encodedOf = (view: TileView, input: ComposeInput): Encoded => {
    let found = encoded.get(view.content);
    if (!found) {
      found = encode(view, input.binding, dictionary, input.modeColumn);
      encoded.set(view.content, found);
    }
    return found;
  };

  return (input) => {
    const key = `${input.binding.category}|${input.binding.size}|${input.binding.title}|${input.modeColumn}`;
    if (key !== bindingKey) {
      bindingKey = key;
      dictionary = new Dictionary();
      encoded = new WeakMap();
      setKey = "";
    }
    const next = input.visible.map((view) => idOf(view.content)).join(",");
    if (next === setKey) return null;
    setKey = next;
    const tiles = input.visible.map((view) => ({ view, encoded: encodedOf(view, input) }));
    return assemble(input, tiles, dictionary, encodedOf);
  };
}

const ids = new WeakMap<object, number>();
let nextId = 1;
function idOf(content: object): number {
  let id = ids.get(content);
  if (id === undefined) ids.set(content, (id = nextId++));
  return id;
}

function assemble(
  input: ComposeInput,
  tiles: readonly { view: TileView; encoded: Encoded }[],
  dictionary: Dictionary,
  encodedOf: (view: TileView, input: ComposeInput) => Encoded,
): Composition {
  const ordered = [...tiles].sort((a, b) => Number(a.encoded.cells) - Number(b.encoded.cells));
  let marks = 0;
  let vertexMarks = 0;
  for (const { encoded } of ordered) {
    marks += encoded.n;
    if (!encoded.cells) vertexMarks += encoded.n;
  }

  const xy: number[] = [];
  const codes: number[] = [];
  const ramp: number[] = [];
  const titles: string[] = [];
  const vertices = new BigUint64Array(vertexMarks);
  const slot = new Map<number, Map<number, number>>();
  const slotsAt = (z: number) => {
    let found = slot.get(z);
    if (!found) slot.set(z, (found = new Map()));
    return found;
  };
  const place = (z: number, encoded: Encoded, i: number) => {
    const at = xy.length / 2;
    xy.push(encoded.positions[i * 2] as number, encoded.positions[i * 2 + 1] as number);
    codes.push(encoded.codes?.[i] ?? 0);
    ramp.push(encoded.sizes?.[i] ?? 0);
    slotsAt(z).set(encoded.keys[i] as number, at);
    return at;
  };

  let represented = 0;
  for (const { encoded, view } of ordered) {
    for (let i = 0; i < encoded.n; i++) {
      const at = place(view.address.z, encoded, i);
      represented += encoded.counts[i] ?? 0;
      if (!encoded.cells) {
        vertices[at] = vertexId(input.typeIndex, encoded.keys[i] as number);
        titles.push(encoded.titles?.[i] ?? "");
      }
    }
  }

  const cachedByZ = new Map<number, Map<number, TileView>>();
  for (const view of input.cached) {
    let byTile = cachedByZ.get(view.address.z);
    if (!byTile) cachedByZ.set(view.address.z, (byTile = new Map()));
    byTile.set(view.address.tile, view);
  }
  /** A far end: in the cache or not at all — never a read of its tile. */
  const farEnd = (z: number, key: number): number | undefined => {
    const known = slotsAt(z).get(key);
    if (known !== undefined) return known;
    const rows = input.matrix.tileMatrices[z]?.tileRows ?? 1;
    const view = cachedByZ.get(z)?.get(Math.floor(key / rows));
    if (!view) return undefined;
    const encoded = encodedOf(view, input);
    for (let i = 0; i < encoded.n; i++) if (encoded.keys[i] === key) return place(z, encoded, i);
    return undefined;
  };

  const minLength = MIN_LINK_PIXELS * input.perPixel;
  const links: number[] = [];
  const weights: number[] = [];
  const seen = new Set<string>();
  let weighted = false;
  for (const { encoded, view } of ordered) {
    const { z } = view.address;
    for (let e = 0; e < encoded.links.length / 2; e++) {
      const from = encoded.links[e * 2] as number;
      const to = encoded.links[e * 2 + 1] as number;
      if (from === to) continue;
      const pair = `${z}:${from}:${to}`;
      if (seen.has(pair)) continue;
      const a = farEnd(z, from);
      const b = farEnd(z, to);
      if (a === undefined || b === undefined) continue;
      seen.add(pair);
      const dx = (xy[a * 2] as number) - (xy[b * 2] as number);
      const dy = (xy[a * 2 + 1] as number) - (xy[b * 2 + 1] as number);
      if (Math.hypot(dx, dy) < minLength) continue;
      links.push(a, b);
      const weight = encoded.weights?.[e] ?? 1;
      if (encoded.weights) weighted = true;
      weights.push(weight);
    }
  }

  const ranks = dictionary.ranks();
  const categories = Uint32Array.from(codes, (code) => ranks[code] ?? 0);
  const domain: unknown[] = [];
  ranks.forEach((rank, code) => {
    domain[rank] = dictionary.values[code];
  });
  const bound = ordered.some(({ encoded }) => encoded.sizes !== null);

  return {
    positions: Float32Array.from(xy),
    links: Float32Array.from(links),
    weights: weighted ? Float32Array.from(weights) : null,
    marks,
    vertices: vertexMarks,
    resident: residentOf(vertices, vertexMarks),
    categories,
    sizes: bound ? Float32Array.from(ramp) : null,
    titles: input.binding.title === undefined ? null : titles,
    domain,
    represented,
  };
}
