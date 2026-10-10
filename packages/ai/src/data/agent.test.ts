// @vitest-environment node
import { AiError } from "@kanzo-tech/llm";
import { clausePoints, Selection, type Engine } from "@kanzo-tech/mosaic";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel, promptOf } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { dataAgent, dataInstructions, dataSuggestions, type AnswerOutput } from "./agent.js";
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

/** A page selection holding a clause the relation answers and one on a column it does not have. */
function pickedAndElsewhere() {
  const selection = picked();
  selection.update(clausePoints(["City.name"], [["Madrid"]], { source: {} }));
  return selection;
}

/** The text the model read back for each tool call in its prompt. */
const toolResults = (prompt: { role: string; content: unknown }[]) =>
  prompt
    .filter((message) => message.role === "tool")
    .flatMap((message) => message.content as { type: string; output?: { type: string; value?: unknown } }[])
    .filter((part) => part.type === "tool-result")
    .map((part) => String(part.output?.value));

const COUNT = { relation: "Person", show: { kind: "stat", measure: { op: "count" } } };

describe("dataAgent", () => {
  it("tells the model each type's fields once, with their kind and what they hold, each relation by its key, never DDL, and that the tile is already shown", () => {
    const text = dataInstructions({ graph: PEOPLE, relations });
    expect(text).toMatch(/#### Person\n- gender: category \((female, male|male, female)\)\n- age: number \(27 – 61\)\n- born: time \(1965-09-15 – 1999-01-20\)/);
    // Once, though two relations reach Person: the type alone's values, not the hop's.
    expect(text.match(/- age:/g)).toHaveLength(1);
    expect(text).toContain("- Person\n- Person>knows>Person");
    expect(text).toContain("`Person2.gender` is the second Person's");
    expect(text).not.toMatch(/"root"|CREATE TABLE|SELECT|dense_id/);
    expect(text).toContain("You never write SQL");
    expect(text).toContain("The tile is in front of the reader");
    expect(text).toContain("say so in one sentence");
  });

  it("throws when the chat was stopped, rather than answering nobody", async () => {
    const stopped = new AbortController();
    stopped.abort(new Error("stopped"));
    const agent = dataAgent({ model: mockModel(() => "").model, engine: db.engine, graph: PEOPLE, relations });
    await expect(agent.tools.answer.execute!(COUNT as never, { toolCallId: "c", messages: [], abortSignal: stopped.signal } as never)).rejects.toThrow(
      "stopped",
    );
  });

  it("answers in a hidden tab, where no animation frame ever fires", async () => {
    // A hidden tab: `requestAnimationFrame` is there and never calls back. The coordinator's queue
    // batches behind it, so a read through the queue would never land.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    try {
      const agent = dataAgent({ model: mockModel(() => "").model, engine: db.engine, graph: PEOPLE, relations });
      const output = await agent.tools.answer.execute!(COUNT as never, { toolCallId: "c", messages: [], abortSignal: new AbortController().signal } as never);
      expect((output as AnswerOutput).rows).toEqual([{ count: 6 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hands the engine the chat's signal, and ends the wait the moment the chat is stopped", async () => {
    // An engine whose statement never lands: only the abort ends the wait.
    const query = vi.fn<Engine["query"]>((_, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
    const agent = dataAgent({ model: mockModel(() => "").model, engine: { query }, graph: PEOPLE, relations });
    const stop = new AbortController();
    const running = agent.tools.answer.execute!(COUNT as never, { toolCallId: "c", messages: [], abortSignal: stop.signal } as never);
    const reason = new Error("stopped");
    stop.abort(reason);
    await expect(running).rejects.toBe(reason);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]![1].signal).toBe(stop.signal);
  });
});

describe("a conversation with dataAgent", () => {
  it("hands the model a sample of the rows and the page's filter that applied, after one tool call", async () => {
    const { model } = mockModel((_, index) => (index === 0 ? { tool: "answer", input: COUNT } : "Three women."));
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations, selection: picked() });
    const result = await agent.stream({ prompt: "How many?" });
    expect(await result.text).toBe("Three women.");
    expect(toolResults(model.doStreamCalls[1]!.prompt as never)).toEqual([
      ["1 rows, drawn for the reader as a stat.", "Read under the page's filter: Person.gender female.", `First rows: [{"count":3}]`].join("\n"),
    ]);
  });

  it("tells the model which of the page's clauses the relation could not answer, and what each lacks", async () => {
    const { model } = mockModel((_, index) => (index === 0 ? { tool: "answer", input: COUNT } : "Three women."));
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations, selection: pickedAndElsewhere() });
    await (await agent.stream({ prompt: "How many?" })).text;
    const [read] = toolResults(model.doStreamCalls[1]!.prompt as never);
    expect(read).toContain("Read under the page's filter: Person.gender female.");
    expect(read).toContain("Not applied, as this relation lacks the fields they filter: City.name Madrid (City.name).");
  });

  it("does not call a page whose every clause was skipped unfiltered", async () => {
    const elsewhere = Selection.crossfilter();
    elsewhere.update(clausePoints(["City.name"], [["Madrid"]], { source: {} }));
    const { model } = mockModel((_, index) => (index === 0 ? { tool: "answer", input: COUNT } : "Six."));
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations, selection: elsewhere });
    await (await agent.stream({ prompt: "How many?" })).text;
    const [read] = toolResults(model.doStreamCalls[1]!.prompt as never);
    expect(read).not.toContain("The page has no filter");
    expect(read).toContain("None of the page's filter applies to this relation: this is the whole relation.");
    expect(read).toContain("City.name Madrid (City.name)");
  });

  it("stops after five steps, however often the model calls the tool", async () => {
    const { model } = mockModel(() => ({ tool: "answer", input: COUNT }));
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations });
    await (await agent.stream({ prompt: "Count forever" })).text;
    expect(model.doStreamCalls).toHaveLength(5);
  });
});

describe("a declared context", () => {
  it("sends a question that fits as it is: every relation, in the tool and the instructions", async () => {
    const { model } = mockModel(() => "Six.");
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations, context: { tokens: 16384 } });
    await (await agent.stream({ prompt: "How many people?" })).text;
    const call = model.doStreamCalls[0]!;
    const tool = call.tools![0] as unknown as { inputSchema: { properties: { relation: { enum: string[] } } } };
    expect(tool.inputSchema.properties.relation.enum).toEqual(["Person", "Person>knows>Person"]);
    expect(promptOf(call)).not.toContain("not described here");
  });

  it("fails as ai/context, sending nothing, when the conversation cannot fit", async () => {
    const { model } = mockModel(() => "Six.");
    const agent = dataAgent({ model, engine: db.engine, graph: PEOPLE, relations, context: { tokens: 400, reserve: 100 } });
    const failed = await agent.stream({ prompt: "How many people?" }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(failed).toBeInstanceOf(AiError);
    expect(failed).toMatchObject({ code: "ai/context", data: { budget: expect.any(Number) } });
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("fails the starters as ai/context, unsent, when the relations cannot fit", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [] }));
    const read = async () => {
      for await (const _ of dataSuggestions({ model, graph: PEOPLE, relations, context: { tokens: 200, reserve: 0 } })) void _;
    };
    await expect(read()).rejects.toMatchObject({ code: "ai/context" });
    expect(model.doStreamCalls).toHaveLength(0);
  });
});

describe("dataSuggestions", () => {
  it("asks for questions over the relations and the page's filter, as many as were wanted", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "Whom do women know?", rationale: "Person>knows>Person" }] }));
    const got = [];
    for await (const q of dataSuggestions({ model, graph: PEOPLE, relations, selection: picked(), count: 3 })) got.push(q);
    expect(got).toEqual([{ text: "Whom do women know?", rationale: "Person>knows>Person" }]);
    const prompt = promptOf(model.doStreamCalls[0]!);
    expect(prompt).toContain("#### Person\n");
    expect(prompt).toContain("- age: number (27 – 61)");
    expect(prompt).toContain("- Person>knows>Person");
    expect(prompt).toContain("The page is filtered to: Person.gender female.");
    expect(prompt).toContain("Give 3.");
  });

  it("offers no more than were wanted when the model writes more", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ text: `Question ${i}?`, rationale: "Person>knows>Person" }));
    const { model } = mockModel(() => JSON.stringify({ elements: six }));
    const got = [];
    for await (const q of dataSuggestions({ model, graph: PEOPLE, relations })) got.push(q);
    expect(got.map((q) => q.text)).toEqual(["Question 0?", "Question 1?", "Question 2?", "Question 3?"]);
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
