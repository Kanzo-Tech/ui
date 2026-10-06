import { toDataColumns } from "@uwdata/mosaic-core";

/**
 * One numeric column out of whatever a Mosaic query handed back, an Arrow table or an array of
 * rows. Reading the answer is mosaic-core's `toDataColumns`; what is ours is the coercion, because
 * Arrow hands back `BigInt` for some integer widths and every caller here wants a `number` — an id
 * to select, a value to place.
 *
 * A field the query did not select throws: an empty or row-shaped hole would be a selection that
 * silently matched nothing.
 */
export function numbers(data: unknown, field: string): number[] {
  const answer = toDataColumns(data);
  const values = "columns" in answer ? answer.columns[field] : undefined;
  if (values === undefined) throw new Error(`the answer has no column "${field}"`);
  return Array.from(values as ArrayLike<unknown>, Number);
}
