// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachFixture, queryable } from "@kanzo-tech/fixtures";
import type { Queryable } from "@kanzo-tech/kernel";
import { describe, expect, it } from "vitest";
import { readJoinGraph } from "./graphar.js";

/**
 * The reader over a graph fossil wrote — the Nobel sample, prizes of 2000 to 2004 — attached as a page
 * attaches it, on DuckDB-WASM: what is held here is what the writer wrote and the attach made of it,
 * never a catalog stated by hand (`/docs/design/testing`). The sample, in the graph document's order:
 * 21 countries, 6 categories, 41 universities, 64 laureates and their 64 awards.
 */
const signal = () => new AbortController().signal;
const read = (engine: Queryable, from: string) => readJoinGraph(engine, from, { signal: signal() });
/** An answer's rows, as plain objects. */
const rows = async (engine: Queryable, sql: string) =>
  ((await engine.query(sql, { signal: signal() })) as unknown as { toArray(): { toJSON(): Record<string, unknown> }[] })
    .toArray()
    .map((row) => row.toJSON());

async function nobel() {
  const engine = queryable();
  const { catalog } = await attachFixture("nobel", engine);
  return { engine, from: catalog };
}

describe("readJoinGraph", () => {
  it("keys a type by the global id, names its keys, and joins an edge on its global ends", async () => {
    const { engine, from } = await nobel();
    const graph = await read(engine, from);
    expect(graph.types.map((t) => [t.name, t.key])).toEqual(
      ["Country", "Category", "University", "Laureate", "LaureateAward", "vertices"].map((name) => [name, "dense_id"]),
    );
    const laureate = graph.types.find((t) => t.name === "Laureate")!;
    expect(laureate.columns.map((c) => [c.name, c.type, c.role, c.nullable])).toEqual([
      ["dense_id", "UINTEGER", "address", false],
      ["subject", "VARCHAR", "identity", false],
      ["name", "VARCHAR", undefined, false],
      ["gender", "VARCHAR", undefined, true],
      ["birthday", "DATE", undefined, true],
    ]);
    expect(laureate.candidateKeys).toEqual(["dense_id", "subject"]);
    expect(String(laureate.table)).toContain(`"${from}"."Laureate"`);
    const won = graph.edges.find((e) => e.name === "LaureateAward_laureate_Laureate")!;
    expect(won).toMatchObject({ label: "laureate", source: "LaureateAward", destination: "Laureate", src: "src", dst: "dst" });
    // Every award's laureate lands on a laureate, by global id: the join the engine runs is the edge's.
    const [joined] = await rows(
      engine,
      `SELECT count(*)::INTEGER AS n FROM (${String(won.table)}) e
         JOIN (${String(graph.types.find((t) => t.name === "LaureateAward")!.table)}) a ON e.src = a.dense_id
         JOIN (${String(laureate.table)}) l ON e.dst = l.dense_id`,
    );
    expect(joined).toEqual({ n: 64 });
  });

  it("numbers each type's ids from the counts before it, in the graph's order", async () => {
    const { engine, from } = await nobel();
    const graph = await read(engine, from);
    const laureate = graph.types.find((t) => t.name === "Laureate")!;
    // 21 countries, 6 categories and 41 universities before it.
    expect(String(laureate.table)).toContain('68 + "_graphArVertexIndex"');
    expect(laureate.columns[0]!.stats).toMatchObject({ distinctCount: 64, minValue: "68", maxValue: "131" });
    const [{ min, max }] = (await rows(engine, `SELECT min(dense_id)::INTEGER AS min, max(dense_id)::INTEGER AS max FROM (${String(laureate.table)})`)) as [
      { min: number; max: number },
    ];
    expect([min, max]).toEqual([68, 131]);
  });

  it("carries each table's record count, so a hop can say its fan-out", async () => {
    const { engine, from } = await nobel();
    const graph = await read(engine, from);
    expect(graph.types.map((t) => t.rows)).toEqual([21, 6, 41, 64, 64, 196]);
    // One laureate has no country of birth, the United Nations; 56 awards name a university.
    expect(graph.edges.map((e) => [e.name, e.rows])).toEqual([
      ["University_addressCountry_Country", 41],
      ["Laureate_birthPlace_Country", 63],
      ["LaureateAward_laureate_Laureate", 64],
      ["LaureateAward_category_Category", 64],
      ["LaureateAward_university_University", 56],
    ]);
  });

  it("holds every vertex as one more type, `vertices`, of every type, NULL where a type has no such column", async () => {
    const { engine, from } = await nobel();
    const vertices = (await read(engine, from)).types.at(-1)!;
    expect(vertices.of).toEqual(["Country", "Category", "University", "Laureate", "LaureateAward"]);
    const [counted] = await rows(
      engine,
      `SELECT count(*)::INTEGER AS every, count(gender)::INTEGER AS gendered, count(share)::INTEGER AS shared FROM (${String(vertices.table)})`,
    );
    // Only a laureate has a gender, and 63 of the 64 state one; only an award has a share.
    expect(counted).toEqual({ every: 196, gendered: 63, shared: 64 });
  });

  it("leaves out of `vertices` a column two types declare with different types", async () => {
    const { engine, from } = await nobel();
    // A university's `lat` as text, beside an award's as a number.
    await engine.query(
      `ALTER VIEW ${from}."University" RENAME TO written;
       CREATE VIEW ${from}."University" AS SELECT * REPLACE (lat::VARCHAR AS lat) FROM ${from}.written;`,
      { signal: signal() },
    );
    const columns = (await read(engine, from)).types.at(-1)!.columns.map((c) => c.name);
    expect(columns).not.toContain("lat");
    expect(columns).toContain("long");
  });

  it("makes a type with no primary key one keyed and labelled by its id", async () => {
    const { engine, from } = await nobel();
    await engine.query(
      `ALTER VIEW ${from}.graphar_properties RENAME TO written;
       CREATE VIEW ${from}.graphar_properties AS SELECT * REPLACE (false AS is_primary) FROM ${from}.written;`,
      { signal: signal() },
    );
    const graph = await read(engine, from);
    expect(graph.types.slice(0, -1).map((t) => t.candidateKeys)).toEqual(Array.from({ length: 5 }, () => ["dense_id"]));
  });

  it("reads what fossil counted from each chunk's footer, and the footer's nulls and extent", async () => {
    const { engine, from } = await nobel();
    const graph = await read(engine, from);
    const column = (type: string, name: string) => graph.types.find((t) => t.name === type)!.columns.find((c) => c.name === name)!;
    expect(column("Laureate", "gender").stats).toEqual({
      nullCount: 1,
      distinctCount: 2,
      mostCommonVals: ["male", "female"],
      mostCommonFreqs: [0.921875, 0.0625],
    });
    expect(column("LaureateAward", "date").stats).toMatchObject({ nullCount: 0, distinctCount: 5, minValue: "2000", maxValue: "2004" });
    // A key repeats no value, so fossil writes no commonest values: its distinct count is still read.
    expect(column("Laureate", "subject").stats).toEqual({ nullCount: 0, distinctCount: 64, mostCommonVals: [], mostCommonFreqs: [] });
    // A text's extent is never read.
    expect(column("Laureate", "name").stats).not.toHaveProperty("minValue");
  });

  it("reads nothing from a footer whose fossil:stats is of a version it does not know", async () => {
    const { engine, from } = await nobel();
    // Laureate's chunk again, its footer stating the same counts as a version 2 would.
    const [chunk] = await rows(engine, `SELECT path FROM ${from}.graphar_chunks WHERE type = 'Laureate' AND kind = 'vertex'`);
    const path = String(chunk!.path);
    const file = join(mkdtempSync(join(tmpdir(), "relations-")), "laureate.parquet");
    await engine.query(
      `COPY (SELECT * FROM read_parquet('${path}')) TO '${file}'
         (FORMAT parquet, KV_METADATA {'fossil:stats': '{"version":2,"columns":{"gender":{"distinct_count":2}}}'});
       ALTER VIEW ${from}.graphar_chunks RENAME TO written;
       CREATE VIEW ${from}.graphar_chunks AS
         SELECT type, kind, CASE WHEN path = '${path}' THEN '${file}' ELSE path END AS path FROM ${from}.written;`,
      { signal: signal() },
    );
    const gender = (await read(engine, from)).types.find((t) => t.name === "Laureate")!.columns.find((c) => c.name === "gender")!;
    expect(gender).not.toHaveProperty("stats");
  });

  it("carries the caller's signal to every statement", async () => {
    const { engine, from } = await nobel();
    const controller = new AbortController();
    controller.abort(new Error("left"));
    await expect(readJoinGraph(engine, from, { signal: controller.signal })).rejects.toThrow("left");
  });
});
