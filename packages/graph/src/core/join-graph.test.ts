import { Query, count, isNotNull, relationQuery } from "@kanzo-tech/mosaic";
import { attach } from "../../test/corpus";
import { describe, expect, it } from "vitest";
import { joinGraphOf, readJoinGraph } from "./join-graph";
import type { Column, EdgeTable, Structure } from "./structure";

const column = (role: string | null, more: Partial<Column> = {}): Column => ({
  type: "string",
  sqlType: "VARCHAR",
  role,
  datatype: null,
  termType: null,
  iri: null,
  nullable: false,
  annotations: [],
  stats: null,
  ...more,
});
const columns = (entries: [string, Column][]) => new Map<string, Column>(entries);
const table = { candidateKeys: [], iri: null, annotations: [] };
const edge = (name: string, label: string, source: string, destination: string, more: Partial<EdgeTable> = {}): EdgeTable => ({
  name, label, source, destination, sourceKey: "src", destinationKey: "dst", rows: 10, iri: null, annotations: [], ...more,
});

const COUNTED = { nullCount: 0, distinctCount: 20, minValue: "18", maxValue: "77", mostCommonVals: ["30"], mostCommonFreqs: [0.1] };
const XSD_YEAR = "http://www.w3.org/2001/XMLSchema#gYear";
const LABEL = { predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { value: "person", language: "en" } };

const STRUCTURE: Structure = {
  from: "jobs/7",
  key: "dense_id",
  size: 30,
  vertices: [
    {
      name: "Person",
      first: 0,
      rows: 20,
      identity: "subject",
      ...table,
      candidateKeys: ["dense_id", "subject", "age"],
      annotations: [LABEL],
      columns: columns([
        ["dense_id", column("address", { sqlType: "UBIGINT" })],
        ["subject", column("identity", { termType: "rr:IRI" })],
        ["country", column(null)],
        ["age", column(null, { sqlType: "INTEGER", datatype: XSD_YEAR, stats: COUNTED })],
      ]),
    },
    { name: "Post", first: 20, rows: 10, identity: "subject", ...table, columns: columns([["dense_id", column("address", { sqlType: "UBIGINT" })], ["length", column(null, { sqlType: "DOUBLE" })]]) },
  ],
  edges: [edge("Post_hasCreator_Person", "hasCreator", "Post", "Person")],
  properties: [],
};

describe("joinGraphOf", () => {
  it("keys a type by its address, describes every column as the catalog does, and joins an edge on the keys it names", () => {
    const graph = joinGraphOf(STRUCTURE);
    expect(graph.types.map((t) => [t.name, t.key, t.columns.map((c) => c.name)])).toEqual([
      ["Person", "dense_id", ["dense_id", "subject", "country", "age"]],
      ["Post", "dense_id", ["dense_id", "length"]],
      ["vertices", "dense_id", ["dense_id", "subject", "country", "age", "length"]],
    ]);
    const [person] = graph.types;
    expect(person!.columns.find((c) => c.name === "age")).toEqual({
      name: "age", type: "INTEGER", datatype: XSD_YEAR, nullable: false, stats: COUNTED,
    });
    expect(person!.columns.find((c) => c.name === "subject")).toMatchObject({ role: "identity", termType: "rr:IRI" });
    expect(person).toMatchObject({ candidateKeys: ["dense_id", "subject", "age"], annotations: [LABEL] });
    expect(graph.edges[0]).toMatchObject({ label: "hasCreator", source: "Post", destination: "Person", src: "src", dst: "dst" });
    expect(String(relationQuery(graph, { root: "Person", path: [{ edge: "Post_hasCreator_Person", direction: "in" }] }))).toContain(
      'FROM "jobs/7"."Person" AS "t0" JOIN "jobs/7"."Post_hasCreator_Person" AS "e1"',
    );
  });

  it("carries each table's record count, so a hop can say its fan-out", () => {
    const graph = joinGraphOf(STRUCTURE);
    expect(graph.types.map((t) => t.rows)).toEqual([20, 10, 30]);
    expect(graph.edges[0]!.rows).toBe(10);
  });

  it("holds every vertex as one more type, `vertices`, of every type, NULL where a type has no such column, and counts none of it", () => {
    const vertices = joinGraphOf(STRUCTURE).types.at(-1)!;
    expect(vertices.of).toEqual(["Person", "Post"]);
    expect(vertices.columns.some((c) => c.stats !== undefined)).toBe(false);
    const sql = String(vertices.table);
    expect(sql).toContain('FROM "jobs/7"."Person" UNION ALL SELECT');
    expect(sql).toContain('NULL AS "length" FROM "jobs/7"."Person"');
    expect(sql).toContain('NULL AS "country"');
  });

  it("leaves out of `vertices` a column two types declare with different types", () => {
    const disagreeing: Structure = {
      ...STRUCTURE,
      vertices: [
        STRUCTURE.vertices[0]!,
        { ...STRUCTURE.vertices[1]!, columns: new Map([...STRUCTURE.vertices[1]!.columns, ["age", column(null, { type: "double" })]]) },
      ],
    };
    expect(joinGraphOf(disagreeing).types.at(-1)!.columns.map((c) => c.name)).toEqual(["dense_id", "subject", "country", "length"]);
  });

  it("takes an edge's ends from the columns the catalog names, never from a constant", () => {
    const named = edge("Person_knows_Person", "knows", "Person", "Person", { sourceKey: "from_id", destinationKey: "to_id" });
    const graph = joinGraphOf({ ...STRUCTURE, edges: [named] });
    expect(graph.edges[0]).toMatchObject({ src: "from_id", dst: "to_id" });
  });

  it("reads a multi-valued property as a type of its own, reached by a hop named by the property through its own table", async () => {
    const corpus = await attach();
    const graph = await readJoinGraph(corpus.coordinator, corpus.from);
    expect(graph.types.find((t) => t.name === "Person_nickname")).toMatchObject({ key: "src", value: "nickname" });
    expect(graph.edges.find((e) => e.name === "Person_nickname")).toMatchObject({ label: "nickname", source: "Person", destination: "Person_nickname" });
    const relation = { root: "Person", path: [{ edge: "Person_nickname", direction: "out" as const }] };
    const rows = (await corpus.coordinator.query(Query.select({ n: count() }).from(relationQuery(graph, relation)).where(isNotNull("nickname")))) as Iterable<{ n: unknown }>;
    // A row per person and nickname: ten people, one each.
    expect(Number(Array.from(rows)[0]!.n)).toBe(10);
  });
});
