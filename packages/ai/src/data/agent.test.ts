// @vitest-environment node
import { clausePoints, Selection } from "@kanzo-tech/mosaic";
import { beforeAll, describe, expect, it } from "vitest";
import { mockModel, promptOf } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { dataAgent, dataInstructions, dataSuggestions } from "./agent.js";
import type { AnswerRelation } from "./answer.js";
import { readAnswerRelations } from "./relations.js";

let db: TestDatabase;
let relations: AnswerRelation[];

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  relations = await readAnswerRelations(db.coordinator, PEOPLE, [PERSON, KNOWS]);
});

/** A page selection holding one clause: the reader picked women. */
function picked() {
  const selection = Selection.crossfilter();
  selection.update(clausePoints(["Person.gender"], [["female"]], { source: {} }));
  return selection;
}

/** The text the model read back for each tool call in its prompt. */
const toolResults = (prompt: { role: string; content: unknown }[]) =>
  prompt
    .filter((message) => message.role === "tool")
    .flatMap((message) => message.content as { type: string; output?: { type: string; value?: unknown } }[])
    .filter((part) => part.type === "tool-result")
    .map((part) => String(part.output?.value));

const COUNT = { relation: PERSON, show: { kind: "stat", measure: { op: "count" } } };

describe("dataAgent", () => {
  it("tells the model each field with its kind and what it holds, never DDL, and that the tile is already shown", () => {
    const text = dataInstructions({ graph: PEOPLE, relations });
    expect(text).toMatch(/- Person\.gender: category \((female, male|male, female)\)/);
    expect(text).toContain("- Person.age: number (27 – 61)");
    expect(text).toContain("- Person.born: time (1965-09-15 – 1999-01-20)");
    expect(text).toContain(`### Person>knows>Person\nrelation: {"root":"Person","path":[{"edge":"knows","direction":"out"}]}`);
    expect(text).not.toMatch(/CREATE TABLE|SELECT|dense_id/);
    expect(text).toContain("You never write SQL");
    expect(text).toContain("The tile is in front of the reader");
    expect(text).toContain("say so in one sentence");
  });

  it("throws when the chat was stopped, rather than answering nobody", async () => {
    const stopped = new AbortController();
    stopped.abort(new Error("stopped"));
    const agent = dataAgent({ model: mockModel(() => "").model, coordinator: db.coordinator, graph: PEOPLE, relations });
    await expect(agent.tools.answer.execute!(COUNT as never, { toolCallId: "c", messages: [], abortSignal: stopped.signal } as never)).rejects.toThrow(
      "stopped",
    );
  });
});

describe("a conversation with dataAgent", () => {
  it("hands the model a sample of the rows and the page's filter that applied, after one tool call", async () => {
    const { model } = mockModel((_, index) => (index === 0 ? { tool: "answer", input: COUNT } : "Three women."));
    const agent = dataAgent({ model, coordinator: db.coordinator, graph: PEOPLE, relations, selection: picked() });
    const result = await agent.stream({ prompt: "How many?" });
    expect(await result.text).toBe("Three women.");
    expect(toolResults(model.doStreamCalls[1]!.prompt as never)).toEqual([
      ["1 rows, drawn for the reader as a stat.", "Read under the page's filter: Person.gender female.", `First rows: [{"count":3}]`].join("\n"),
    ]);
  });

  it("stops after five steps, however often the model calls the tool", async () => {
    const { model } = mockModel(() => ({ tool: "answer", input: COUNT }));
    const agent = dataAgent({ model, coordinator: db.coordinator, graph: PEOPLE, relations });
    await (await agent.stream({ prompt: "Count forever" })).text;
    expect(model.doStreamCalls).toHaveLength(5);
  });
});

describe("dataSuggestions", () => {
  it("asks for questions over the relations and the page's filter, as many as were wanted", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "Whom do women know?", rationale: "Person>knows>Person" }] }));
    const got = [];
    for await (const q of dataSuggestions({ model, graph: PEOPLE, relations, selection: picked(), count: 3 })) got.push(q);
    expect(got).toEqual([{ text: "Whom do women know?", rationale: "Person>knows>Person" }]);
    const prompt = promptOf(model.doStreamCalls[0]!);
    expect(prompt).toContain("- Person2.age: number (38 – 61)");
    expect(prompt).toContain("The page is filtered to: Person.gender female.");
    expect(prompt).toContain("Give 3.");
  });

  it("favours a question across a hop, and a rationale naming the relation it is over", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [] }));
    for await (const _ of dataSuggestions({ model, graph: PEOPLE, relations })) void _;
    const system = (model.doStreamCalls[0]!.prompt as { role: string; content: unknown }[]).find((m) => m.role === "system");
    expect(String(system?.content)).toContain("Favour questions over a relation that crosses a hop");
    expect(String(system?.content)).toContain("only when no relation crosses a hop");
    expect(String(system?.content)).toContain("The rationale names the relation the question is over.");
  });
});
