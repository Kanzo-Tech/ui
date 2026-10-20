import { Query, count, isNotNull } from "@kanzo-tech/mosaic";
import { relationQuery } from "@kanzo-tech/relations";
import { describe, expect, it } from "vitest";
import { readJoinGraph } from "@kanzo-tech/relations";
import { attach, chunkOf, writeChunk, writtenChunkOf, type Attached } from "../../test/corpus";
import { columnNamed, identityOf, sizeOf, vertexTypes } from "./source";

/** `readJoinGraph` as the canvas reads it: the vertex types it draws, how many vertices, and the edges. */
async function readCatalog(engine: Attached["engine"], from: string) {
  const graph = await readJoinGraph(engine, from, { signal: new AbortController().signal });
  return { vertices: vertexTypes(graph), size: sizeOf(graph), edges: graph.edges };
}

/**
 * The one read of a graph's catalog, over a real DuckDB through a real coordinator: every fact
 * GraphAr's relations state reaches the `JoinGraph` as it is stated, the global id is the sum it is
 * defined as, and nothing is taken from a table's name.
 */
describe("the catalog, as the canvas reads it", () => {
  it("takes an edge's label and its ends from graphar_edge_types, never from the view's name", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `ALTER VIEW ${corpus.from}.graphar_edge_types RENAME TO written;
       CREATE VIEW ${corpus.from}.graphar_edge_types AS
         SELECT * REPLACE (CASE name WHEN 'Person_knows_Person' THEN 'acquaintance' ELSE edge_type END AS edge_type) FROM ${corpus.from}.written;`,
    );
    const { edges } = await readCatalog(corpus.engine, corpus.from);
    expect(edges.map((e) => [e.name, e.label, e.source, e.destination, e.rows])).toEqual([
      ["Person_knows_Person", "acquaintance", "Person", "Person", 9],
      ["Person_livesIn_Place", "livesIn", "Person", "Place", 10],
      ["Person_tagged_Tag", "tagged", "Person", "Tag", 1],
    ]);
  });

  it("numbers the types in the graph document's order, each from the counts before it", async () => {
    const corpus = await attach();
    const { vertices, size } = await readCatalog(corpus.engine, corpus.from);
    expect(vertices.map((v) => [v.name, v.first, v.rows, identityOf(v)])).toEqual([
      ["Person", 0, 10, "subject"],
      ["Place", 10, 6, "subject"],
      ["Tag", 16, 4, "subject"],
    ]);
    expect(size).toBe(20);
    const place = (await corpus.coordinator.query(Query.select("dense_id", "name").from(vertices[1]!.table).orderby("dense_id"), {
      type: "json",
    })) as Iterable<{ dense_id: number; name: string }>;
    expect(Array.from(place, (r) => [Number(r.dense_id), r.name])).toEqual([0, 1, 2, 3, 4, 5].map((i) => [10 + i, `Place ${i}`]));
  });

  it("gives each edge its ends as global ids, from GraphAr's per-type indices", async () => {
    const corpus = await attach();
    const { edges } = await readCatalog(corpus.engine, corpus.from);
    const lives = (await corpus.coordinator.query(Query.select("src", "dst").from(edges[1]!.table).orderby("src"), {
      type: "json",
    })) as Iterable<{ src: number; dst: number }>;
    expect(Array.from(lives, (r) => [Number(r.src), Number(r.dst)])).toEqual(Array.from({ length: 10 }, (_, i) => [i, 10 + (i % 6)]));
  });

  it("describes each column by the engine's type and GraphAr's primary key and nullability, the global id first", async () => {
    const corpus = await attach();
    const { vertices } = await readCatalog(corpus.engine, corpus.from);
    const person = vertices.find((v) => v.name === "Person")!;
    expect(person.columns.map((c) => c.name)).toEqual(["dense_id", "subject", "name", "team", "score", "lon", "lat", "born", "nickname"]);
    expect(columnNamed(person, "dense_id")).toMatchObject({ type: "UINTEGER", role: "address", nullable: false });
    expect(columnNamed(person, "subject")).toMatchObject({ type: "VARCHAR", role: "identity", nullable: false });
    expect(columnNamed(person, "born")).toMatchObject({ type: "BIGINT", nullable: false });
  });

  it("reads a multi-valued property as a list column of the type that owns it, and counts none of a list", async () => {
    const corpus = await attach();
    const { vertices } = await readCatalog(corpus.engine, corpus.from);
    const nickname = columnNamed(vertices.find((v) => v.name === "Person")!, "nickname");
    expect(nickname).toMatchObject({ type: "VARCHAR[]", nullable: false });
    expect(nickname?.stats).toBeUndefined();
  });

  it("makes a vertex type with no primary key a type of its own, labelled by its id", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `ALTER VIEW ${corpus.from}.graphar_properties RENAME TO written;
       CREATE VIEW ${corpus.from}.graphar_properties AS SELECT * REPLACE (false AS is_primary) FROM ${corpus.from}.written;`,
    );
    const { vertices, size } = await readCatalog(corpus.engine, corpus.from);
    expect(vertices.map((v) => [v.name, identityOf(v)])).toEqual([["Person", "dense_id"], ["Place", "dense_id"], ["Tag", "dense_id"]]);
    expect(size).toBe(20);
  });

  it("reads what the writer counted from the chunks' footers: its distinct and commonest values, and the footer's nulls and extent", async () => {
    const corpus = await attach();
    const { vertices } = await readCatalog(corpus.engine, corpus.from);
    const person = vertices.find((v) => v.name === "Person")!;
    expect(columnNamed(person, "born")?.stats).toMatchObject({ nullCount: 0, distinctCount: 10, minValue: "1900", maxValue: "1909" });
    expect(columnNamed(person, "team")?.stats).toMatchObject({
      distinctCount: 4,
      mostCommonVals: ["0", "1", "2", "3"],
      mostCommonFreqs: [0.3, 0.3, 0.2, 0.2],
    });
    // A text's extent is never read; a date's is, as the footer prints it.
    expect(columnNamed(person, "name")?.stats).not.toHaveProperty("minValue");
    expect(columnNamed(vertices.find((v) => v.name === "Place")!, "opened")?.stats).toMatchObject({ minValue: "2000-01-01", maxValue: "2005-01-01" });
    // The id's counts are the arithmetic's own.
    expect(columnNamed(person, "dense_id")?.stats).toMatchObject({ nullCount: 0, distinctCount: 10, minValue: "0", maxValue: "9" });
    expect(columnNamed(vertices.find((v) => v.name === "Place")!, "dense_id")?.stats).toMatchObject({ minValue: "10", maxValue: "15" });
    // Read once for the footers: a statement for the keys and one for the nulls and extent.
    expect(corpus.sent.filter((sql) => sql.includes("parquet_kv_metadata"))).toHaveLength(1);
  });

  it("counts nothing for a graph whose chunks state none", async () => {
    const corpus = await attach();
    // Chunks of the same rows that carry no `fossil:stats`, which the graph now lists instead.
    const types = ["Person", "Place", "Tag"];
    for (const type of types) writeChunk(chunkOf(corpus.from, type, 1), corpus.from, type, null);
    await corpus.coordinator.exec(
      `CREATE OR REPLACE VIEW ${corpus.from}.graphar_chunks AS SELECT * FROM (VALUES
         ${types.map((type) => `('${type}', 'vertex', '${chunkOf(corpus.from, type, 1)}')`).join(", ")}) t(type, kind, path);`,
    );
    const { vertices } = await readCatalog(corpus.engine, corpus.from);
    // The id's own counts are the arithmetic's, not a footer's.
    expect(vertices.every((v) => v.columns.every((c) => c.name === "dense_id" || c.stats === undefined))).toBe(true);
  });

  it("counts nothing of a column that two chunks of its type state, because counts do not combine", async () => {
    const corpus = await attach();
    // The second chunk states what the first does, read back from its footer.
    const [{ stats }] = (await corpus.coordinator.query(
      `SELECT decode(value) AS stats FROM parquet_kv_metadata('${writtenChunkOf(corpus.from, "Person")}') WHERE decode(key) = 'fossil:stats'`,
      { type: "json" },
    )) as unknown as [{ stats: string }];
    writeChunk(chunkOf(corpus.from, "Person", 1), corpus.from, "Person", stats);
    await corpus.coordinator.exec(
      `CREATE OR REPLACE VIEW ${corpus.from}.graphar_chunks AS
         SELECT * FROM (VALUES ('Person', 'vertex', '${writtenChunkOf(corpus.from, "Person")}'), ('Person', 'vertex', '${chunkOf(corpus.from, "Person", 1)}'),
           ('Place', 'vertex', '${writtenChunkOf(corpus.from, "Place")}'), ('Tag', 'vertex', '${writtenChunkOf(corpus.from, "Tag")}')) t(type, kind, path);`,
    );
    const { vertices } = await readCatalog(corpus.engine, corpus.from);
    const person = vertices.find((v) => v.name === "Person")!;
    expect(person.columns.every((c) => c.name === "dense_id" || c.stats === undefined)).toBe(true);
    expect(columnNamed(vertices.find((v) => v.name === "Place")!, "name")?.stats).toBeDefined();
  });

  it("is @kanzo-tech/relations' reader: every type and every relation of an attached graph, in global ids, joined", async () => {
    const corpus = await attach();
    const graph = await readJoinGraph(corpus.engine, corpus.from, { signal: new AbortController().signal });
    expect(graph.types.map((t) => t.name)).toEqual(["Person", "Place", "Tag", "vertices"]);
    // Ten people, each living in `10 + i % 6`: the join lands on Place's global ids.
    const relation = { root: "Person", path: [{ edge: "Person_livesIn_Place", direction: "out" as const }] };
    const rows = (await corpus.coordinator.query(
      Query.select({ n: count() }).from(relationQuery(graph, relation)).where(isNotNull("livesIn.name")),
    )) as Iterable<{ n: unknown }>;
    expect(Number(Array.from(rows)[0]!.n)).toBe(10);
  });
});
