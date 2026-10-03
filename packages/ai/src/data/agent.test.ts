import { clausePoints, Coordinator, Selection, asTableRef } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { dataAgent, dataInstructions, statement, type QueryAnswer } from "./agent.js";
import { mockModel } from "../testing/model.js";

const NODE = asTableRef(["archive", "node"])!;

/** A page selection holding one clause: the reader picked contracts. */
function picked() {
  const selection = Selection.crossfilter();
  selection.update(clausePoints(["kind"], [["contract"]], { source: {} }));
  return selection;
}

/** A coordinator that answers every statement with `rows`, and remembers what it was sent. */
function coordinator(rows: Record<string, unknown>[] | Error) {
  const sent: string[] = [];
  const fake = {
    query: async (sql: unknown) => {
      sent.push(String(sql));
      if (rows instanceof Error) throw rows;
      return { toArray: () => rows };
    },
  } as unknown as Coordinator;
  return { fake, sent };
}

async function call(agent: ReturnType<typeof dataAgent>, sql: string): Promise<QueryAnswer> {
  const query = agent.tools.query;
  return (await query.execute!({ sql }, { toolCallId: "c", messages: [], abortSignal: undefined } as never)) as QueryAnswer;
}

describe("the statement a query runs", () => {
  it("defines scope as the relation under the selection's clauses, built from its predicate nodes", () => {
    expect(statement("SELECT count(*) AS n FROM scope", { selection: picked(), table: NODE }, 1000)).toBe(
      `WITH "scope" AS (SELECT * FROM "archive"."node" WHERE ("kind" IN ('contract'))) SELECT * FROM (SELECT count(*) AS n FROM scope\n) LIMIT 1000`,
    );
  });

  it("holds the row cap over whatever the model wrote, and survives its terminator and a trailing comment", () => {
    expect(statement("SELECT 1 AS x; -- one", undefined, 5)).toBe("SELECT * FROM (SELECT 1 AS x -- one\n) LIMIT 5");
  });

  it("defines scope as the whole relation while nothing is selected", () => {
    expect(statement("SELECT * FROM scope", { selection: Selection.crossfilter(), table: NODE })).toContain(
      `WITH "scope" AS (SELECT * FROM "archive"."node")`,
    );
  });
});

describe("dataAgent", () => {
  const { model } = mockModel(() => "");

  it("runs the model's SQL under the scope, and hands the reader every row, plain enough for a message", async () => {
    const { fake, sent } = coordinator([{ id: 1n, at: new Date("2026-01-02T00:00:00Z"), name: "a" }]);
    const agent = dataAgent({ model, coordinator: fake, schema: "", scope: { selection: picked(), table: NODE } });
    const answer = await call(agent, "SELECT * FROM scope LIMIT 10");
    expect(sent[0]).toContain(`WITH "scope" AS`);
    expect(answer).toEqual({
      sql: "SELECT * FROM scope LIMIT 10",
      statement: sent[0],
      rows: [{ id: 1, at: "2026-01-02T00:00:00.000Z", name: "a" }],
      truncated: false,
    });
  });

  it("answers a refused statement with the engine's words rather than throwing", async () => {
    const { fake } = coordinator(new Error('Table "nope" does not exist'));
    const answer = await call(dataAgent({ model, coordinator: fake, schema: "" }), "SELECT * FROM nope");
    expect(answer).toEqual({ sql: "SELECT * FROM nope", error: { message: 'Table "nope" does not exist' } });
  });

  it("tells the model the rows are already in front of the reader", () => {
    const text = dataInstructions({ schema: "CREATE TABLE t (x INTEGER);", key: "dense_id", scope: { selection: picked(), table: NODE } });
    expect(text).toContain("already in front of the reader");
    expect(text).toContain("Do not list the rows again");
    expect(text).toContain("a table named `scope`");
    expect(text).toContain(`"dense_id"`);
  });
});
