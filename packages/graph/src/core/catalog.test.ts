import { Query } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { attach } from "../../test/corpus";
import { readCatalog } from "./catalog";

/**
 * The one read of a graph's catalog, over a real DuckDB through a real coordinator: every fact
 * GraphAr's relations state reaches the structure as it is stated, the global id is the sum it is
 * defined as, and nothing is taken from a table's name.
 */
describe("readCatalog", () => {
  it("takes an edge's label and its ends from graphar_edge_types, never from the view's name", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `ALTER VIEW ${corpus.from}.graphar_edge_types RENAME TO written;
       CREATE VIEW ${corpus.from}.graphar_edge_types AS
         SELECT * REPLACE (CASE name WHEN 'Person_knows_Person' THEN 'acquaintance' ELSE edge_type END AS edge_type) FROM ${corpus.from}.written;`,
    );
    const { edges } = await readCatalog(corpus.coordinator, corpus.from);
    expect(edges.map((e) => [e.name, e.label, e.source, e.destination, e.rows])).toEqual([
      ["Person_knows_Person", "acquaintance", "Person", "Person", 9],
      ["Person_livesIn_Place", "livesIn", "Person", "Place", 10],
      ["Person_tagged_Tag", "tagged", "Person", "Tag", 1],
    ]);
  });

  it("numbers the node types in the graph document's order, each from the counts before it, and skips a type with no primary key", async () => {
    const corpus = await attach();
    const { vertices, size } = await readCatalog(corpus.coordinator, corpus.from);
    expect(vertices.map((v) => [v.name, v.first, v.rows, v.identity])).toEqual([
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
    const { edges } = await readCatalog(corpus.coordinator, corpus.from);
    const lives = (await corpus.coordinator.query(Query.select("src", "dst").from(edges[1]!.table).orderby("src"), {
      type: "json",
    })) as Iterable<{ src: number; dst: number }>;
    expect(Array.from(lives, (r) => [Number(r.src), Number(r.dst)])).toEqual(Array.from({ length: 10 }, (_, i) => [i, 10 + (i % 6)]));
  });

  it("describes each column by the engine's type and GraphAr's primary key and nullability, the global id first", async () => {
    const corpus = await attach();
    const { vertices } = await readCatalog(corpus.coordinator, corpus.from);
    const person = vertices.find((v) => v.name === "Person")!;
    expect([...person.columns.keys()]).toEqual(["dense_id", "subject", "name", "team", "score", "lon", "lat", "born"]);
    expect(person.columns.get("dense_id")).toEqual({ type: "UINTEGER", primary: false, nullable: false });
    expect(person.columns.get("subject")).toEqual({ type: "VARCHAR", primary: true, nullable: false });
    expect(person.columns.get("born")).toEqual({ type: "INTEGER", primary: false, nullable: true });
  });
});
