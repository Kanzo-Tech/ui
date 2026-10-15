import { describe, expect, it } from "vitest";
import { Query, asTableRef } from "@uwdata/mosaic-sql";
import { clauseColumns, clauseSemiJoin } from "@kanzo-tech/mosaic";
import { relationColumns, relationHops, relationKey, relationQuery, type JoinGraph } from "./relation.js";

const at = (table: string) => asTableRef(["jobs/7", table])!;

const GRAPH: JoinGraph = {
  types: [
    { name: "Person", table: at("Person"), key: "dense_id", columns: [{ name: "country", type: "VARCHAR" }, { name: "age", type: "VARCHAR" }] },
    { name: "Post", table: at("Post"), key: "dense_id", columns: [{ name: "length", type: "VARCHAR" }] },
  ],
  edges: [
    { name: "Person_knows_Person", label: "knows", source: "Person", destination: "Person", table: at("Person_knows_Person"), src: "src", dst: "dst" },
    { name: "Post_hasCreator_Person", label: "hasCreator", source: "Post", destination: "Person", table: at("Post_hasCreator_Person"), src: "src", dst: "dst" },
  ],
};

describe("relationQuery", () => {
  it("reads a type on its own under its table's name, every column under its own name", () => {
    // No alias: mosaic-core's pre-aggregator evaluates these expressions against the bare table.
    expect(String(relationQuery(GRAPH, { root: "Post", path: [] }))).toBe('SELECT "dense_id", "length" FROM "jobs/7"."Post"');
  });

  it("joins an out-hop through its edge table, and names each column by its path from the root", () => {
    const sql = String(relationQuery(GRAPH, { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] }));
    // A type met twice is two paths, not a numbered alias: the person, and the one they know.
    expect(sql).toContain('"t1"."country" AS "knows.country"');
    expect(sql).toContain('"t0"."dense_id" AS "dense_id", "t0"."country" AS "country"');
    expect(sql).toContain('"t1"."dense_id" AS "knows.dense_id"');
    expect(sql).toContain(
      'FROM "jobs/7"."Person" AS "t0" JOIN "jobs/7"."Person_knows_Person" AS "e1" ON ("e1"."src" = "t0"."dense_id") ' +
        'JOIN "jobs/7"."Person" AS "t1" ON ("t1"."dense_id" = "e1"."dst")',
    );
  });

  it("walks an in-hop from its destination back to its source", () => {
    const sql = String(relationQuery(GRAPH, { root: "Person", path: [{ edge: "Post_hasCreator_Person", direction: "in" }] }));
    expect(sql).toContain('ON ("e1"."dst" = "t0"."dense_id")');
    expect(sql).toContain('ON ("t1"."dense_id" = "e1"."src")');
    expect(sql).toContain('"t1"."length" AS "^hasCreator.length"');
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
    expect(String(Query.from(relation).select("knows.country").where(ids))).toContain('WHERE ("dense_id" IN (1, 2))');
  });
});

describe("relationColumns", () => {
  const described: JoinGraph = {
    ...GRAPH,
    types: [
      {
        ...GRAPH.types[0]!,
        candidateKeys: ["dense_id", "email"],
        columns: [
          { name: "dense_id", type: "UBIGINT", role: "address" },
          { name: "email", type: "VARCHAR" },
          { name: "age", type: "INTEGER", stats: { nullCount: 0, distinctCount: 60, mostCommonVals: [], mostCommonFreqs: [] } },
        ],
      },
      GRAPH.types[1]!,
    ],
  };

  it("describes a type by name under its table's own names, with what its writer found a key", () => {
    expect(relationColumns(described, "Person").map((c) => [c.name, c.type, c.of, c.candidateKey])).toEqual([
      ["dense_id", "UBIGINT", "Person", true],
      ["email", "VARCHAR", "Person", true],
      ["age", "INTEGER", "Person", false],
    ]);
  });

  it("describes a relation's columns under relationQuery's names, its paths, each by its step's type and with its counts", () => {
    const relation = { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" as const }] };
    const columns = relationColumns(described, relation);
    expect(columns.map((c) => c.name)).toEqual(["dense_id", "email", "age", "knows.dense_id", "knows.email", "knows.age"]);
    expect(columns.find((c) => c.name === "knows.age")?.stats?.distinctCount).toBe(60);
    // Every name it gives is one the query projects.
    const sql = String(relationQuery(described, relation));
    for (const { name } of columns) expect(sql).toContain(`AS "${name}"`);
  });
});
