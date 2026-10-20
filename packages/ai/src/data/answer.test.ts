// @vitest-environment node
import { clausePoints, clauseSemiJoin, literal, Query, Selection } from "@kanzo-tech/mosaic";
import { JoinResolver, relationQuery } from "@kanzo-tech/relations";
import { plotRelation, tileQuery } from "@kanzo-tech/ui/analytics";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { idsOf, KNOWS, PERSON, SNB, WROTE } from "../testing/snb.js";
import type { AnswerOutput } from "./read.js";
import { readFor } from "../testing/answer.js";
import type { AnswerRelation } from "./answer.js";
import { answerRelation, askTile, type AskSpec } from "./ask.js";

let db: TestDatabase;
let person: AnswerRelation;
let knows: AnswerRelation;
let wrote: AnswerRelation;

beforeAll(async () => {
  db = await testDatabase();
  [person, knows, wrote] = [answerRelation(PERSON, SNB), answerRelation(KNOWS, SNB), answerRelation(WROTE, SNB)];
});

const rowsOf = async (query: Query | string) =>
  Array.from((await db.coordinator.query(query, { cache: false })) as Iterable<Record<string, unknown>>, (row) => ({ ...row }));

async function answer(spec: AskSpec, selection?: Selection): Promise<AnswerOutput> {
  return readFor(db.engine, SNB, spec, selection);
}

describe("answerRelation", () => {
  it("describes a relation's fields from the graph, without its steps' keys, each with the commonest values its writer counted", () => {
    const own = ["subject", "firstName", "lastName", "gender", "birthday", "creationDate", "locationIP", "browserUsed", "language", "email"];
    expect(person.fields.map((f) => f.name)).toEqual(own);
    // Seven men and five women, the commonest first.
    expect(person.fields.find((f) => f.name === "gender")!.values).toEqual(["male", "female"]);
    // A column is named by its path: the person's own, then their knowing, then the one they know.
    expect(knows.fields.map((f) => f.name)).toEqual([...own, "^knower.subject", "^knower.creationDate", ...own.map((f) => `^knower.known.${f}`)]);
    expect(knows.columns).toContain("^knower.known.dense_id");
  });

  it("reads nothing from the engine: what a field is and holds is the graph's", () => {
    const query = vi.spyOn(db.coordinator, "query");
    answerRelation(KNOWS, SNB);
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });
});

describe("an answer", () => {
  it("reads its tile's rows with the one compiler the dashboard's tile reads", async () => {
    // The page: a lasso on identity — the first ten posts — which the relation answers.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("dense_id", idsOf("Post", 10), { source: {}, label: "Lasso" }));
    const spec: AskSpec = {
      of: "Post",
      where: [{ field: "length", between: [100, 120] }],
      show: { kind: "chart", type: "bar", x: "hasCreator.gender", y: { op: "avg", field: "length" } },
    };
    const output = await answer(spec, page);

    // What `ChartCard` reads for the same tile: `tileQuery` over the relation as the plots read it,
    // under the page's clause.
    const plotted = plotRelation(relationQuery(SNB, WROTE), { fields: wrote.fields, columns: wrote.columns });
    const compiled = tileQuery(plotted.table, askTile(spec, "c"), { fields: plotted.fields, relation: WROTE, resolver: new JoinResolver(SNB), filter: [page.clauses[0]!.predicate!] });
    if ("missing" in compiled) throw new Error("missing");
    expect(output.rows).toEqual(await rowsOf(compiled.rows));
    // Of the ten, five of 100 to 120 characters, all by women.
    expect(output.rows).toEqual([{ "hasCreator.gender": "female", "Mean length": 107.6 }]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([]);
    // The tile holds the question whole: what is shown, and its own conditions.
    expect(output.answer.tile).toMatchObject({ id: "c", span: 2, where: spec.where });
    expect(output.answer.relation).toEqual(WROTE);
  });

  it("reads under a page clause its relation cannot answer as the tile does: keeping none of its rows", async () => {
    // A column another relation has: Person has no `kind`, so the clause keeps none of it
    // (/docs/design/crossfilter#formal-semantics) — the tile's read under every clause, `FALSE` for it.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("dense_id", idsOf("Person", 5), { source: {}, label: "Lasso" }));
    page.update(clausePoints(["kind"], [["contract"]], { source: {} }));
    const output = await answer({ of: "Person", show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } } }, page);
    const plotted = plotRelation(relationQuery(SNB, PERSON), { fields: person.fields, columns: person.columns }).table;
    expect(await rowsOf(Query.from(plotted).select("gender").where([page.clauses[0]!.predicate!, literal(false)]))).toEqual([]);
    expect(output.rows).toEqual([]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([{ clause: "kind contract", missing: ["kind"] }]);
  });

  it("crosses a hop by its path: whom the women know, by gender, ranked", async () => {
    const output = await answer({
      of: "Person",
      where: [{ field: "gender", in: ["female"] }],
      show: { kind: "chart", type: "bar", x: "^knower.known.gender", y: { op: "count" } },
      top: 1,
    });
    // Four of the six knowings the women made name a woman: the one everyone knows, four times.
    expect(output.rows).toEqual([{ "^knower.known.gender": "female", Count: 4 }]);
    expect(output.answer.relation).toEqual(KNOWS);
  });

  it("crosses a condition off the shown path in at the root's key, counting each person once", async () => {
    // Who knows anyone, by their own gender: eleven of the twelve, two of whom know two people and
    // are one woman each — thirteen knowings, eleven people.
    const output = await answer({
      of: "Person",
      where: [{ field: "^knower.known.gender", in: ["female", "male"] }],
      show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } },
    });
    expect(output.answer.relation).toEqual(PERSON);
    expect(output.rows).toEqual([
      { gender: "female", Count: 4 },
      { gender: "male", Count: 7 },
    ]);
  });

  it("counts a path's step when the count names one: the people the women know", async () => {
    const output = await answer({
      of: "Person",
      where: [{ field: "gender", in: ["female"] }],
      show: { kind: "stat", measure: { op: "count", path: "^knower.known" } },
    });
    // Six knowings, three people: all four women who know anyone know the same one, and two of them
    // one more each.
    expect(output.answer.relation).toEqual(KNOWS);
    expect(output.rows).toEqual([{ "Count of ^knower.known": 3 }]);
  });
});
