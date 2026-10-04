import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { MosaicProvider, type FieldStat } from "@kanzo-tech/ui/analytics";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import type { ToolPart } from "../tool.js";
import type { QueryAnswer } from "./agent.js";
import { answerChart, answerRelation, answerView, QueryResult, toCsv } from "./query-result.js";

let db: TestDatabase;
beforeAll(async () => {
  db = await testDatabase();
  db.run(`CREATE TABLE secret ("x" INTEGER)`);
});

const part = (output: QueryAnswer) =>
  ({ type: "tool-query", toolCallId: "c", state: "output-available", input: { sql: output.sql }, output }) as ToolPart;

const field = (name: string, kind: FieldStat["kind"], role: FieldStat["role"], distinct: number): FieldStat => ({
  name,
  type: kind === "numeric" ? "BIGINT" : "VARCHAR",
  kind,
  role,
  distinct,
});

describe("how an answer is read", () => {
  it("is one figure when it is one row of one column", () => {
    expect(answerView([{ n: 42 }])).toEqual({ kind: "stat", label: "n", value: 42 });
    expect(answerView([{ n: 42, m: 1 }])).toEqual({ kind: "rows" });
  });

  it("is the chart recommend proposes for an answer, a measure against what it was grouped by", () => {
    const chart = answerChart([field("region", "categorical", "dimension", 5), field("contracts", "numeric", "measure", 5)]);
    expect(chart).toMatchObject({ type: "bar", x: "region", y: { op: "sum", field: "contracts" } });
  });

  it("passes over bars too many to read, and is a table when nothing else calls for a chart", () => {
    expect(answerChart([field("name", "categorical", "dimension", 400), field("n", "numeric", "measure", 9)])?.type).toBe("histogram");
    expect(answerChart([field("id", "numeric", "identifier", 9)])).toBeNull();
  });
});

describe("QueryResult", () => {
  it("draws a single figure as a Stat, with its column as the label", () => {
    render(<QueryResult part={part({ sql: "select count(*) as n", rows: [{ n: 1234 }], truncated: false })} />);
    expect(document.querySelector("[data-slot=stat-label]")?.textContent).toBe("n");
    expect(document.querySelector("[data-slot=stat-value]")?.textContent).toBe((1234).toLocaleString());
    expect(screen.getByRole("button", { name: "Copy the SQL" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Download as CSV" })).not.toBeNull();
  });

  it("draws a refusal as the engine's words, with the SQL that was refused", () => {
    render(<QueryResult part={part({ sql: "select * from nope", error: { message: "Table nope does not exist", code: "query/failed" } })} />);
    expect(screen.getByRole("alert").textContent).toContain("Table nope does not exist");
    expect(screen.getByRole("button", { name: /SQL/ })).not.toBeNull();
  });

  it("hands the host's actions the whole answer", () => {
    const output = { sql: "select 1 as n", rows: [{ n: 1 }], truncated: false };
    render(<QueryResult actions={(o) => <button type="button">Filter to {o.rows.length}</button>} part={part(output)} />);
    expect(screen.getByRole("button", { name: "Filter to 1" })).not.toBeNull();
  });
});

describe("what the card reads", () => {
  it("is the rows it holds, as literals: a timestamp is a timestamp again, and SQL in a kept row is data", async () => {
    const rows = [
      { "it's": "'); DROP TABLE secret; --", at: "2026-01-02T03:04:05.000Z", n: 1.5, ok: true, gone: null },
      { "it's": "x", at: "2026-01-03T00:00:00.000Z", n: 2, ok: false, gone: null },
    ];
    const relation = String(answerRelation(rows));
    expect(db.run(`SELECT typeof("at") AS t FROM ${relation} LIMIT 1`)).toEqual([{ t: "TIMESTAMP" }]);
    const read = await db.coordinator.query(`SELECT "it's", "n", "ok", "gone" FROM ${relation}`, { cache: false });
    expect(Array.from(read as Iterable<unknown>)).toEqual(rows.map((row) => ({ "it's": row["it's"], n: row.n, ok: row.ok, gone: row.gone })));
    expect(db.run("SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name = 'secret'")).toEqual([{ n: 1 }]);
  });

  it("never runs the SQL a kept answer carries: the chart reads the rows", async () => {
    const sent: string[] = [];
    const query = db.coordinator.query.bind(db.coordinator);
    db.coordinator.query = ((sql: unknown, options?: Parameters<typeof query>[1]) => (sent.push(String(sql)), query(sql as never, options))) as never;
    const output = { sql: "DROP TABLE secret", rows: [{ region: "north", contracts: 3 }, { region: "south", contracts: 5 }], truncated: false };
    render(
      <MosaicProvider coordinator={db.coordinator}>
        <QueryResult part={part(output)} />
      </MosaicProvider>,
    );
    expect(await screen.findByRole("radio", { name: "Chart" })).not.toBeNull();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter((sql) => sql.includes("DROP"))).toEqual([]);
    expect(db.run("SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name = 'secret'")).toEqual([{ n: 1 }]);
  });
});

describe("the CSV an answer downloads as", () => {
  it("quotes a field with a comma, a quote or a line break, and leaves null empty", () => {
    expect(toCsv([{ a: 'say "hi", twice', b: null, c: 3 }])).toBe('a,b,c\r\n"say ""hi"", twice",,3');
  });
});
