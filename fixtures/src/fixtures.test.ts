import { describe, expect, it } from "vitest";
import { attachFixture, type FixtureGraph, queryable } from "./index";

const rows = async (engine: ReturnType<typeof queryable>, sql: string) =>
  (await engine.query(sql, { signal: new AbortController().signal })) as unknown as { toArray(): Record<string, unknown>[] };

/**
 * What every test that reads a fixture rests on: each graph attaches as a page attaches it, its counts
 * are the sample's, and each vertex chunk carries what the writer counted in its footer.
 */
describe("the fixture graphs", () => {
  it.each([
    ["nobel", { Country: 21, Category: 6, University: 41, Laureate: 64, LaureateAward: 64 }],
    ["openflights", { Airport: 54 }],
    ["snb", { Person: 12 }],
  ] as [FixtureGraph, Record<string, number>][])("attaches %s, with the sample's counts", async (name, counts) => {
    const engine = queryable();
    const { catalog } = await attachFixture(name, engine);
    const types = (await rows(engine, `SELECT type, count FROM ${catalog}.graphar_vertex_types`)).toArray();
    const counted = Object.fromEntries(types.map((t) => [t.type, Number(t.count)]));
    expect(counted).toMatchObject(counts);
  });

  it.each(["nobel", "openflights", "snb"] as FixtureGraph[])("writes the writer's counts in every vertex chunk of %s", async (name) => {
    const engine = queryable();
    const { catalog } = await attachFixture(name, engine);
    const chunks = (await rows(engine, `SELECT path FROM ${catalog}.graphar_chunks WHERE kind = 'vertex'`)).toArray();
    expect(chunks.length).toBeGreaterThan(0);
    const stated = (
      await rows(
        engine,
        `SELECT DISTINCT file_name FROM parquet_kv_metadata([${chunks.map((c) => `'${c.path}'`).join(", ")}]) WHERE decode(key) = 'fossil:stats'`,
      )
    ).toArray();
    expect(stated).toHaveLength(chunks.length);
  });
});
