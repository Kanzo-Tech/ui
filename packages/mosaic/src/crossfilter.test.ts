import { MosaicClient, clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { asTableRef, sql } from "@uwdata/mosaic-sql";
import { describe, expect, it, vi } from "vitest";
import { clauseSemiJoin } from "./clause.js";
import { JoinResolver, crossfilterOver, onRelation, preaggregateOwnRelation, readOf, relationOf, sameRelation, type JoinField, type RelationRef } from "./crossfilter.js";
import { relationQuery, type JoinGraph, type Relation } from "./relation.js";

const at = (table: string) => asTableRef(["c", table])!;

const JOINS: JoinGraph = {
  types: [
    { name: "Person", table: at("Person"), key: "dense_id", columns: ["country", "age"] },
    { name: "Post", table: at("Post"), key: "dense_id", columns: ["length"] },
    { name: "Tag", table: at("Tag"), key: "dense_id", columns: [] },
    { name: "vertices", table: at("vertices"), key: "dense_id", columns: ["country", "age", "length"], of: ["Person", "Post", "Tag"] },
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
    const clause = onRelation(clauseInterval("age", [20, 30], { source: {} }), PERSON);
    const [predicate] = resolver.predicate([clause], clause, on(PERSON)) as unknown[];
    expect(predicate).toBe(clause.predicate);
  });

  it("crosses a clause into another relation by the key of the step of its root's type", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clauseInterval("age", [20, 30], { source: {} }), PERSON);
    expect(where(resolver.predicate([clause], clause, on(POSTS_BY)))).toBe(
      `("hasCreator.dense_id" IN (SELECT "dense_id" FROM (SELECT "dense_id", "country", "age" FROM "c"."Person") WHERE ("age" BETWEEN 20 AND 30)))`,
    );
  });

  it("keeps none of a relation with no step of the clause's type", () => {
    const resolver = new JoinResolver(JOINS);
    const clause = onRelation(clauseInterval("age", [20, 30], { source: {} }), PERSON);
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
    const a = onRelation(clauseInterval("age", [20, 30], { source: {} }), PERSON);
    const b = onRelation(clausePoint("country", "ES", { source: {} }), PERSON);
    const raw = clauseSemiJoin("dense_id", [1, 2], { source: {} });
    const out = resolver.predicate([a, raw, b], b, on("Post")) as unknown[];
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(raw.predicate);
    // Post has no Person step: the two cross together, to nothing.
    expect(String(out[1])).toBe("FALSE");
    const read = resolver.predicate([a, raw, b], b, on(POSTS_BY)) as unknown[];
    expect(String(read[1])).toContain(`WHERE ("age" BETWEEN 20 AND 30) AND ("country" IN ('ES'))`);
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
    expect(String(readOf(JOINS, POSTS_BY).table)).toContain(`"t1"."age" AS "hasCreator.age"`);
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

/** The Nobel example's graph: an award, its laureate, its category, and the affiliation it was won at. */
const type = (name: string, columns: string[]) => ({ name, table: at(name), key: "dense_id", columns });
const edge = (source: string, label: string, destination: string, name = `${source}_${label}_${destination}`) => ({
  name,
  label,
  source,
  destination,
  table: at(name),
  src: "src",
  dst: "dst",
});
const NOBEL: JoinGraph = {
  types: [
    type("Award", ["year", "share"]),
    type("Laureate", ["name", "gender"]),
    type("Category", ["name"]),
    type("Affiliation", ["name"]),
    type("University", ["name"]),
    type("Country", ["name"]),
  ],
  edges: [
    edge("Award", "laureate", "Laureate"),
    edge("Award", "category", "Category"),
    edge("Award", "affiliation", "Affiliation"),
    edge("Affiliation", "university", "University"),
    edge("Laureate", "birthPlace", "Country"),
    edge("University", "addressCountry", "Country"),
  ],
};
const nobel = new JoinResolver(NOBEL);
const AWARD: Relation = { root: "Award", path: [] };
const BY_UNIVERSITY: Relation = {
  root: "Award",
  path: [
    { edge: "Award_affiliation_Affiliation", direction: "out" },
    { edge: "Affiliation_university_University", direction: "out" },
  ],
};

describe("JoinResolver, the one door to the joins", () => {
  it("names each step of a relation by its path from the root, with its key: the root's bare", () => {
    expect(nobel.steps(BY_UNIVERSITY)).toEqual([
      { path: "", type: "Award", key: "dense_id" },
      { path: "affiliation", type: "Affiliation", key: "affiliation.dense_id" },
      { path: "affiliation.university", type: "University", key: "affiliation.university.dense_id" },
    ]);
    expect(nobel.steps("Award")).toEqual([{ path: "", type: "Award", key: "dense_id" }]);
    expect(nobel.steps("flights")).toEqual([]);
    expect(String(relationQuery(NOBEL, BY_UNIVERSITY))).toContain('"t2"."name" AS "affiliation.university.name"');
  });

  it("walks every field path from a type within its hops, never back along the edge just taken", () => {
    expect(nobel.paths("Award", 0)).toEqual(["year", "share"]);
    const paths = nobel.paths("Award", 2);
    expect(paths).toEqual(expect.arrayContaining(["category.name", "affiliation.university.name", "laureate.birthPlace.name"]));
    // In, from the laureate's side: the awards of a laureate, and theirs.
    expect(nobel.paths("Laureate", 2)).toEqual(expect.arrayContaining(["^laureate.year", "^laureate.category.name"]));
    expect(paths.some((p) => p.startsWith("laureate.^laureate"))).toBe(false);
    expect(nobel.paths("Nowhere")).toEqual([]);
  });

  it("finds the one relation the shown paths lie on, each path its own column there", () => {
    expect(nobel.relation("Award", ["affiliation.university.name", "year"])).toEqual(BY_UNIVERSITY);
    expect(nobel.relation("Award", ["year"])).toEqual(AWARD);
    // A path's count names a step, not a column.
    expect(nobel.relation("Award", ["affiliation"])).toEqual({ root: "Award", path: [BY_UNIVERSITY.path[0]] });
  });

  it("says why a path is not the graph's, at the segment that is not", () => {
    expect(nobel.relation("Award", ["affiliation.city.name"])).toEqual({ code: "join/no-step", path: "affiliation.city.name", segment: "city", at: "affiliation" });
    expect(nobel.relation("Award", ["category.label"])).toEqual({ code: "join/no-field", path: "category.label", type: "Category", column: "label" });
    expect(nobel.relation("Award", ["category.name", "affiliation.name"])).toEqual({ code: "join/branches", paths: ["category.name", "affiliation.name"] });
  });

  it("reads a field on the relation where it is, and one off it through the branch from the step it leaves", () => {
    expect(nobel.field(BY_UNIVERSITY, "affiliation.name")).toEqual({ relation: BY_UNIVERSITY, column: "affiliation.name", at: "affiliation" });
    const category = nobel.field(BY_UNIVERSITY, "category.name");
    expect(category).toEqual({ relation: { root: "Award", path: [{ edge: "Award_category_Category", direction: "out" }] }, column: "category.name", at: "" });
    const country = nobel.field(BY_UNIVERSITY, "affiliation.university.addressCountry.name");
    expect(country).toEqual({
      relation: { root: "University", path: [{ edge: "University_addressCountry_Country", direction: "out" }] },
      column: "addressCountry.name",
      at: "affiliation.university",
    });
  });

  it("crosses a condition off the relation in at the step its branch leaves, not the first of its type", () => {
    const people: JoinGraph = { types: [JOINS.types[0]!], edges: [JOINS.edges[0]!] };
    const resolver = new JoinResolver(people);
    const knows: Relation = { root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] };
    // People who know an Ann: the condition is on the one they know.
    const f = resolver.field({ root: "Person", path: [] }, "knows.country");
    expect(f).toMatchObject({ column: "knows.country", at: "" });
    const branch = resolver.field(knows, "knows.knows.country");
    expect(branch).toMatchObject({ column: "knows.country", at: "knows" });
    const where = resolver.crossing((branch as JoinField).relation, [sql`"knows.country" = 'ES'`], knows, (branch as JoinField).at);
    expect(String(where)).toMatch(/^\("knows\.dense_id" IN \(SELECT "dense_id" FROM/);
    expect(resolver.at(knows, "Person")).toEqual({ path: "", type: "Person", key: "dense_id" });
  });
});
