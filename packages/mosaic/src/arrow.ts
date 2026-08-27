/**
 * Reading one column out of whatever a Mosaic query handed back.
 *
 * The coordinator answers with an Arrow table, and Arrow only offers a typed column when the type
 * allows one: `getChild` gives an array for an integer column and nothing usable for a
 * dictionary-encoded string. Both shapes come back from ordinary queries — an `id` is the first, a
 * `label` is the second — so a `queryResult` that assumes the typed path is a crash waiting for the
 * first query that selects a string.
 *
 * This is the half of the client protocol the protocol itself does not give you. Declaring a query
 * and publishing a clause is documented and small; turning the answer into values is where every
 * call site independently writes `as { getChild(name: string): … }`, which is a cast asserting the
 * shape rather than checking it.
 */

interface ArrowLike {
  getChild?: (name: string) => { toArray(): ArrayLike<unknown> } | null;
}

/** Every value in `field`, in row order. */
export function column(data: unknown, field: string): unknown[] {
  const child = (data as ArrowLike).getChild?.(field);
  if (child) return Array.from(child.toArray());
  return Array.from(data as Iterable<Record<string, unknown>>, (row) => row[field]);
}

/** The same, coerced — Arrow hands back `BigInt` for some integer widths. */
export function numbers(data: unknown, field: string): number[] {
  return column(data, field).map(Number);
}

/** A pre-sized destination `fillColumn` can write into. */
export type NumericArray = Float32Array | Float64Array | Uint32Array | Uint16Array | Int32Array;

/**
 * One numeric column, written straight into a typed array the caller already owns.
 *
 * `numbers()` is the wrong tool once a result is large: `toArray()` already hands back a typed
 * buffer, and `Array.from(...).map(Number)` turns it into two full-length boxed `number[]` on the
 * way to a third array that was the actual destination. Three allocations to move nothing. This is
 * the same pass with none of them — which is what lets a caller size once against its own limit and
 * fill from the Arrow batches as they arrive.
 *
 * `stride` and `offset` are how interleaving is expressed: `x` at `(0, 2)` and `y` at `(1, 2)` fill
 * one `[x0, y0, x1, y1, …]` buffer with no seam between them.
 *
 * Returns how many rows were written, which is `min(rows, capacity)` — a caller that sized against
 * a `LIMIT` uses it to `subarray` down to what actually came back.
 */
export function fillColumn(
  data: unknown,
  field: string,
  into: NumericArray,
  offset = 0,
  stride = 1,
): number {
  const capacity = Math.max(0, Math.ceil((into.length - offset) / stride));
  const values = (data as ArrowLike).getChild?.(field)?.toArray();
  if (values) {
    const n = Math.min(values.length, capacity);
    // `Number` is identity on the numeric widths and the conversion on the BigInt ones; either way
    // it reads an element rather than allocating one.
    for (let i = 0; i < n; i++) into[offset + i * stride] = Number(values[i]);
    return n;
  }
  let i = 0;
  for (const row of data as Iterable<Record<string, unknown>>) {
    if (i >= capacity) break;
    into[offset + i * stride] = Number(row[field]);
    i++;
  }
  return i;
}
