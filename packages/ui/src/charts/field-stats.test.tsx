import type { Stats } from "@kanzo-tech/graphar-duckdb";
import { renderHook } from "@testing-library/react";
import type { Coordinator } from "@uwdata/mosaic-core";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { engineOver } from "../../test/engine";
import { graphOf } from "../../test/graph";
import { fieldStats, patternColumns, useFieldStats, type FieldColumn } from "./field-stats.js";
import { MosaicProvider } from "./mosaic-provider.js";

const exact = (distinct: number, more: Partial<Stats> = {}): Stats => ({ nulls: 0, distinct: { exact: distinct }, ...more });
const column = (name: string, type: string, more: Partial<FieldColumn> = {}): FieldColumn => ({ name, type, ...more });

describe("fieldStats", () => {
  it("reads a kind from Mosaic's type words, and a role from what the graph says and nothing else", () => {
    const fields = fieldStats([
      column("p.email", "VARCHAR", { primary: true }),
      column("p.country", "VARCHAR", { stats: exact(951) }),
      column("p.user_id", "BIGINT", { stats: exact(1000, { min: "1", max: "1000" }) }),
      column("p.age", "INTEGER", { stats: exact(80, { min: "18", max: "97" }) }),
      column("p.seen", "TIMESTAMP", { stats: exact(900, { min: "2024-01-01 00:00:00", max: "2024-12-31 00:00:00" }) }),
      column("p.active", "BOOLEAN"),
    ]);
    expect(fields.map((f) => [f.name, f.kind, f.role])).toEqual([
      ["p.email", "categorical", "identifier"],
      // Neither a name nor a count makes an identifier: 951 countries are a dimension, an id a measure.
      ["p.country", "categorical", "dimension"],
      ["p.user_id", "numeric", "measure"],
      ["p.age", "numeric", "measure"],
      ["p.seen", "temporal", "dimension"],
      ["p.active", "categorical", "dimension"],
    ]);
    expect(fields.find((f) => f.name === "p.age")).toMatchObject({ min: 18, max: 97, distinct: 80 });
    expect(fields.find((f) => f.name === "p.seen")?.min).toBe(Date.parse("2024-01-01T00:00:00"));
  });

  it("counts the least distinct values the chunks allow where they only bound it, and none where they say nothing", () => {
    const fields = fieldStats([
      column("p.city", "VARCHAR", { stats: { distinct: { atLeast: 40, atMost: 90 } } }),
      column("p.name", "VARCHAR"),
    ]);
    expect(fields.map((f) => [f.name, f.distinct])).toEqual([
      ["p.city", 40],
      ["p.name", 0],
    ]);
  });

  it("drops what no chart can draw and what the host excludes", () => {
    const fields = fieldStats(
      [column("tags", "VARCHAR[]"), column("blob", "BLOB"), column("span", "INTERVAL"), column("x", "FLOAT"), column("name", "VARCHAR")],
      { exclude: ["x"] },
    );
    expect(fields.map((f) => f.name)).toEqual(["name"]);
  });

  it("classifies every precision DuckDB reports, reads a zoned extent, and drops the three types a mark throws on", () => {
    const at = (min: string, max: string) => ({ stats: exact(366, { min, max }) });
    const fields = fieldStats([
      column("day", "DATE", at("2024-01-01", "2024-12-31")),
      column("ms", "TIMESTAMP_MS"),
      column("ns", "TIMESTAMP_NS"),
      column("tz", "TIMESTAMP WITH TIME ZONE", at("2024-01-01 02:00:00.5+02", "2024-12-31 00:00:00+00")),
      column("big", "HUGEINT"),
      column("s", "TIMESTAMP_S"),
      column("ttz", "TIME WITH TIME ZONE"),
      column("ubig", "UHUGEINT"),
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
});

const people = graphOf(
  [
    {
      type: "Person",
      count: 10,
      properties: [
        { name: "email", type: "VARCHAR", primary: true, stats: exact(10) },
        { name: "team", type: "INTEGER", stats: exact(4, { min: "1", max: "4" }) },
        { name: "nickname", type: "VARCHAR[]", list: true },
      ],
    },
    { type: "Team", count: 4, properties: [{ name: "name", type: "VARCHAR", stats: exact(4) }] },
  ],
  [{ edgeType: "memberOf", srcType: "Person", dstType: "Team", count: 10 }],
);

describe("patternColumns", () => {
  it("reads a column per named vertex for its index, then every property of every named element as variable.property", () => {
    const { columns, described } = patternColumns(people, [
      { as: "p", type: "Person" },
      { edge: "memberOf" },
      { as: "t", type: "Team" },
    ]);
    expect(columns).toEqual(["p", "t", "p.email", "p.team", "p.nickname", "t.name"]);
    expect(described.map((c) => [c.name, c.type, c.primary])).toEqual([
      ["p.email", "VARCHAR", true],
      ["p.team", "INTEGER", false],
      ["p.nickname", "VARCHAR[]", false],
      ["t.name", "VARCHAR", false],
    ]);
  });

  it("reads nothing of an element the pattern leaves unnamed", () => {
    const { columns } = patternColumns(people, [{ as: "p", type: "Person" }, { edge: "memberOf" }, { type: "Team" }]);
    expect(columns).toEqual(["p", "p.email", "p.team", "p.nickname"]);
  });
});

/** A coordinator that fails the test if it is ever asked: the fields are the graph's description. */
const silent = { query: vi.fn(() => Promise.reject(new Error("a field is never read"))), cancel: () => {} } as unknown as Coordinator;

const host =
  (graph = people) =>
  ({ children }: { children: ReactNode }) => (
    <MosaicProvider engine={engineOver(silent)} graph={graph}>
      {children}
    </MosaicProvider>
  );

describe("useFieldStats", () => {
  it("answers a pattern's fields from the graph's description, reading nothing", () => {
    const { result } = renderHook(() => useFieldStats([{ as: "p", type: "Person" }, { edge: "memberOf" }, { as: "t", type: "Team" }]), {
      wrapper: host(),
    });
    expect(result.current.fields.map((f) => [f.name, f.kind, f.role, f.distinct])).toEqual([
      ["p.email", "categorical", "identifier", 10],
      ["p.team", "numeric", "measure", 4],
      ["t.name", "categorical", "dimension", 4],
    ]);
    expect(result.current.columns).toEqual(["p", "t", "p.email", "p.team", "p.nickname", "t.name"]);
    expect(silent.query).not.toHaveBeenCalled();
  });

  it("hides what the host excludes, and keeps it among the columns", () => {
    const { result } = renderHook(() => useFieldStats([{ as: "p", type: "Person" }], { exclude: ["p.team"] }), { wrapper: host() });
    expect(result.current.fields.map((f) => f.name)).toEqual(["p.email"]);
    expect(result.current.columns).toContain("p.team");
  });

  it("throws where the page has no graph", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bare = ({ children }: { children: ReactNode }) => <MosaicProvider engine={engineOver(silent)}>{children}</MosaicProvider>;
    expect(() => renderHook(() => useFieldStats([{ as: "p", type: "Person" }]), { wrapper: bare })).toThrow(/the page has none/);
  });
});
