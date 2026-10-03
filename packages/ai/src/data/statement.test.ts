// @vitest-environment node
import { asTableRef, clausePoints, Selection } from "@kanzo-tech/mosaic";
import { beforeAll, describe, expect, it } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { describeSchema, type DataSchema } from "./schema.js";
import { gateStatement, type DataScope } from "./statement.js";

let db: TestDatabase;
let schema: DataSchema;
let scope: DataScope;

/**
 * The data space the model was shown — two tables of an attached catalog — beside what it was not:
 * `secret`, a table of the same engine, and a view the page draws. A refusal is proved twice: by its
 * answer, and by the database being as it was afterwards.
 */
beforeAll(async () => {
  db = await testDatabase();
  db.run(`ATTACH ':memory:' AS "jobs/7"`);
  db.run(`CREATE TABLE "jobs/7"."Person" ("dense_id" INTEGER, "name" VARCHAR, "born" TIMESTAMP)`);
  db.run(`INSERT INTO "jobs/7"."Person" VALUES (1, 'Ada', '1815-12-10'), (2, 'Alan', '1912-06-23'), (3, 'Grace', '1906-12-09')`);
  db.run(`CREATE TABLE "jobs/7"."Person_knows_Person" ("src" INTEGER, "dst" INTEGER)`);
  db.run(`INSERT INTO "jobs/7"."Person_knows_Person" VALUES (1, 2), (2, 3), (1, 3)`);
  db.run(`CREATE TABLE secret ("x" INTEGER)`);
  db.run(`INSERT INTO secret VALUES (42)`);
  db.run(`CREATE VIEW drawn AS SELECT * FROM "jobs/7"."Person"`);
  schema = await describeSchema(db.coordinator, { catalog: "jobs/7" });
  const selection = Selection.crossfilter();
  selection.update(clausePoints(["name"], [["Ada"], ["Grace"]], { source: {} }));
  scope = { selection, table: asTableRef(["jobs/7", "Person"])! };
});

const gate = (sql: string) => gateStatement(db.coordinator, sql, { tables: schema.tables, scope, limit: 100 });
const rows = async (statement: string) =>
  Array.from((await db.coordinator.query(statement, { cache: false })) as Iterable<Record<string, unknown>>);

describe("the statement gate", () => {
  it.each([
    ["two statements", "SELECT 1; SELECT 2"],
    ["the paren break-out", "SELECT 1) t; DROP TABLE secret; SELECT * FROM (SELECT 1"],
    ["DROP", "DROP TABLE secret"],
    ["a view replaced", `CREATE OR REPLACE VIEW drawn AS SELECT 1 AS "dense_id"`],
    ["COPY to a bucket", `COPY "jobs/7"."Person" TO 's3://bucket/out.parquet'`],
    ["ATTACH", "ATTACH ':memory:' AS elsewhere"],
    ["DETACH", `DETACH "jobs/7"`],
    ["SET", "SET threads = 1"],
    ["PRAGMA", "PRAGMA version"],
    ["DROP SECRET", "DROP SECRET page"],
    ["INSTALL", "INSTALL spatial"],
    ["EXPLAIN", `EXPLAIN SELECT * FROM "jobs/7"."Person"`],
    ["read_text", "SELECT * FROM read_text('https://attacker.example/x')"],
    ["read_csv", "SELECT * FROM read_csv('s3://bucket/x.csv')"],
    ["read_parquet", "SELECT count(*) FROM read_parquet('s3://bucket/*.parquet')"],
    ["glob", "SELECT * FROM glob('s3://bucket/*')"],
    ["query_table", "SELECT * FROM query_table('secret')"],
    ["a catalog function", "SELECT * FROM duckdb_secrets()"],
    ["a pragma function", "SELECT * FROM pragma_table_info('secret')"],
    ["a file named as a table", "SELECT * FROM 's3://bucket/x.parquet'"],
    ["a table not in the schema", "SELECT * FROM secret"],
    ["a view not in the schema", "SELECT * FROM drawn"],
    ["a table of the schema's catalog under another schema", `SELECT * FROM "jobs/7".other."Person"`],
    ["a table not in the schema, in a subquery", `SELECT "name" FROM "jobs/7"."Person" WHERE "dense_id" IN (SELECT "x" FROM secret)`],
    ["a table function, joined", `SELECT * FROM "jobs/7"."Person", read_text('x')`],
    ["DESCRIBE", "DESCRIBE secret"],
    ["SUMMARIZE in a FROM", "SELECT * FROM (SUMMARIZE secret)"],
    ["a CTE that shadows scope", "WITH scope AS (SELECT * FROM \"jobs/7\".\"Person\") SELECT * FROM scope"],
    ["a CTE name read outside the query that defines it", "SELECT * FROM (WITH secret AS (SELECT 1) SELECT * FROM secret), secret"],
    ["a line comment hiding the terminator", "SELECT 1 --\n; DROP TABLE secret"],
    ["a block comment beside a second statement", "SELECT 1 /* one */; DROP TABLE secret"],
    ["a terminator inside a string", "SELECT ';'; DROP TABLE secret"],
    ["a dollar-quoted string beside a second statement", "SELECT $$x$$; DROP TABLE secret"],
    ["a quote that would close the gate's own literal", "SELECT 1'); DROP TABLE secret; --"],
  ])("refuses %s, as an answer, and leaves the database as it was", async (_, sql) => {
    const gated = await gate(sql);
    expect(gated).toMatchObject({ refused: { code: "query/refused" } });
    expect(db.run("SELECT count(*)::INTEGER AS n FROM secret")).toEqual([{ n: 1 }]);
    expect(db.run(`SELECT count(*)::INTEGER AS n FROM drawn`)).toEqual([{ n: 3 }]);
    expect(db.run(`SELECT count(*)::INTEGER AS n FROM duckdb_databases() WHERE database_name = 'jobs/7'`)).toEqual([{ n: 1 }]);
  });

  it("tells the model what it may read, by the names it was shown", async () => {
    expect(await gate("SELECT * FROM secret")).toEqual({
      refused: {
        message: `"secret" is not a table of the schema. A query reads "jobs/7"."Person", "jobs/7"."Person_knows_Person", scope, and nothing else.`,
        code: "query/refused",
      },
    });
    expect(await gate("SELECT * FROM read_text('x')")).toMatchObject({ refused: { message: expect.stringMatching(/^read_text\(\) is a table function/) } });
  });

  it.each([
    ["a table of the schema", `SELECT "name" FROM "jobs/7"."Person" ORDER BY "name" LIMIT 2`, [{ name: "Ada" }, { name: "Alan" }]],
    ["a table named in another case", `SELECT count(*)::INTEGER AS n FROM "jobs/7".person`, [{ n: 3 }]],
    [
      "a join",
      `SELECT a."name" AS "from", b."name" AS "to" FROM "jobs/7"."Person_knows_Person" k JOIN "jobs/7"."Person" a ON a."dense_id" = k."src" JOIN "jobs/7"."Person" b ON b."dense_id" = k."dst" WHERE a."name" = 'Ada' ORDER BY "to"`,
      [{ from: "Ada", to: "Alan" }, { from: "Ada", to: "Grace" }],
    ],
    [
      "a CTE",
      `WITH busy AS (SELECT "src", count(*)::INTEGER AS n FROM "jobs/7"."Person_knows_Person" GROUP BY "src") SELECT p."name", busy.n FROM busy JOIN "jobs/7"."Person" p ON p."dense_id" = busy."src" ORDER BY busy.n DESC LIMIT 1`,
      [{ name: "Ada", n: 2 }],
    ],
    ["a recursive CTE", "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 3) SELECT i FROM n", [{ i: 1 }, { i: 2 }, { i: 3 }]],
    [
      "a window function",
      `SELECT "name", row_number() OVER (ORDER BY "born")::INTEGER AS r FROM "jobs/7"."Person" QUALIFY r = 1`,
      [{ name: "Ada", r: 1 }],
    ],
    ["the reader's scope", `SELECT "name" FROM scope ORDER BY "name"`, [{ name: "Ada" }, { name: "Grace" }]],
    ["a string that looks like a comment and a terminator", "SELECT 'it''s -- not; DROP TABLE secret' AS s", [{ s: "it's -- not; DROP TABLE secret" }]],
    ["its own terminator and a trailing comment", "SELECT 1 AS x; -- one", [{ x: 1 }]],
  ])("lets %s through, and it runs", async (_, sql, expected) => {
    const gated = await gate(sql);
    if (!("statement" in gated)) throw new Error(gated.refused.message);
    expect(await rows(gated.statement)).toEqual(expected);
  });

  it("runs DuckDB's print of the parse, under the cap and with scope defined by the selection's predicate", async () => {
    expect(await gateStatement(db.coordinator, "select count(*) as n from scope -- all of it", { tables: schema.tables, scope, limit: 11 })).toEqual({
      statement: `WITH "scope" AS (SELECT * FROM "jobs/7"."Person" WHERE ("name" IN ('Ada', 'Grace'))) SELECT * FROM (SELECT count_star() AS n FROM "scope") LIMIT 11`,
    });
  });

  it("refuses scope when there is none", async () => {
    expect(await gateStatement(db.coordinator, "SELECT * FROM scope", { tables: schema.tables, limit: 10 })).toMatchObject({
      refused: { message: `"scope" is not a table of the schema. A query reads "jobs/7"."Person", "jobs/7"."Person_knows_Person", and nothing else.` },
    });
  });
});
