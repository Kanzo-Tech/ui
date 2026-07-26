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
