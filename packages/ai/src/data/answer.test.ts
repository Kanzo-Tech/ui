// @vitest-environment node
import { clausePoints, clauseSemiJoin, JoinResolver, literal, Query, relationQuery, Selection } from "@kanzo-tech/mosaic";
import { plotRelation, tileQuery } from "@kanzo-tech/ui/analytics";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { AnswerOutput } from "./read.js";
import { readFor } from "../testing/answer.js";
import type { AnswerRelation } from "./answer.js";
import { askTile, type AskSpec } from "./ask.js";
import { answerRelationsOf, readAnswerRelations } from "./relations.js";

let db: TestDatabase;
let person: AnswerRelation;
let knows: AnswerRelation;

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  [person, knows] = (await readAnswerRelations(db.coordinator, PEOPLE, [PERSON, KNOWS])) as [AnswerRelation, AnswerRelation];
});

const rowsOf = async (query: Query | string) =>
  Array.from((await db.coordinator.query(query, { cache: false })) as Iterable<Record<string, unknown>>, (row) => ({ ...row }));

async function answer(spec: AskSpec, selection?: Selection): Promise<AnswerOutput> {
  return readFor(db.engine, PEOPLE, [person], spec, selection);
}

describe("readAnswerRelations", () => {
  it("reads each relation's fields as a dashboard over it does, without its keys, and each category's most common values", () => {
    expect(person.fields.map((f) => f.name)).toEqual(["gender", "age", "born"]);
    expect([...(person.fields[0]!.values ?? [])].sort()).toEqual(["female", "male"]);
    // A column is named by its path: the person's own, then the one they know.
    expect(knows.fields.map((f) => f.name)).toEqual(["gender", "age", "born", "knows.gender", "knows.age", "knows.born"]);
    expect(knows.columns).toContain("knows.dense_id");
  });

  it("hands each query the signal, and ends on an abort with its reason, cancelling what is still queued", async () => {
    const query = vi.spyOn(db.coordinator, "query");
    const cancel = vi.spyOn(db.coordinator, "cancel");
    const controller = new AbortController();
    const reason = new Error("left the page");
    const read = readAnswerRelations(db.coordinator, PEOPLE, [PERSON, KNOWS], { signal: controller.signal });
    controller.abort(reason);
    await expect(read).rejects.toBe(reason);
    expect(query.mock.calls.length).toBeGreaterThan(0);
    for (const [, options] of query.mock.calls) expect(options).toEqual({ signal: controller.signal });
    expect(cancel).toHaveBeenCalledWith(query.mock.results.map((r) => r.value));
    query.mockRestore();
    cancel.mockRestore();

    await expect(readAnswerRelations(db.coordinator, PEOPLE, [PERSON], { signal: AbortSignal.abort(reason) })).rejects.toBe(reason);
  });
});

describe("answerRelationsOf", () => {
  const graph = {
    types: [...PEOPLE.types, { name: "Post", table: "post", key: "dense_id", columns: [{ name: "title", type: "VARCHAR" }] }],
    edges: [...PEOPLE.edges, { name: "wrote", label: "wrote", source: "Person", destination: "Post", table: "wrote", src: "src", dst: "dst" }],
  };
  const out = (edge: string) => ({ edge, direction: "out" as const });
  const into = (edge: string) => ({ edge, direction: "in" as const });

  it("offers each type alone and through each of its hops, in the graph's order", () => {
    expect(answerRelationsOf(graph)).toEqual([
      { root: "Person", path: [] },
      { root: "Person", path: [out("knows")] },
      { root: "Person", path: [out("wrote")] },
      { root: "Person", path: [into("knows")] },
      { root: "Post", path: [] },
      { root: "Post", path: [into("wrote")] },
    ]);
  });

  it("offers the types alone at hops 0, and only the types named in from", () => {
    expect(answerRelationsOf(graph, { hops: 0 })).toEqual([{ root: "Person", path: [] }, { root: "Post", path: [] }]);
    expect(answerRelationsOf(graph, { from: ["Post"] })).toEqual([{ root: "Post", path: [] }, { root: "Post", path: [into("wrote")] }]);
  });
});

describe("an answer", () => {
  it("reads its tile's rows with the one compiler the dashboard's tile reads", async () => {
    // The page: a lasso on identity, which the relation answers.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("dense_id", [1, 2, 4, 5, 6], { source: {}, label: "Lasso" }));
    const spec: AskSpec = {
      of: "Person",
      where: [{ field: "age", between: [30, 60] }],
      show: { kind: "chart", type: "bar", x: "gender", y: { op: "avg", field: "age" } },
    };
    const output = await answer(spec, page);

    // What `ChartCard` reads for the same tile: `tileQuery` over the relation as the plots read it,
    // under the page's clause.
    const plotted = plotRelation(relationQuery(PEOPLE, PERSON), { fields: person.fields, columns: person.columns });
    const compiled = tileQuery(plotted.table, askTile(spec, "c"), { fields: plotted.fields, relation: PERSON, resolver: new JoinResolver(PEOPLE), filter: [page.clauses[0]!.predicate!] });
    if ("missing" in compiled) throw new Error("missing");
    expect(output.rows).toEqual(await rowsOf(compiled.rows));
    expect(output.rows).toEqual([
      { gender: "female", "Mean age": 37.5 },
      { gender: "male", "Mean age": 45 },
    ]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([]);
    // The tile holds the question whole: what is shown, and its own conditions.
    expect(output.answer.tile).toMatchObject({ id: "c", span: 2, where: spec.where });
    expect(output.answer.relation).toEqual(PERSON);
  });

  it("reads under a page clause its relation cannot answer as the tile does: keeping none of its rows", async () => {
    // A column another relation has: Person has no `kind`, so the clause keeps none of it
    // (/docs/design/crossfilter#formal-semantics) — the tile's read under every clause, `FALSE` for it.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("dense_id", [1, 2, 4, 5, 6], { source: {}, label: "Lasso" }));
    page.update(clausePoints(["kind"], [["contract"]], { source: {} }));
    const output = await answer({ of: "Person", show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } } }, page);
    const plotted = plotRelation(relationQuery(PEOPLE, PERSON), { fields: person.fields, columns: person.columns }).table;
    expect(await rowsOf(Query.from(plotted).select("gender").where([page.clauses[0]!.predicate!, literal(false)]))).toEqual([]);
    expect(output.rows).toEqual([]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([{ clause: "kind contract", missing: ["kind"] }]);
  });

  it("crosses a hop by its path: whom the women know, by gender, ranked", async () => {
    const output = await answer({
      of: "Person",
      where: [{ field: "gender", in: ["female"] }],
      show: { kind: "chart", type: "bar", x: "knows.gender", y: { op: "count" } },
      top: 1,
    });
    expect(output.rows).toEqual([{ "knows.gender": "male", Count: 3 }]);
    expect(output.answer.relation).toEqual(KNOWS);
  });

  it("crosses a condition off the shown path in at the root's key, counting each person once", async () => {
    // Who knows a man, by their own gender: person 1 knows two people, and is one woman.
    const output = await answer({
      of: "Person",
      where: [{ field: "knows.gender", in: ["male"] }],
      show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } },
    });
    expect(output.answer.relation).toEqual(PERSON);
    expect(output.rows).toEqual([
      { gender: "female", Count: 3 },
      { gender: "male", Count: 1 },
    ]);
  });

  it("counts a path's step when the count names one: the people the women know", async () => {
    const output = await answer({
      of: "Person",
      where: [{ field: "gender", in: ["female"] }],
      show: { kind: "stat", measure: { op: "count", path: "knows" } },
    });
    // 1 knows 4 and 2, 2 knows 5, 3 knows 6: four people.
    expect(output.answer.relation).toEqual(KNOWS);
    expect(output.rows).toEqual([{ "Count of knows": 4 }]);
  });
});
