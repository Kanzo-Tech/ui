import { attachFixture, connection, queryable } from "@kanzo-tech/fixtures";
import type { Graph, Pattern } from "@kanzo-tech/graphar-duckdb";
import { clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { Query, column, verbatim, type ExprNode } from "@uwdata/mosaic-sql";
import { beforeAll, describe, expect, it } from "vitest";
import { crossfilterOver, onRelation, relationOver, sameRelation, type Relation } from "./crossfilter.js";

/**
 * **The page's crossfilter over a real graph**: `@kanzo-tech/fixtures`' `toy`, attached by
 * `attachGraph` on a real DuckDB-WASM, and every predicate the resolver writes run against it — so what
 * a crossing keeps is what DuckDB answers, not what the SQL looks like. The toy, by hand: `Person`
 * `0 … 9` with `score = i + 1`, living in `Place` `i % 6`, `Place` `0 … 5` named `Place i`, and
 * `Person i` knowing `Person i + 1`.
 */

let graph: Graph;
beforeAll(async () => {
  graph = await attachFixture("toy", queryable());
});

const PERSON: Pattern = [{ as: "person", type: "Person" }];
const PLACE: Pattern = [{ as: "place", type: "Place" }];
const LIVES: Pattern = [{ as: "person", type: "Person" }, { edge: "livesIn", direction: "out" }, { as: "home", type: "Place" }];

/** A client that reads `relation`, as a tile does. */
const reading = (relation: Relation) => ({ relation }) as never;
/** A clause's publisher, which is no client of the relation it reads. */
const source = () => ({ reset() {} });

/** The first vertex of `relation` on every row the page's clauses keep, in order. */
function kept(relation: Relation, clauses: readonly SelectionClause[]): number[] {
  const page = crossfilterOver(graph);
  for (const clause of clauses) page.update(clause);
  const where = (page.predicate(reading(relation)) ?? []) as ExprNode[];
  const query = Query.select({ i: relation.roots[0]!.index }).from(relation.table).where(where).orderby("i");
  const answer = connection.query(String(query)) as unknown as { getChild(name: string): { toArray(): ArrayLike<number> } };
  return [...new Set(Array.from(answer.getChild("i").toArray(), Number))];
}

describe("relationOver", () => {
  it("reads a column per named vertex for its index and one per property of every named element, as variable.property", () => {
    const relation = relationOver(graph, LIVES);
    const answer = connection.query(`SELECT * FROM ${String(relation.table)} LIMIT 0`) as unknown as { schema: { fields: { name: string }[] } };
    const names = answer.schema.fields.map((f) => f.name);
    expect(names.slice(0, 2)).toEqual(["person", "home"]);
    expect(names).toEqual(expect.arrayContaining(["person.score", "person.name", "home.name"]));
    expect(relation.roots.map((r) => r.type)).toEqual(["Person"]);
    expect(relation.vertices.map((v) => [v.type, v.variable])).toEqual([
      ["Person", "person"],
      ["Place", "home"],
    ]);
  });

  it("is one relation for one pattern, however often it is read", () => {
    expect(sameRelation(relationOver(graph, LIVES), relationOver(graph, LIVES))).toBe(true);
    expect(sameRelation(relationOver(graph, LIVES), relationOver(graph, PERSON))).toBe(false);
  });

  it("refuses a pattern whose first vertex has no name: it is what the relation counts and crosses by", () => {
    expect(() => relationOver(graph, [{ type: "Person" }, { edge: "livesIn", direction: "out" }, { as: "home", type: "Place" }])).toThrow(TypeError);
  });
});

describe("a clause read by a client of another relation", () => {
  it("reaches a client of its own relation as published", () => {
    const people = relationOver(graph, PERSON);
    expect(kept(people, [onRelation(clauseInterval("person.score", [2, 5], { source: source() }), people)])).toEqual([1, 2, 3, 4]);
  });

  it("lands on the client's vertex of the same type: the people who live in Place 3", () => {
    const lives = relationOver(graph, LIVES);
    const clause = onRelation(clausePoint("home.name", "Place 3", { source: source() }), lives);
    expect(kept(relationOver(graph, PERSON), [clause])).toEqual([3, 9]);
  });

  it("is carried along the graph's one shortest path where the client holds no vertex of its type", () => {
    const people = relationOver(graph, PERSON);
    // People 1–4 live in Places 1–4: Person to Place is one hop, and the only one.
    const clause = onRelation(clauseInterval("person.score", [2, 5], { source: source() }), people);
    expect(kept(relationOver(graph, PLACE), [clause])).toEqual([1, 2, 3, 4]);
  });

  it("crosses every clause of one relation together: the rows where both hold, not each one's", () => {
    const lives = relationOver(graph, LIVES);
    const clauses = [
      onRelation(clauseInterval("person.score", [2, 5], { source: source() }), lives),
      onRelation(clausePoint("home.name", "Place 3", { source: source() }), lives),
    ];
    expect(kept(relationOver(graph, PERSON), clauses)).toEqual([3]);
  });

  it("keeps none where the graph has no way across", () => {
    const people = relationOver(graph, PERSON);
    const elsewhere: Relation = {
      key: "elsewhere",
      table: verbatim("(SELECT 0 AS i)"),
      vertices: [{ type: "Elsewhere", index: column("i") }],
      roots: [{ type: "Elsewhere", index: column("i") }],
    };
    const page = crossfilterOver(graph);
    page.update(onRelation(clausePoint("i", 0, { source: source() }), elsewhere));
    expect((page.predicate(reading(people)) as ExprNode[]).map(String)).toEqual(["FALSE"]);
  });

  it("reaches every client as published where the clause or the client names no relation", () => {
    const page = crossfilterOver(graph);
    page.update(clausePoint("x", 1, { source: source() }));
    expect((page.predicate(reading(relationOver(graph, PERSON))) as ExprNode[]).map(String)).toEqual(['("x" = 1)']);
    const people = relationOver(graph, PERSON);
    const other = crossfilterOver(graph);
    other.update(onRelation(clausePoint("person.name", "Person 1", { source: source() }), people));
    expect((other.predicate({} as never) as ExprNode[]).map(String)).toEqual(['("person.name" = \'Person 1\')']);
  });
});
