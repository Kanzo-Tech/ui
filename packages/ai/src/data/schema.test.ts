import type { Coordinator } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { describeSchema } from "./schema.js";

const ROWS = [
  { table_schema: "main", table_name: "Person", column_name: "dense_id", data_type: "UINTEGER" },
  { table_schema: "main", table_name: "Person", column_name: "name", data_type: "VARCHAR" },
  { table_schema: "main", table_name: "Person_knows_Person", column_name: "src", data_type: "UINTEGER" },
  { table_schema: "main", table_name: "Person_knows_Person", column_name: "dst", data_type: "UINTEGER" },
  { table_schema: "main", table_name: "fossil_tables", column_name: "table_name", data_type: "VARCHAR" },
];

describe("describeSchema", () => {
  it("writes the catalog as qualified DDL, its references as REFERENCES, and leaves out what is excluded, from its tables as well", async () => {
    const sent: string[] = [];
    const coordinator = {
      query: async (sql: unknown) => {
        sent.push(String(sql));
        return { toArray: () => ROWS };
      },
    } as unknown as Coordinator;
    const schema = await describeSchema(coordinator, {
      catalog: "jobs/7",
      exclude: ["fossil_tables"],
      references: [
        { table: "Person_knows_Person", column: "src", references: { table: "Person", column: "dense_id" } },
        { table: "Person_knows_Person", column: "dst", references: { table: "Person", column: "dense_id" } },
      ],
    });
    expect(sent[0]).toContain(`"table_catalog" = 'jobs/7'`);
    expect(schema.ddl).toBe(
      [
        `CREATE TABLE "jobs/7"."Person" (\n  "dense_id" UINTEGER,\n  "name" VARCHAR\n);`,
        `CREATE TABLE "jobs/7"."Person_knows_Person" (\n  "src" UINTEGER REFERENCES "jobs/7"."Person" ("dense_id"),\n  "dst" UINTEGER REFERENCES "jobs/7"."Person" ("dense_id")\n);`,
      ].join("\n\n"),
    );
    expect(schema.tables).toEqual([
      ["jobs/7", "Person"],
      ["jobs/7", "Person_knows_Person"],
    ]);
  });
});
