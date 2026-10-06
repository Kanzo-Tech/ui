// @vitest-environment node
import { asTableRef, clausePoints, Selection } from "@kanzo-tech/mosaic";
import { beforeAll, describe, expect, it } from "vitest";
import { mockModel, promptOf } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { dataAgent, dataInstructions, dataSuggestions, type QueryAnswer } from "./agent.js";
import { describeSchema, type DataSchema } from "./schema.js";

let db: TestDatabase;
let schema: DataSchema;

beforeAll(async () => {
  db = await testDatabase();
  db.run(`ATTACH ':memory:' AS "archive"`);
  db.run(`CREATE TABLE "archive"."node" ("id" BIGINT, "kind" VARCHAR, "at" TIMESTAMP)`);
  db.run(`INSERT INTO "archive"."node" VALUES (1, 'contract', '2026-01-02'), (2, 'contract', '2026-01-03'), (3, 'tag', '2026-01-04')`);
  db.run(`CREATE TABLE secret ("x" INTEGER)`);
  schema = await describeSchema(db.coordinator, { catalog: "archive" });
});

const NODE = asTableRef(["archive", "node"])!;

/** A page selection holding one clause: the reader picked contracts. */
function picked() {
  const selection = Selection.crossfilter();
  selection.update(clausePoints(["kind"], [["contract"]], { source: {} }));
  return selection;
}

async function call(agent: ReturnType<typeof dataAgent>, sql: string, abortSignal?: AbortSignal): Promise<QueryAnswer> {
  const query = agent.tools.query;
  return (await query.execute!({ sql }, { toolCallId: "c", messages: [], abortSignal } as never)) as QueryAnswer;
}

describe("dataAgent", () => {
  const { model } = mockModel(() => "");

  it("runs the model's SQL under the scope, and hands the reader every row, plain enough for a message", async () => {
    const agent = dataAgent({ model, coordinator: db.coordinator, schema, scope: { selection: picked(), table: NODE } });
    expect(await call(agent, `SELECT "id", "at" FROM scope ORDER BY "id"`)).toEqual({
      sql: `SELECT "id", "at" FROM scope ORDER BY "id"`,
      rows: [
        { id: 1, at: "2026-01-02T00:00:00.000Z" },
        { id: 2, at: "2026-01-03T00:00:00.000Z" },
      ],
      truncated: false,
    });
  });

  it("is truncated only when the cap cut the answer short", async () => {
    const agent = dataAgent({ model, coordinator: db.coordinator, schema, rows: 2 });
    expect(await call(agent, `SELECT "id" FROM "archive"."node" ORDER BY "id"`)).toMatchObject({ rows: [{ id: 1 }, { id: 2 }], truncated: true });
    expect(await call(agent, `SELECT "id" FROM "archive"."node" WHERE "id" < 3 ORDER BY "id"`)).toMatchObject({
      rows: [{ id: 1 }, { id: 2 }],
      truncated: false,
    });
  });

  it("answers a statement the gate refuses with the gate's words, and runs nothing", async () => {
    const answer = await call(dataAgent({ model, coordinator: db.coordinator, schema }), "SELECT 1) t; DROP TABLE secret; SELECT * FROM (SELECT 1");
    expect(answer).toMatchObject({ error: { code: "query/refused" } });
    expect(db.run("SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name = 'secret'")).toEqual([{ n: 1 }]);
  });

  it("answers a statement the engine refuses with the engine's words rather than throwing", async () => {
    const answer = await call(dataAgent({ model, coordinator: db.coordinator, schema }), `SELECT "nope" FROM "archive"."node"`);
    expect(answer).toMatchObject({ sql: `SELECT "nope" FROM "archive"."node"`, error: { message: expect.stringContaining("nope") } });
  });

  it("throws when the chat was stopped, rather than answering a refusal nobody asked for", async () => {
    const stopped = new AbortController();
    stopped.abort(new Error("stopped"));
    const agent = dataAgent({ model, coordinator: db.coordinator, schema });
    await expect(call(agent, `SELECT "id" FROM "archive"."node"`, stopped.signal)).rejects.toThrow("stopped");
  });

  it("tells the model the rows are already in front of the reader, and what it may read", () => {
    const text = dataInstructions({ schema, key: "dense_id", scope: { selection: picked(), table: NODE } });
    expect(text).toContain(schema.ddl);
    expect(text).toContain("already in front of the reader");
    expect(text).toContain("Do not list the rows again");
    expect(text).toContain("a table named `scope`");
    expect(text).toContain("a table function or the catalog is refused");
    expect(text).toContain(`"dense_id"`);
  });
});

describe("a conversation with dataAgent", () => {
  /** The text the model read back for each tool call in its prompt. */
  const toolResults = (prompt: { role: string; content: unknown }[]) =>
    prompt
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content as { type: string; output?: { type: string; value?: unknown } }[])
      .filter((part) => part.type === "tool-result")
      .map((part) => String(part.output?.value));

  it("hands the model a sample of the rows and the scope that applied, after one tool call", async () => {
    const { model } = mockModel((_, index) =>
      index === 0 ? { tool: "query", input: { sql: `SELECT "kind", count(*)::INTEGER AS "n" FROM scope GROUP BY "kind"` } } : "Two contracts.",
    );
    const agent = dataAgent({ model, coordinator: db.coordinator, schema, scope: { selection: picked(), table: NODE } });
    const result = await agent.stream({ prompt: "How many contracts?" });
    expect(await result.text).toBe("Two contracts.");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(toolResults(model.doStreamCalls[1]!.prompt as never)).toEqual([
      [
        "1 rows, already shown to the reader.",
        `\`scope\` was: SELECT * FROM "archive"."node" WHERE ("kind" IN ('contract'))`,
        `First rows: [{"kind":"contract","n":2}]`,
      ].join("\n"),
    ]);
  });

  it("stops after five steps, however often the model calls the tool", async () => {
    const { model } = mockModel(() => ({ tool: "query", input: { sql: `SELECT count(*)::INTEGER AS "n" FROM "archive"."node"` } }));
    const agent = dataAgent({ model, coordinator: db.coordinator, schema });
    await (await agent.stream({ prompt: "Count forever" })).text;
    expect(model.doStreamCalls).toHaveLength(5);
  });

  it("hands the model the gate's refusal, so it can write another statement", async () => {
    const { model } = mockModel((_, index) =>
      index === 0 ? { tool: "query", input: { sql: "SELECT * FROM read_text('https://attacker.example/')" } } : "I cannot read that.",
    );
    const agent = dataAgent({ model, coordinator: db.coordinator, schema });
    await (await agent.stream({ prompt: "Read this URL" })).text;
    expect(toolResults(model.doStreamCalls[1]!.prompt as never)).toEqual([
      `The query failed: read_text() is a table function. A query reads "archive"."node", and nothing else.`,
    ]);
  });
});

describe("dataSuggestions", () => {
  it("asks for questions over the schema's DDL and the reader's scope, as many as were wanted", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "How many contracts?", rationale: "kind" }] }));
    const got = [];
    for await (const q of dataSuggestions({ model, schema, scope: { selection: picked(), table: NODE }, count: 3 })) got.push(q);
    expect(got).toEqual([{ text: "How many contracts?", rationale: "kind" }]);
    const prompt = promptOf(model.doStreamCalls[0]!);
    expect(prompt).toContain(schema.ddl);
    expect(prompt).toContain(`SELECT * FROM "archive"."node" WHERE ("kind" IN ('contract'))`);
    expect(prompt).toContain("Give 3.");
  });

  it("favours a question across a declared join, and a rationale naming the tables it connects", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [] }));
    for await (const _ of dataSuggestions({ model, schema })) void _;
    const system = (model.doStreamCalls[0]!.prompt as { role: string; content: unknown }[]).find((m) => m.role === "system");
    expect(String(system?.content)).toContain("cross a join the schema declares");
    expect(String(system?.content)).toContain("only when the schema declares no join");
    expect(String(system?.content)).toContain("The rationale names the tables the question connects.");
  });
});
