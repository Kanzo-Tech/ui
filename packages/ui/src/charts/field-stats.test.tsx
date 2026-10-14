import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Coordinator } from "@uwdata/mosaic-core";
import { Query, asTableRef } from "@uwdata/mosaic-sql";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fieldStats, useFieldStats, type SummarizeRow } from "./field-stats.js";
import { MosaicProvider } from "./mosaic-provider.js";

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

/** A coordinator whose `SUMMARIZE` answers `rows`, or throws `fail` while it is set. */
function summarizing(rows: SummarizeRow[], asked: unknown[] = []) {
  const state = { fail: null as unknown };
  const coordinator = {
    query: async (q: unknown) => {
      asked.push(q);
      if (state.fail) throw state.fail;
      return rows;
    },
    cancel: () => {},
  } as unknown as Coordinator;
  return { coordinator, state };
}

function host(coordinator: Coordinator, client = new QueryClient(), onFailure?: (error: unknown) => void) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MosaicProvider coordinator={coordinator} onFailure={onFailure}>
        {children}
      </MosaicProvider>
    </QueryClientProvider>
  );
}

describe("useFieldStats", () => {
  it("keeps every column beside the fields, so a consumer can project the relation", async () => {
    const { coordinator } = summarizing([row("x", "FLOAT", 990), row("tags", "VARCHAR[]", 10), row("name", "VARCHAR", 10)]);
    const { result } = renderHook(() => useFieldStats("t", { exclude: ["x"] }), { wrapper: host(coordinator) });
    await waitFor(() => expect(result.current.fields).not.toBeNull());
    expect(result.current.fields!.map((f) => f.name)).toEqual(["name"]);
    expect(result.current.columns).toEqual(["x", "tags", "name"]);
  });

  it("summarizes a query over the relation, so a joined relation is summarized like a table", async () => {
    const asked: unknown[] = [];
    const { coordinator } = summarizing([], asked);
    const joined = Query.select({ "Person.age": "age" }).from("Person");
    const { result } = renderHook(
      () => [useFieldStats(asTableRef(["jobs/7", "Person"])!), useFieldStats(joined)],
      { wrapper: host(coordinator) },
    );
    await waitFor(() => expect(result.current.every((stats) => stats.fields !== null)).toBe(true));
    expect(asked).toEqual([
      'SUMMARIZE SELECT * FROM "jobs/7"."Person"',
      `SUMMARIZE SELECT * FROM (${joined})`,
    ]);
  });

  it("reads a relation once for every part that asks, whatever each hides", async () => {
    const asked: unknown[] = [];
    const { coordinator } = summarizing([row("x", "FLOAT", 990), row("name", "VARCHAR", 10)], asked);
    const { result } = renderHook(
      () => [useFieldStats("t"), useFieldStats("t", { exclude: ["x"] })],
      { wrapper: host(coordinator) },
    );
    await waitFor(() => expect(result.current.every((stats) => stats.fields !== null)).toBe(true));
    expect(asked).toHaveLength(1);
    expect(result.current.map((stats) => stats.fields!.map((f) => f.name))).toEqual([["x", "name"], ["name"]]);
  });

  it("keeps a failure out of the cache, whole, and reads again for the next part that asks", async () => {
    const asked: unknown[] = [];
    const { coordinator, state } = summarizing([row("name", "VARCHAR", 10)], asked);
    const failure = { code: "binder", detail: "no such table" };
    state.fail = failure;
    const failed = vi.fn();
    const client = new QueryClient();
    const first = renderHook(() => useFieldStats("t"), { wrapper: host(coordinator, client, failed) });
    await waitFor(() => expect(first.result.current.error).toBe(failure));
    // Never retried: one read, one failure handed to the host.
    expect(asked).toHaveLength(1);
    expect(failed).toHaveBeenCalledWith(failure);
    first.unmount();

    state.fail = null;
    const second = renderHook(() => useFieldStats("t"), { wrapper: host(coordinator, client) });
    await waitFor(() => expect(second.result.current.fields).not.toBeNull());
    expect(asked).toHaveLength(2);
  });

  it("reads on the host's client, and throws without one", () => {
    const { coordinator } = summarizing([]);
    const bare = ({ children }: { children: ReactNode }) => <MosaicProvider coordinator={coordinator}>{children}</MosaicProvider>;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useFieldStats("t"), { wrapper: bare })).toThrow(/No QueryClient set/);
  });
});
