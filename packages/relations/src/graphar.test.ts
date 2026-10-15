import type { Queryable, Table } from "@kanzo-tech/kernel";
import { describe, expect, it } from "vitest";
import { readJoinGraph } from "./graphar.js";

/** An Arrow-shaped answer of `rows`, read by column as the reader reads one. */
function table(rows: readonly Record<string, unknown>[]): Table {
  const names = Object.keys(rows[0] ?? {});
  return {
    numRows: rows.length,
    schema: { fields: names.map((name) => ({ name })) },
    getChild: (name) => {
      if (!names.includes(name)) return null;
      const values = rows.map((r) => r[name]);
      return { length: values.length, get: (i) => values[i], toArray: () => values };
    },
  };
}

type Property = [type: string, property: string, engineType: string, primary: boolean, nullable: boolean];

/**
 * A catalog as `attachGraph` states one, answered by relation name: what the reader is held to here is
 * what it makes of the statements' answers. That those statements mean what it believes on a real
 * DuckDB is `@kanzo-tech/graph`'s `catalog.test.ts`, over an attached graph.
 */
function catalog(properties: readonly Property[]): Queryable & { sent: string[] } {
  const sent: string[] = [];
  const answers: [RegExp, Record<string, unknown>[]][] = [
    [/graphar_vertex_types/, [{ type: "Person", count: 20 }, { type: "Post", count: 10 }]],
    [/graphar_edge_types/, [
      { name: "Post_hasCreator_Person", src_type: "Post", edge_type: "hasCreator", dst_type: "Person", count: 10 },
      { name: "Post_about_Topic", src_type: "Post", edge_type: "about", dst_type: "Topic", count: 3 },
    ]],
    [/graphar_properties/, properties.map(([type, property, , is_primary, is_nullable]) => ({ type, property, is_primary, is_nullable }))],
    [/duckdb_columns/, properties.map(([table_name, column_name, data_type]) => ({ table_name, column_name, data_type }))],
    [/graphar_chunks/, []],
  ];
  return {
    sent,
    query: async (sql, { signal }) => {
      signal.throwIfAborted();
      sent.push(sql);
      const found = answers.find(([pattern]) => pattern.test(sql));
      if (!found) throw new Error(`no answer for ${sql}`);
      return table(found[1]);
    },
  };
}

const PROPERTIES: Property[] = [
  ["Person", "subject", "VARCHAR", true, false],
  ["Person", "country", "VARCHAR", false, true],
  ["Person", "age", "INTEGER", false, false],
  ["Post", "subject", "VARCHAR", true, false],
  ["Post", "length", "DOUBLE", false, false],
];

const read = (engine: Queryable) => readJoinGraph(engine, "jobs/7", { signal: new AbortController().signal });

describe("readJoinGraph", () => {
  it("keys a type by the global id, names its keys, and joins an edge on its global ends", async () => {
    const graph = await read(catalog(PROPERTIES));
    expect(graph.types.map((t) => [t.name, t.key, t.columns.map((c) => c.name)])).toEqual([
      ["Person", "dense_id", ["dense_id", "subject", "country", "age"]],
      ["Post", "dense_id", ["dense_id", "subject", "length"]],
      ["vertices", "dense_id", ["dense_id", "subject", "country", "age", "length"]],
    ]);
    const [person] = graph.types;
    expect(person!.columns).toEqual([
      { name: "dense_id", type: "UINTEGER", role: "address", nullable: false, stats: expect.objectContaining({ minValue: "0", maxValue: "19" }) },
      { name: "subject", type: "VARCHAR", role: "identity", nullable: false },
      { name: "country", type: "VARCHAR", nullable: true },
      { name: "age", type: "INTEGER", nullable: false },
    ]);
    expect(person).toMatchObject({ candidateKeys: ["dense_id", "subject"] });
    expect(String(person!.table)).toContain('"jobs/7"."Person"');
    expect(graph.edges[0]).toMatchObject({ label: "hasCreator", source: "Post", destination: "Person", src: "src", dst: "dst" });
  });

  it("numbers each type's ids from the counts before it, in the graph's order", async () => {
    const graph = await read(catalog(PROPERTIES));
    expect(String(graph.types[1]!.table)).toContain('20 + "_graphArVertexIndex"');
    expect(graph.types[1]!.columns[0]!.stats).toMatchObject({ distinctCount: 10, minValue: "20", maxValue: "29" });
    expect(String(graph.edges[0]!.table)).toContain('20 + "_graphArSrcIndex"');
  });

  it("carries each table's record count, so a hop can say its fan-out, and joins no edge to a type the graph does not declare", async () => {
    const graph = await read(catalog(PROPERTIES));
    expect(graph.types.map((t) => t.rows)).toEqual([20, 10, 30]);
    expect(graph.edges.map((e) => [e.name, e.rows])).toEqual([["Post_hasCreator_Person", 10]]);
  });

  it("holds every vertex as one more type, `vertices`, of every type, NULL where a type has no such column", async () => {
    const vertices = (await read(catalog(PROPERTIES))).types.at(-1)!;
    expect(vertices.of).toEqual(["Person", "Post"]);
    const sql = String(vertices.table);
    expect(sql).toContain("UNION ALL SELECT");
    expect(sql).toContain('NULL AS "length"');
    expect(sql).toContain('NULL AS "country"');
  });

  it("leaves out of `vertices` a column two types declare with different types", async () => {
    const graph = await read(catalog([...PROPERTIES, ["Post", "age", "DOUBLE", false, false]]));
    expect(graph.types.at(-1)!.columns.map((c) => c.name)).toEqual(["dense_id", "subject", "country", "length"]);
  });

  it("makes a type with no primary key one keyed and labelled by its id", async () => {
    const graph = await read(catalog(PROPERTIES.map(([t, p, e, , n]) => [t, p, e, false, n] as Property)));
    expect(graph.types.slice(0, 2).map((t) => t.candidateKeys)).toEqual([["dense_id"], ["dense_id"]]);
  });

  it("carries the caller's signal to every statement", async () => {
    const controller = new AbortController();
    controller.abort(new Error("left"));
    await expect(readJoinGraph(catalog(PROPERTIES), "jobs/7", { signal: controller.signal })).rejects.toThrow("left");
  });
});
