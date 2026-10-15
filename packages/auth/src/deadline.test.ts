import { describe, expect, it } from "vitest";
import { BOUNDS } from "./deadline";

/**
 * `/docs/design/failure`, *One deadline per wait*: an inner bound is strictly less than the one
 * around it, and an outer bound is at least the sum of the inner waits that run one after another
 * inside it. This reads the package's own table, so the next equal pair fails here and not in
 * production. It cannot prove a bound set in another repository (the API's, a reverse proxy's).
 */
describe("the bounds nest", () => {
  /** What waits inside what, and in sequence: the content of the design table's *Inside* column. */
  const inside: Record<string, { outer: number; sequence: readonly number[] }> = {
    // `/session`: one store read.
    "/session": { outer: BOUNDS.browser, sequence: [BOUNDS.store] },
    // `/refresh`: the store read, the grant at the IdP, the conditional write back.
    "/refresh": { outer: BOUNDS.browser, sequence: [BOUNDS.store, BOUNDS.idp, BOUNDS.store] },
    // The forwarder's token: a renewal, then the exchange, are two IdP requests one after the other.
    "renew then exchange": { outer: BOUNDS.browser, sequence: [BOUNDS.idp, BOUNDS.idp] },
    "the forwarder's hop": { outer: BOUNDS.browser, sequence: [BOUNDS.forwarder] },
  };

  it.each(Object.entries(inside))("%s expires before the browser's bound, by more than its sum", (_name, { outer, sequence }) => {
    for (const inner of sequence) expect(inner).toBeLessThan(outer);
    expect(sequence.reduce((sum, ms) => sum + ms, 0)).toBeLessThan(outer);
  });

  it("holds no two of the bounds equal", () => {
    const figures = Object.values(BOUNDS);
    expect(new Set(figures).size).toBe(figures.length);
  });
});
