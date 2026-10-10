import { bin as vgBin } from "@uwdata/vgplot";

const made = new Map<string, ReturnType<typeof vgBin>>();

/**
 * **vgplot's `bin`, one transform per field and options** — the same function for the same
 * arguments. `bin()` returns a closure, and `chartSpecSignature` can only read a function by its
 * identity, so a fresh closure on every render was a new grammar: the plot was rebuilt and its
 * queries re-run on each render of the chart, and a rebuilt plot builds new interactors, which
 * orphaned the clause the old brush had published (a second brush became a second clause). The
 * closure is pure — the mark and the channel are its arguments — so one may serve every plot.
 */
export function bin(field: string, options: Parameters<typeof vgBin>[1] = {}): ReturnType<typeof vgBin> {
  const key = JSON.stringify([field, options]);
  let transform = made.get(key);
  if (!transform) {
    transform = vgBin(field, options);
    made.set(key, transform);
  }
  return transform;
}
