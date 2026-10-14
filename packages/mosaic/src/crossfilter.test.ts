import { MosaicClient, clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { asTableRef } from "@uwdata/mosaic-sql";
import { describe, expect, it, vi } from "vitest";
import { clauseSemiJoin } from "./clause.js";
import { JoinResolver, crossfilterOver, onRelation, preaggregateOwnRelation, readOf, relationOf, sameRelation, type RelationRef } from "./crossfilter.js";
import type { JoinGraph, Relation } from "./relation.js";

const at = (table: string) => asTableRef(["c", table])!;

const JOINS: JoinGraph = {
  types: [
    { name: "Person", table: at("Person"), key: "dense_id", columns: [{ name: "country", type: "VARCHAR" }, { name: "age", type: "VARCHAR" }] },
    { name: "Post", table: at("Post"), key: "dense_id", columns: [{ name: "length", type: "VARCHAR" }] },
    { name: "Tag", table: at("Tag"), key: "dense_id", columns: [] },
    { name: "vertices", table: at("vertices"), key: "dense_id", columns: [{ name: "country", type: "VARCHAR" }, { name: "age", type: "VARCHAR" }, { name: "length", type: "VARCHAR" }], of: ["Person", "Post", "Tag"] },
  ],
  edges: [
    { name: "Person_knows_Person", label: "knows", source: "Person", destination: "Person", table: at("Person_knows_Person"), src: "src", dst: "dst" },
    { name: "Post_hasCreator_Person", label: "hasCreator", source: "Post", destination: "Person", table: at("Post_hasCreator_Person"), src: "src", dst: "dst" },
  ],
};

const PERSON: Relation = { root: "Person", path: [] };
const POSTS_BY: Relation = { root: "Post", path: [{ edge: "Post_hasCreator_Person", direction: "out" }] };

/** A client that reads `relation`. */
const on = (relation: RelationRef | null) => Object.assign(new MosaicClient(), { relation });
const where = (filter: unknown) => [filter].flat().map(String).join(" AND ");

describe("the page's crossfilter across relations", () => {
  it("hands a clause to a client of the relation it was published on as it was published", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clauseInterval("Person.age", [20, 30], { source: {} }), PERSON);
    const [predicate] = resolver.predicate([clause], clause, on(PERSON)) as unknown[];
    expect(predicate).toBe(clause.predicate);
  });

  it("crosses a clause into another relation by the key of the step of its root's type", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clauseInterval("Person.age", [20, 30], { source: {} }), PERSON);
    expect(where(resolver.predicate([clause], clause, on(POSTS_BY)))).toBe(
      `("Person.dense_id" IN (SELECT "dense_id" FROM (SELECT "dense_id", "country" AS "Person.country", "age" AS "Person.age" FROM "c"."Person") WHERE ("Person.age" BETWEEN 20 AND 30)))`,
    );
  });

  it("keeps none of a relation with no step of the clause's type", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clauseInterval("Person.age", [20, 30], { source: {} }), PERSON);
    expect(where(resolver.predicate([clause], clause, on("Tag")))).toBe("FALSE");
    // A table the joins do not have has no key to cross by.
    expect(where(resolver.predicate([clause], clause, on("flights")))).toBe("FALSE");
  });

  it("crosses into and out of a union by the key its types share", () => {
    const resolver = new JoinResolver(JOINS);
    const person = onRelation(clausePoint("country", "ES", { source: {} }), "Person");
    expect(where(resolver.predicate([person], person, on("vertices")))).toBe(
      `("dense_id" IN (SELECT "dense_id" FROM "c"."Person" WHERE ("country" IN ('ES'))))`,
    );
    const window = onRelation(clauseInterval("age", [1, 2], { source: {} }), "vertices");
    expect(where(resolver.predicate([window], window, on(PERSON)))).toBe(
      `("dense_id" IN (SELECT "dense_id" FROM "c"."vertices" WHERE ("age" BETWEEN 1 AND 2)))`,
    );
  });

  it("crosses every clause on one relation together, and leaves clauses that name no relation as published", () => {
    const resolver = new JoinResolver(JOINS);
    const a = onRelation(clauseInterval("Person.age", [20, 30], { source: {} }), PERSON);
    const b = onRelation(clausePoint("Person.country", "ES", { source: {} }), PERSON);
    const raw = clauseSemiJoin("dense_id", [1, 2], { source: {} });
    const out = resolver.predicate([a, raw, b], b, on("Post")) as unknown[];
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(raw.predicate);
    // Post has no Person step: the two cross together, to nothing.
    expect(String(out[1])).toBe("FALSE");
    const read = resolver.predicate([a, raw, b], b, on(POSTS_BY)) as unknown[];
    expect(String(read[1])).toContain(`WHERE ("Person.age" BETWEEN 20 AND 30) AND ("Person.country" IN ('ES'))`);
  });

  it("is Mosaic's crossfilter otherwise: a client is exempt from its own clause, and a client naming no relation reads every clause as published", () => {
    const resolver = new JoinResolver(JOINS);
    const mine = on("Person");
    const own = onRelation(clausePoint("country", "ES", { source: mine, clients: new Set([mine]) }), "Person");
    expect(resolver.predicate([own], own, mine)).toBeUndefined();
    expect(resolver.predicate([own], null, mine)).toEqual([]);
    const plain = new MosaicClient();
    expect((resolver.predicate([own], own, plain) as unknown[])[0]).toBe(own.predicate);
  });

  it("reads the client's relation when it asks, so a client that moves needs nothing else", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clausePoint("country", "ES", { source: {} }), "Person");
    const client = on("Person");
    expect((resolver.predicate([clause], clause, client) as unknown[])[0]).toBe(clause.predicate);
    client.relation = "Tag";
    expect(where(resolver.predicate([clause], clause, client))).toBe("FALSE");
  });

  it("retracts a chip's clause from the one selection, calling its source back", () => {
    const page = crossfilterOver(JOINS);
    const reset = vi.fn();
    const clause = onRelation(clausePoint("country", "ES", { source: { reset } }), "Person");
    page.update(clause);
    page.reset([clause]);
    expect(reset).toHaveBeenCalledOnce();
    expect(page.clauses).toHaveLength(0);
  });
});

describe("relations, named", () => {
  it("reads a name the joins have as that type's table, any other name as a table, a path compiled, and SQL as written", () => {
    expect(readOf(JOINS, "Person")).toEqual({ table: at("Person"), relation: "Person" });
    expect(readOf(JOINS, "flights")).toEqual({ table: "flights", relation: "flights" });
    expect(String(readOf(JOINS, PERSON).table)).toContain(`"age" AS "Person.age"`);
    const node = at("x");
    expect(readOf(null, node)).toEqual({ table: node, relation: null });
    expect(() => readOf(null, PERSON)).toThrow(/no joins/);
  });

  it("is one relation by name, or by root and hops", () => {
    expect(sameRelation("Person", "Person")).toBe(true);
    expect(sameRelation("Person", PERSON)).toBe(false);
    expect(sameRelation({ root: "Post", path: [...POSTS_BY.path] }, POSTS_BY)).toBe(true);
    expect(sameRelation(POSTS_BY, { root: "Post", path: [] })).toBe(false);
  });

  it("carries the relation a clause was published on in its metadata, beside Mosaic's", () => {
    const clause: SelectionClause = onRelation(clauseInterval("age", [1, 2], { source: {} }), "Person");
    expect(clause.meta).toMatchObject({ type: "interval", relation: "Person" });
    expect(relationOf(clause)).toBe("Person");
    expect(relationOf(clausePoint("age", 1, { source: {} }))).toBeUndefined();
  });
});

describe("pre-aggregation", () => {
  it("is asked for a clause on the client's own relation, and not for one crossed into it", () => {
    const request = vi.fn(() => "view");
    const coordinator = { preaggregator: { request } };
    preaggregateOwnRelation(coordinator as never);
    preaggregateOwnRelation(coordinator as never);
    const page = crossfilterOver(JOINS);
    const own = onRelation(clausePoint("country", "ES", { source: {} }), "Person");
    const preaggregator = coordinator.preaggregator as unknown as { request(...a: unknown[]): unknown };
    expect(preaggregator.request(on("Person"), page, own)).toBe("view");
    expect(preaggregator.request(on("Post"), page, own)).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  });
});
