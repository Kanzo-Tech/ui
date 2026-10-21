// @vitest-environment node
import { clausePoints, clauseSemiJoin, GraphResolver, literal, onRelation, Query, relationOver, Selection } from "@kanzo-tech/mosaic";
import { plotRelation, tileQuery } from "@kanzo-tech/ui/analytics";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PERSON, SNB, SNB_ENGINE, WROTE } from "../testing/snb.js";
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

/** The first `n` vertices of a type, by their index within it: what a lasso over them selects. */
const first = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("answerRelation", () => {
  it("describes a pattern's fields from the graph, each variable.property, beside a column per vertex for its index", () => {
    const own = ["subject", "firstName", "lastName", "gender", "birthday", "creationDate", "locationIP", "browserUsed", "language", "email"];
    expect(person.fields.map((f) => f.name)).toEqual(own.map((f) => `person.${f}`));
    // The person's own, then their knowing, then the one they know.
    expect(knows.fields.map((f) => f.name)).toEqual([
      ...own.map((f) => `person.${f}`),
      "knowing.subject",
      "knowing.creationDate",
      ...own.map((f) => `known.${f}`),
    ]);
    expect(knows.columns.slice(0, 3)).toEqual(["person", "knowing", "known"]);
  });

  it("reads nothing from the engine: what a field is and holds is the graph's", () => {
    const query = vi.spyOn(SNB_ENGINE, "query");
    answerRelation(KNOWS, SNB);
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });
});

describe("an answer", () => {
  it("reads its tile's rows with the one compiler the dashboard's tile reads", async () => {
    // The page: a lasso on the first ten posts, by their index — a column the pattern has.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("post", first(10), { source: {}, label: "Lasso" }));
    const spec: AskSpec = {
      match: WROTE,
      where: [{ field: "post.length", between: [100, 120] }],
      show: { kind: "chart", type: "bar", x: "person.gender", y: { op: "avg", field: "post.length" } },
    };
    const output = await answer(spec, page);

    // What `ChartCard` reads for the same tile: `tileQuery` over the relation as the plots read it,
    // under the page's clause.
    const relation = relationOver(SNB, WROTE);
    const plotted = plotRelation(relation.table, { fields: wrote.fields, columns: wrote.columns });
    const compiled = tileQuery(plotted.table, askTile(spec, "c"), { fields: plotted.fields, relation, filter: [page.clauses[0]!.predicate!] });
    if ("missing" in compiled) throw new Error("missing");
    expect(output.rows).toEqual(await rowsOf(compiled.rows));
    // Of the ten, five of 100 to 120 characters, all by women.
    expect(output.rows).toEqual([{ "person.gender": "female", "Mean post.length": 107.6 }]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([]);
    // The tile holds the question whole: what is shown, and its own conditions.
    expect(output.answer.tile).toMatchObject({ id: "c", span: 2, where: spec.where });
    expect(output.answer.pattern).toEqual(WROTE);
  });

  it("reads under a page clause its relation cannot answer as the tile does: keeping none of its rows", async () => {
    // A column another relation has: Person has no `kind`, so the clause keeps none of it
    // (/docs/design/crossfilter#formal-semantics) — the tile's read under every clause, `FALSE` for it.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("person", first(5), { source: {}, label: "Lasso" }));
    page.update(clausePoints(["kind"], [["contract"]], { source: {} }));
    const output = await answer({ match: PERSON, show: { kind: "chart", type: "bar", x: "person.gender", y: { op: "count" } } }, page);
    const plotted = plotRelation(relationOver(SNB, PERSON).table, { fields: person.fields, columns: person.columns }).table;
    expect(await rowsOf(Query.from(plotted).select("person.gender").where([page.clauses[0]!.predicate!, literal(false)]))).toEqual([]);
    expect(output.rows).toEqual([]);
    expect(output.under).toEqual(["Lasso"]);
    expect(output.unanswered).toEqual([{ clause: "kind contract", missing: ["kind"] }]);
  });

  it("reads across the pattern's edges: whom the women know, by gender, ranked", async () => {
    const output = await answer({
      match: KNOWS,
      where: [{ field: "person.gender", in: ["female"] }],
      show: { kind: "chart", type: "bar", x: "known.gender", y: { op: "count" } },
      top: 1,
    });
    // Each of the four women who know anyone knows the one everyone knows, a woman.
    expect(output.rows).toEqual([{ "known.gender": "female", Count: 4 }]);
    expect(output.answer.pattern).toEqual(KNOWS);
  });

  it("counts the pattern's first vertex once, whatever rows its edges make: who knows anyone, by gender", async () => {
    // Eleven of the twelve, two of whom know two people — thirteen knowings, eleven people.
    const output = await answer({ match: KNOWS, show: { kind: "chart", type: "bar", x: "person.gender", y: { op: "count" } } });
    expect(output.rows).toEqual([
      { "person.gender": "female", Count: 4 },
      { "person.gender": "male", Count: 7 },
    ]);
  });

  it("counts a named vertex when the count names one: the people the women know", async () => {
    const output = await answer({
      match: KNOWS,
      where: [{ field: "person.gender", in: ["female"] }],
      show: { kind: "stat", measure: { op: "count", variable: "known" } },
    });
    // Six knowings, three people: all four women who know anyone know the same one, and two of them
    // one more each.
    expect(output.rows).toEqual([{ "Count of known": 3 }]);
  });

  it("reads a chip on another pattern crossed in by the vertex both hold, as the page's tiles are crossed", async () => {
    const page = new Selection(new GraphResolver(SNB));
    const relation = relationOver(SNB, PERSON);
    page.update(onRelation(clausePoints(["person.gender"], [["female"]], { source: {} }), relation));
    const output = await answer({ match: WROTE, show: { kind: "stat", measure: { op: "count" } } }, page);
    expect(output.unanswered).toEqual([]);
    expect(output.under).toHaveLength(1);
  });
});
