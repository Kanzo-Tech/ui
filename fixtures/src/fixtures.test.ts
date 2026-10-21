import { describe, expect, it } from "vitest";
import { attachFixture, type FixtureGraph, queryable } from "./index";

/** What every test that reads a fixture rests on: each graph attaches as a page attaches it, and its counts are the sample's. */
describe("the fixture graphs", () => {
  it.each([
    ["nobel", { Country: 21, Category: 6, University: 41, Laureate: 64, LaureateAward: 64 }],
    ["openflights", { Airport: 54 }],
    ["snb", { Person: 12 }],
    ["toy", { Person: 10, Place: 6, Tag: 4 }],
  ] as [FixtureGraph, Record<string, number>][])("attaches %s, with the sample's counts", async (name, counts) => {
    const graph = await attachFixture(name, queryable());
    expect(Object.fromEntries(graph.vertexTypes.map((t) => [t.type, t.count]))).toMatchObject(counts);
  });
});
