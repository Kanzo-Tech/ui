import type { Binding } from "./channels";
import type { VertexTable } from "./corpus-contract";

/**
 * **The categorical domain, fixed before the graph loads.** Colour by vertex type ranks the drawn
 * tables in the manifest's order; a column ranks by the keys of the host's `categories`. Only a value
 * neither names is ranked as it is seen, after them.
 */
export function domainOf(
  tables: readonly VertexTable[],
  binding: Binding,
  categories: Readonly<Record<string, string>> | undefined,
): readonly unknown[] {
  if (binding.byTable) return tables.map((table) => table.name);
  if (binding.category === undefined) return [];
  return categories ? Object.keys(categories) : [];
}

/** What a legend, a card or an inspector calls a category value. */
export const nameOf = (value: unknown, categories: Readonly<Record<string, string>> | undefined): string =>
  categories?.[String(value)] ?? String(value ?? "—");

/**
 * Values to codes, in the order first seen. **The seed ranks first, in its own order**, so a colour
 * is decided before a row arrives; a value outside it is ranked after the seed, numbers before
 * strings. Values meet by their text, so a column's `0` is the host's key `"0"`.
 */
export class Dictionary {
  readonly values: unknown[] = [];
  readonly #codes = new Map<string | null, number>();
  readonly #seeded: number;

  constructor(seed: readonly unknown[] = []) {
    for (const value of seed) this.code(value);
    this.#seeded = this.values.length;
  }

  code(value: unknown): number {
    const key = value === null || value === undefined ? null : String(value);
    let code = this.#codes.get(key);
    if (code === undefined) {
      code = this.values.length;
      this.values.push(typeof value === "bigint" ? Number(value) : (value ?? null));
      this.#codes.set(key, code);
    }
    return code;
  }

  /** Each code's rank: the seed's own order, then every other value seen. */
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
