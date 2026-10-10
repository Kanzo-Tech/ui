import { describe, expect, it } from "vitest";
import { Query, asTableRef } from "@uwdata/mosaic-sql";
import { clauseColumns, clauseSemiJoin } from "./clause.js";
import { relationHops, relationIdentities, relationKey, relationQuery, relationRootKey, type JoinGraph } from "./relation.js";

const at = (table: string) => asTableRef(["jobs/7", table])!;

const GRAPH: JoinGraph = {
  types: [
    { name: "Person", table: at("Person"), key: "dense_id", columns: ["country", "age"] },
    { name: "Post", table: at("Post"), key: "dense_id", columns: ["length"] },
  ],
  edges: [
    { name: "Person_knows_Person", label: "knows", source: "Person", destination: "Person", table: at("Person_knows_Person"), src: "src", dst: "dst" },
    { name: "Post_hasCreator_Person", label: "hasCreator", source: "Post", destination: "Person", table: at("Post_hasCreator_Person"), src: "src", dst: "dst" },
  ],
};

describe("relationQuery", () => {
  it("reads a type on its own under its table's name, every column prefixed by the type and its key under its own name", () => {
    // No alias: mosaic-core's pre-aggregator evaluates these expressions against the bare table.
    expect(String(relationQuery(GRAPH, { root: "Post", path: [] }))).toBe(
      'SELECT "dense_id", "length" AS "Post.length" FROM "jobs/7"."Post"',
    );
  });

  it("joins an out-hop through its edge table, and numbers a type the path visits twice", () => {
    const sql = String(relationQuery(GRAPH, { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] }));
    expect(sql).toContain('"t1"."country" AS "Person2.country"');
    expect(sql).toContain('"t0"."dense_id" AS "dense_id", "t0"."country" AS "Person.country"');
    expect(sql).toContain('"t1"."dense_id" AS "Person2.dense_id"');
    expect(sql).toContain(
      'FROM "jobs/7"."Person" AS "t0" JOIN "jobs/7"."Person_knows_Person" AS "e1" ON ("e1"."src" = "t0"."dense_id") ' +
        'JOIN "jobs/7"."Person" AS "t1" ON ("t1"."dense_id" = "e1"."dst")',
    );
  });

  it("walks an in-hop from its destination back to its source", () => {
    const sql = String(relationQuery(GRAPH, { root: "Person", path: [{ edge: "Post_hasCreator_Person", direction: "in" }] }));
    expect(sql).toContain('ON ("e1"."dst" = "t0"."dense_id")');
    expect(sql).toContain('ON ("t1"."dense_id" = "e1"."src")');
    expect(sql).toContain('"t1"."length" AS "Post.length"');
  });

  it("composes like any table: a query over it reads it as a subquery", () => {
    const relation = relationQuery(GRAPH, { root: "Post", path: [] });
    expect(String(Query.select("*").from(relation))).toBe(`SELECT * FROM (${relation})`);
  });

  it("refuses a hop that does not leave the type it starts from", () => {
    expect(() => relationQuery(GRAPH, { root: "Post", path: [{ edge: "Person_knows_Person", direction: "out" }] })).toThrow(
      /no edge Person_knows_Person leaves Post/,
    );
  });
});

describe("relationKey", () => {
  it("is the root alone for a type, and spells each hop with its label and the type it reaches", () => {
    expect(relationKey(GRAPH, { root: "Person", path: [] })).toBe("Person");
    expect(
      relationKey(GRAPH, {
        root: "Person",
        path: [
          { edge: "Person_knows_Person", direction: "out" },
          { edge: "Post_hasCreator_Person", direction: "in" },
        ],
      }),
    ).toBe("Person>knows>Person<hasCreator<Post");
  });
});

describe("relationIdentities", () => {
  it("exposes every step's key with the type it identifies, the root's under its own name", () => {
    expect(relationIdentities(GRAPH, { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] })).toEqual([
      { column: "dense_id", type: "Person" },
      { column: "Person2.dense_id", type: "Person" },
    ]);
  });
});

describe("relationRootKey", () => {
  it("names the root's key by the root's own name, the one column of a relation that is not prefixed", () => {
    const graph: JoinGraph = { ...GRAPH, types: [GRAPH.types[0]!, { ...GRAPH.types[1]!, key: "post_id" }] };
    const relation = { root: "Post", path: [{ edge: "Post_hasCreator_Person", direction: "out" as const }] };
    expect(relationRootKey(graph, relation)).toBe("post_id");
    expect(relationRootKey(graph, { root: "Person", path: [] })).toBe("dense_id");
    // The column the query selects under that name, and the root's identity.
    expect(String(relationQuery(graph, relation))).toContain('"t0"."post_id" AS "post_id"');
    expect(relationIdentities(graph, relation)[0]).toEqual({ column: "post_id", type: "Post" });
  });

  it("throws on a root the graph has no type for", () => {
    expect(() => relationRootKey(GRAPH, { root: "Forum", path: [] })).toThrow(/the join graph has no type Forum/);
  });
});

describe("relationHops", () => {
  it("lists a type's out-edges, then its in-edges, each with the type at the other end", () => {
    expect(relationHops(GRAPH, "Person").map((h) => [h.hop.direction, h.label, h.to])).toEqual([
      ["out", "knows", "Person"],
      ["in", "knows", "Person"],
      ["in", "hasCreator", "Post"],
    ]);
  });

  it("gives each hop its fan-out when the graph carries counts", () => {
    // Edge rows over the rows of the type the hop leaves; a graph without counts gives none.
    const counted: JoinGraph = {
      types: GRAPH.types.map((t) => ({ ...t, rows: t.name === "Person" ? 4 : 10 })),
      edges: GRAPH.edges.map((e) => ({ ...e, rows: e.label === "knows" ? 6 : 10 })),
    };
    expect(relationHops(counted, "Person").map((h) => [h.hop.direction, h.label, h.fanOut])).toEqual([
      ["out", "knows", 1.5],
      ["in", "knows", 1.5],
      ["in", "hasCreator", 2.5],
    ]);
    expect(relationHops(counted, "Post").map((h) => h.fanOut)).toEqual([1]);
    expect(relationHops(GRAPH, "Person").every((h) => h.fanOut === undefined)).toBe(true);
  });
});

describe("a semi-join on identity", () => {
  it("filters a relation by its root, the way it filters the root's table", () => {
    const relation = relationQuery(GRAPH, { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] });
    const ids = clauseSemiJoin("dense_id", [1, 2], { source: {} }).predicate!;
    expect(clauseColumns(ids)).toEqual(["dense_id"]);
    expect(String(Query.from(relation).select("Person2.country").where(ids))).toContain('WHERE ("dense_id" IN (1, 2))');
  });
});
