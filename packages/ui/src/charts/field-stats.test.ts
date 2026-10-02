import { describe, expect, it } from "vitest";
import type { Coordinator } from "@uwdata/mosaic-core";
import { fieldStats, queryFieldStats, type SummarizeRow } from "./field-stats.js";

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
    const { fields } = fieldStats([
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

  it("drops what no chart can draw and what the host excludes, and lists every column", () => {
    const { fields, columns } = fieldStats(
      [row("tags", "VARCHAR[]", 10), row("blob", "BLOB", 1), row("span", "INTERVAL", 3), row("x", "FLOAT", 990), row("name", "VARCHAR", 10)],
      { exclude: ["x"] },
    );
    expect(fields.map((f) => f.name)).toEqual(["name"]);
    expect(columns).toEqual(["tags", "blob", "span", "x", "name"]);
  });

  it("classifies every precision DuckDB reports, reads a zoned extent, and drops the three types a mark throws on", () => {
    const { fields } = fieldStats([
      row("day", "DATE", 366, "2024-01-01", "2024-12-31"),
      row("ms", "TIMESTAMP_MS", 900, "2024-01-01 00:00:00.001", "2024-12-31 00:00:00.001"),
      row("ns", "TIMESTAMP_NS", 900),
      row("tz", "TIMESTAMP WITH TIME ZONE", 900, "2024-01-01 02:00:00.5+02", "2024-12-31 00:00:00+00"),
      row("big", "HUGEINT", 900, "1", "9"),
      row("s", "TIMESTAMP_S", 900),
      row("ttz", "TIME WITH TIME ZONE", 900),
      row("ubig", "UHUGEINT", 900),
    ]);
    expect(fields.map((f) => [f.name, f.kind])).toEqual([
      ["day", "temporal"],
      ["ms", "temporal"],
      ["ns", "temporal"],
      ["tz", "temporal"],
      ["big", "numeric"],
    ]);
    expect(fields.find((f) => f.name === "day")).toMatchObject({ min: Date.parse("2024-01-01"), max: Date.parse("2024-12-31") });
    expect(fields.find((f) => f.name === "tz")).toMatchObject({
      min: Date.parse("2024-01-01T00:00:00.5Z"),
      max: Date.parse("2024-12-31T00:00:00Z"),
    });
  });

  it("takes plain rows, as a host's own query returns them", () => {
    const { fields } = fieldStats([
      { column_name: "n", column_type: "DOUBLE", approx_unique: 5, min: "1.5", max: "4", count: 10 },
    ]);
    expect(fields).toEqual([{ name: "n", type: "DOUBLE", kind: "numeric", role: "measure", distinct: 5, min: 1.5, max: 4 }]);
  });
});

describe("queryFieldStats", () => {
  it("keeps every column beside the fields, so a consumer can project the relation", async () => {
    const coordinator = {
      query: async () => [row("x", "FLOAT", 990), row("tags", "VARCHAR[]", 10), row("name", "VARCHAR", 10)],
    } as unknown as Coordinator;
    const stats = await queryFieldStats(coordinator, "t", { exclude: ["x"] });
    expect(stats.fields.map((f) => f.name)).toEqual(["name"]);
    expect(stats.columns).toEqual(["x", "tags", "name"]);
  });
});
