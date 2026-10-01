import { describe, expect, it } from "vitest";
import { fieldStats, type SummarizeRow } from "./field-stats.js";

const row = (column_name: string, column_type: string, approx_unique: number, min?: string, max?: string): SummarizeRow => ({
  column_name,
  column_type,
  approx_unique: BigInt(approx_unique),
  min: min ?? null,
  max: max ?? null,
  count: BigInt(1000),
});

describe("fieldStats", () => {
  it("reads a kind from Mosaic's type words and a role from the name and the distinct count", () => {
    const fields = fieldStats([
      row("country", "VARCHAR", 12),
      row("email", "VARCHAR", 998),
      row("user_id", "BIGINT", 1000, "1", "1000"),
      row("age", "INTEGER", 80, "18", "97"),
      row("price", "DECIMAL(10,2)", 400, "0.5", "99.9"),
      row("seen", "TIMESTAMP", 900, "2024-01-01 00:00:00", "2024-12-31 00:00:00"),
      row("active", "BOOLEAN", 2),
    ]);
    expect(fields.map((f) => [f.name, f.kind, f.role])).toEqual([
      ["country", "categorical", "dimension"],
      ["email", "categorical", "identifier"],
      ["user_id", "numeric", "identifier"],
      ["age", "numeric", "measure"],
      ["price", "numeric", "measure"],
      ["seen", "temporal", "dimension"],
      ["active", "categorical", "dimension"],
    ]);
    expect(fields.find((f) => f.name === "age")).toMatchObject({ min: 18, max: 97, distinct: 80 });
    expect(fields.find((f) => f.name === "seen")?.min).toBe(Date.parse("2024-01-01T00:00:00"));
  });

  it("drops what no chart can draw and what the host excludes", () => {
    const fields = fieldStats(
      [row("tags", "VARCHAR[]", 10), row("blob", "BLOB", 1), row("span", "INTERVAL", 3), row("x", "FLOAT", 990), row("name", "VARCHAR", 10)],
      { exclude: ["x"] },
    );
    expect(fields.map((f) => f.name)).toEqual(["name"]);
  });
});
