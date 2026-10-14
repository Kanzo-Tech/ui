import { Query, count, isNotNull, relationQuery } from "@kanzo-tech/mosaic";
import { attach } from "../../test/corpus";
import { describe, expect, it } from "vitest";
import { joinGraphOf, readJoinGraph } from "./join-graph";
import { relation } from "./source";
import type { Column, EdgeTable, Structure, VertexTable } from "./structure";

const column = (type: string, more: Partial<Column> = {}): Column => ({ type, primary: false, nullable: false, ...more });
const ID = column("UINTEGER");
const of = (name: string) => Query.select("*").from(relation("jobs/7", name));
const vertex = (name: string, first: number, rows: number, entries: [string, Column][]): VertexTable => ({
  name, first, rows, identity: "subject", table: of(name), columns: new Map(entries),
});
const edge = (name: string, label: string, source: string, destination: string): EdgeTable => ({
  name, label, source, destination, rows: 10, table: of(name),
});

const STRUCTURE: Structure = {
  from: "jobs/7",
  size: 30,
  vertices: [
    vertex("Person", 0, 20, [
      ["dense_id", ID],
      ["subject", column("VARCHAR", { primary: true })],
      ["country", column("VARCHAR", { nullable: true })],
      ["age", column("INTEGER")],
    ]),
    vertex("Post", 20, 10, [["dense_id", ID], ["subject", column("VARCHAR", { primary: true })], ["length", column("DOUBLE")]]),
  ],
  edges: [edge("Post_hasCreator_Person", "hasCreator", "Post", "Person")],
};

describe("joinGraphOf", () => {
  it("keys a type by the global id, names its keys, and joins an edge on its global ends", () => {
    const graph = joinGraphOf(STRUCTURE);
    expect(graph.types.map((t) => [t.name, t.key, t.columns.map((c) => c.name)])).toEqual([
      ["Person", "dense_id", ["dense_id", "subject", "country", "age"]],
      ["Post", "dense_id", ["dense_id", "subject", "length"]],
      ["vertices", "dense_id", ["dense_id", "subject", "country", "age", "length"]],
    ]);
    const [person] = graph.types;
    expect(person!.columns).toEqual([
      { name: "dense_id", type: "UINTEGER", role: "address", nullable: false },
      { name: "subject", type: "VARCHAR", role: "identity", nullable: false },
      { name: "country", type: "VARCHAR", nullable: true },
      { name: "age", type: "INTEGER", nullable: false },
    ]);
    expect(person).toMatchObject({ candidateKeys: ["dense_id", "subject"], table: STRUCTURE.vertices[0]!.table });
    expect(graph.edges[0]).toMatchObject({ label: "hasCreator", source: "Post", destination: "Person", src: "src", dst: "dst" });
  });

  it("carries each table's record count, so a hop can say its fan-out", () => {
    const graph = joinGraphOf(STRUCTURE);
    expect(graph.types.map((t) => t.rows)).toEqual([20, 10, 30]);
    expect(graph.edges[0]!.rows).toBe(10);
  });

  it("holds every vertex as one more type, `vertices`, of every type, NULL where a type has no such column", () => {
    const vertices = joinGraphOf(STRUCTURE).types.at(-1)!;
    expect(vertices.of).toEqual(["Person", "Post"]);
    const sql = String(vertices.table);
    expect(sql).toContain("UNION ALL SELECT");
    expect(sql).toContain('NULL AS "length" FROM (SELECT * FROM "jobs/7"."Person")');
    expect(sql).toContain('NULL AS "country"');
  });

  it("leaves out of `vertices` a column two types declare with different types", () => {
    const disagreeing: Structure = {
      ...STRUCTURE,
      vertices: [
        STRUCTURE.vertices[0]!,
        { ...STRUCTURE.vertices[1]!, columns: new Map([...STRUCTURE.vertices[1]!.columns, ["age", column("DOUBLE")]]) },
      ],
    };
    expect(joinGraphOf(disagreeing).types.at(-1)!.columns.map((c) => c.name)).toEqual(["dense_id", "subject", "country", "length"]);
  });

  it("reads every type and every relation of an attached graph, in global ids, and leaves a type with no primary key out", async () => {
    const corpus = await attach();
    const graph = await readJoinGraph(corpus.coordinator, corpus.from);
    expect(graph.types.map((t) => t.name)).toEqual(["Person", "Place", "Tag", "vertices"]);
    // Ten people, each living in `10 + i % 6`: the join lands on Place's global ids.
    const relation = { root: "Person", path: [{ edge: "Person_livesIn_Place", direction: "out" as const }] };
    const rows = (await corpus.coordinator.query(
      Query.select({ n: count() }).from(relationQuery(graph, relation)).where(isNotNull("livesIn.name")),
    )) as Iterable<{ n: unknown }>;
    expect(Number(Array.from(rows)[0]!.n)).toBe(10);
  });
});
