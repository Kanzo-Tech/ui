// @vitest-environment node
import { asTableRef, clausePoints, Selection } from "@kanzo-tech/mosaic";
import { beforeAll, describe, expect, it } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { dataAgent, dataInstructions, type QueryAnswer } from "./agent.js";
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

async function call(agent: ReturnType<typeof dataAgent>, sql: string): Promise<QueryAnswer> {
  const query = agent.tools.query;
  return (await query.execute!({ sql }, { toolCallId: "c", messages: [], abortSignal: undefined } as never)) as QueryAnswer;
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
