// @vitest-environment node
import { clauseInterval, clausePoints, clauseSemiJoin, Query, relationQuery, Selection } from "@kanzo-tech/mosaic";
import { measureExpr, plotRelation } from "@kanzo-tech/ui/analytics";
import type { JSONSchema7 } from "ai";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { answerSchema, checkAnswer, type AnswerInput, type AnswerRelation } from "./answer.js";
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

async function answer(input: AnswerInput, selection?: Selection): Promise<AnswerOutput> {
  const agent = dataAgent({ model: mockModel(() => "").model, engine: db.engine, graph: PEOPLE, relations: [person, knows], selection });
  return (await agent.tools.answer.execute!(input, { toolCallId: "c", messages: [] } as never)) as AnswerOutput;
}

describe("readAnswerRelations", () => {
  it("reads each relation's fields as a dashboard over it does, without its keys, and each category's most common values", () => {
    expect(person.fields.map((f) => f.name)).toEqual(["Person.gender", "Person.age", "Person.born"]);
    expect([...(person.fields[0]!.values ?? [])].sort()).toEqual(["female", "male"]);
    expect(knows.fields.map((f) => f.name)).toEqual(["Person.gender", "Person.age", "Person.born", "Person2.gender", "Person2.age", "Person2.born"]);
    expect(knows.columns).toContain("Person2.dense_id");
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
    types: [...PEOPLE.types, { name: "Post", table: "post", key: "dense_id", columns: ["title"] }],
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
  it("the enums are the relation's fields only", () => {
    const schema = answerSchema(PEOPLE, [person]) as { properties: Record<string, JSONSchema7> };
    const names = ["Person.gender", "Person.age", "Person.born"];
    const relation = schema.properties.relation as { properties: { root: JSONSchema7; path: { items: { properties: Record<string, JSONSchema7> } } } };
    expect(relation.properties.root.enum).toEqual(["Person"]);
    expect(relation.properties.path.items.properties.edge!.enum).toEqual([]);
    const where = (schema.properties.where as { items: { anyOf: { properties: { field: JSONSchema7 } }[] } }).items.anyOf;
    expect(where.map((condition) => condition.properties.field.enum)).toEqual([names, names, names]);
    const chart = (schema.properties.show as { anyOf: { properties: Record<string, JSONSchema7 & { properties?: Record<string, JSONSchema7> }> }[] }).anyOf[1]!;
    for (const slot of ["x", "color", "facet"]) expect(chart.properties[slot]!.enum).toEqual(names);
    expect(chart.properties.y!.properties!.field!.enum).toEqual(names);
    expect(chart.properties.type!.enum).toEqual(["bar", "line", "area", "histogram", "dot", "regression"]);
    // No key, no other relation's field, no table: nothing a model could write that is not a field here.
    expect(JSON.stringify(schema)).not.toMatch(/dense_id|Person2|"person"|knows|secret/);
    expect(JSON.stringify(answerSchema(PEOPLE, [person, knows]))).toContain('"enum":["knows"]');
  });

  it("an answer compiles to the same query the dashboard tile reads", async () => {
    // The page: a lasso on identity, which the relation answers, and a column another relation has.
    const page = Selection.crossfilter();
    page.update(clauseSemiJoin("dense_id", [1, 2, 4, 5, 6], { source: {}, label: "Lasso" }));
    page.update(clausePoints(["kind"], [["contract"]], { source: {} }));
    const output = await answer(
      {
        relation: PERSON,
        where: [{ field: "Person.age", between: [30, 60] }],
        show: { kind: "chart", type: "bar", x: "Person.gender", y: { op: "avg", field: "Person.age" } },
      },
      page,
    );

    // What `ChartCard` reads for the same tile: the measure by x, over the relation as the plots read
    // it, under the condition's clause and the page's.
    const tile = plotRelation(relationQuery(PEOPLE, PERSON), { fields: person.fields, columns: person.columns }).table;
    const filter = [clauseInterval("Person.age", [30, 60], { source: {} }).predicate!, page.clauses[0]!.predicate!];
    const read = await rowsOf(
      Query.from(tile).select({ "Person.gender": "Person.gender", "avg Person.age": measureExpr({ op: "avg", field: "Person.age" }) }).where(filter).groupby("Person.gender").orderby("Person.gender"),
    );
    expect(output.rows).toEqual(read);
    expect(output.rows).toEqual([
      { "Person.gender": "female", "avg Person.age": 37.5 },
      { "Person.gender": "male", "avg Person.age": 45 },
    ]);
    expect(output.under).toEqual(["Lasso · 5 selected"]);
    expect(output.skipped).toEqual([{ clause: "kind contract", missing: ["kind"] }]);
    expect(output.answer.show).toMatchObject({ id: "c", span: 2 });
  });

  it("crosses a hop: whom the women know, by gender, ranked", async () => {
    const output = await answer({
      relation: KNOWS,
      where: [{ field: "Person.gender", in: ["female"] }],
      show: { kind: "chart", type: "bar", x: "Person2.gender", y: { op: "count" } },
      top: 1,
    });
    expect(output.rows).toEqual([{ "Person2.gender": "male", count: 3 }]);
  });

  it("input outside the schema is refused before it runs", async () => {
    const refusal = (value: unknown) => {
      const checked = checkAnswer(value, [person, knows], PEOPLE);
      return checked.success ? null : checked.error.message;
    };
    const show = { kind: "chart", type: "bar", x: "Person.gender", y: { op: "count" } };
    expect(refusal({ relation: PERSON, show })).toBeNull();
    expect(refusal({ relation: PERSON, show: { ...show, x: "Person2.gender" } })).toBe(
      "show.x: Person2.gender is not a field of Person, whose fields are Person.gender, Person.age, Person.born.",
    );
    expect(refusal({ relation: { root: "Person", path: [{ edge: "knows", direction: "in" }] }, show })).toBe(
      "relation: not one of the relations offered, which are Person, Person>knows>Person.",
    );
    expect(refusal({ relation: PERSON, show: { ...show, y: { op: "sum" } } })).toBe("show.y: every measure but count names a field");
    expect(refusal({ relation: PERSON, show, where: [{ field: "Person.age", over: 3 }] })).toMatch(/^where\.0: a condition is/);
    expect(refusal({ relation: PERSON, show, sql: "DROP TABLE secret" })).toBe("An answer has no sql: it is { relation, where?, show, top? }.");

    // Through the agent: the model reads the refusal, and the engine is never asked.
    const sent: string[] = [];
    const query = db.coordinator.query.bind(db.coordinator);
    db.coordinator.query = ((sql: unknown, options?: Parameters<typeof query>[1]) => (sent.push(String(sql)), query(sql as never, options))) as never;
    try {
      const { model } = mockModel((_, index) =>
        index === 0 ? { tool: "answer", input: { relation: PERSON, show: { ...show, x: "secret" } } } : "That field does not exist.",
      );
      const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations: [person] });
      await (await agent.stream({ prompt: "By secret?" })).text;
      const results = (model.doStreamCalls[1]!.prompt as { role: string; content: unknown }[])
        .filter((m) => m.role === "tool")
        .flatMap((m) => m.content as { type: string; output?: { value?: unknown } }[])
        .map((part) => String(part.output?.value));
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("show.x: secret is not a field of Person");
      expect(sent).toEqual([]);
    } finally {
      db.coordinator.query = query;
    }
  });
});
