import { describe, expect, it } from "vitest";
import { drawnOf, keptLinksOf, keptOf } from "./kept";

/** A path `0 → 1 → 2 → 3`: links `0`, `1`, `2`. */
const path = Float32Array.of(0, 1, 1, 2, 2, 3);

describe("a link is kept when both its ends are", () => {
  it.each([
    ["no mask keeps every link, said as none", null, null],
    ["every vertex kept keeps every link", Uint8Array.of(1, 1, 1, 1), [0, 1, 2]],
    ["one end greyed greys the link", Uint8Array.of(1, 1, 0, 1), [0]],
    ["both ends greyed greys the link", Uint8Array.of(1, 0, 0, 1), []],
    ["the pick inside the filter", keptOf(4, Uint8Array.of(1, 1, 0, 1), [1, 2, 3, 9]), []],
    ["a pick with no filter", keptOf(4, null, [1, 2]), [1]],
    ["a pick left out of everything", keptOf(4, null, [0], true), [1, 2]],
  ])("%s", (_, kept, links) => {
    expect(keptLinksOf(path, kept)).toEqual(links);
  });
});

describe("the links drawn are the kept ones with both ends placed", () => {
  const encoding = { ranks: new Uint32Array(4), domain: ["v"] };
  const everywhere = new Float32Array(8);
  const noSecond = Float32Array.of(0, 0, NaN, NaN, 0, 0, 0, 0);
  it.each([
    ["under a layout, no mask", everywhere, null, { edges: 3, placedLinks: 3 }],
    ["under a layout, a mask", everywhere, Uint8Array.of(1, 1, 0, 1), { edges: 1, placedLinks: 3 }],
    ["a vertex with no position, no mask", noSecond, null, { edges: 1, placedLinks: 1 }],
    ["a vertex with no position, its kept link not drawn", noSecond, Uint8Array.of(1, 1, 1, 1), { edges: 1, placedLinks: 1 }],
  ])("%s", (_, positions, kept, counts) => {
    const geometry = { size: 4, positions, links: path };
    expect(drawnOf(geometry, encoding, kept, keptLinksOf(path, kept))).toMatchObject({ ...counts, links: 3 });
  });
});
