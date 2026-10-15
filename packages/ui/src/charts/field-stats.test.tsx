import { engineOver } from "../../test/engine";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Coordinator } from "@uwdata/mosaic-core";
import { Query, asTableRef } from "@uwdata/mosaic-sql";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { JoinColumnStats, JoinGraph } from "@kanzo-tech/mosaic";
import { fieldStats, useFieldStats, type FieldColumn } from "./field-stats.js";
import { MosaicProvider } from "./mosaic-provider.js";

/** One `SUMMARIZE` row, under the column names DuckDB gives it. */
type SummarizeRow = Record<"column_name" | "column_type" | "approx_unique" | "min" | "max" | "count", unknown>;

const row = (column_name: string, column_type: string, approx_unique: number, min?: string, max?: string): SummarizeRow => ({
  column_name,
  column_type,
  approx_unique: BigInt(approx_unique),
  min: min ?? null,
  max: max ?? null,
  count: BigInt(1000),
});

const XSD = "http://www.w3.org/2001/XMLSchema#";
const counted = (distinctCount: number, more: Partial<JoinColumnStats> = {}): JoinColumnStats => ({
  nullCount: 0,
  distinctCount,
  mostCommonVals: [],
  mostCommonFreqs: [],
  ...more,
});
const column = (name: string, type: string, more: Partial<FieldColumn> = {}): FieldColumn => ({ name, type, ...more });

describe("fieldStats", () => {
  it("reads a kind from Mosaic's type words, and a role from what the data says and nothing else", () => {
    const { fields } = fieldStats([
      column("dense_id", "UBIGINT", { role: "address" }),
      column("subject", "VARCHAR", { role: "identity", termType: "rr:IRI" }),
      column("homepage", "VARCHAR", { termType: "rr:IRI" }),
      // A mapping states RML-Core's spelling.
      column("website", "VARCHAR", { termType: "IRI" }),
      column("email", "VARCHAR", { candidateKey: true }),
      column("country", "VARCHAR", { stats: counted(951) }),
      column("user_id", "BIGINT", { stats: counted(1000, { minValue: "1", maxValue: "1000" }) }),
      column("age", "INTEGER", { stats: counted(80, { minValue: "18", maxValue: "97" }) }),
      column("seen", "TIMESTAMP", { stats: counted(900, { minValue: "2024-01-01 00:00:00", maxValue: "2024-12-31 00:00:00" }) }),
      column("active", "BOOLEAN"),
    ]);
    expect(fields.map((f) => [f.name, f.kind, f.role])).toEqual([
      ["dense_id", "numeric", "identifier"],
      ["subject", "categorical", "identifier"],
      ["homepage", "categorical", "identifier"],
      ["website", "categorical", "identifier"],
      ["email", "categorical", "identifier"],
      // Neither a name nor a count makes an identifier: 951 countries are a dimension, an id a measure.
      ["country", "categorical", "dimension"],
      ["user_id", "numeric", "measure"],
      ["age", "numeric", "measure"],
      ["seen", "temporal", "dimension"],
      ["active", "categorical", "dimension"],
    ]);
    expect(fields.find((f) => f.name === "age")).toMatchObject({ min: 18, max: 97, distinct: 80 });
    expect(fields.find((f) => f.name === "seen")?.min).toBe(Date.parse("2024-01-01T00:00:00"));
  });

  it("reads a time by its datatype, a year stored as its integer among them, and its extent as the years' first days", () => {
    const { fields } = fieldStats([
      column("born", "INTEGER", { datatype: `${XSD}gYear`, stats: counted(10, { minValue: "1900", maxValue: "1909" }) }),
      column("code", "VARCHAR", { datatype: `${XSD}gYearMonth` }),
      column("score", "INTEGER", { datatype: `${XSD}integer` }),
    ]);
    expect(fields.map((f) => [f.name, f.kind, f.role])).toEqual([
      ["born", "temporal", "dimension"],
      ["code", "categorical", "dimension"],
      ["score", "numeric", "measure"],
    ]);
    expect(fields[0]).toMatchObject({ min: Date.UTC(1900, 0, 1), max: Date.UTC(1909, 0, 1) });
  });

  it("carries what the writer counted and the annotations, as the corpus says them", () => {
    const label = { predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { value: "country", language: "en" } };
    const { fields } = fieldStats([
      column("country", "VARCHAR", { annotations: [label], stats: counted(3, { mostCommonVals: ["ES", "FR", "DE"], mostCommonFreqs: [0.5, 0.3, 0.2] }) }),
    ]);
    expect(fields).toEqual([
      { name: "country", type: "VARCHAR", kind: "categorical", role: "dimension", distinct: 3, values: ["ES", "FR", "DE"], annotations: [label] },
    ]);
  });

  it("drops what no chart can draw and what the host excludes, and lists every column", () => {
    const { fields, columns } = fieldStats(
      [column("tags", "VARCHAR[]"), column("blob", "BLOB"), column("span", "INTERVAL"), column("x", "FLOAT"), column("name", "VARCHAR")],
      { exclude: ["x"] },
    );
    expect(fields.map((f) => f.name)).toEqual(["name"]);
    expect(columns).toEqual(["tags", "blob", "span", "x", "name"]);
  });

  it("classifies every precision DuckDB reports, reads a zoned extent, and drops the three types a mark throws on", () => {
    const at = (min: string, max: string) => ({ stats: counted(366, { minValue: min, maxValue: max }) });
    const { fields } = fieldStats([
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

function host(coordinator: Coordinator, client = new QueryClient(), onFailure?: (error: unknown) => void, joins?: JoinGraph) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MosaicProvider engine={engineOver(coordinator)} joins={joins} onFailure={onFailure}>
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
    const bare = ({ children }: { children: ReactNode }) => <MosaicProvider engine={engineOver(coordinator)}>{children}</MosaicProvider>;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useFieldStats("t"), { wrapper: bare })).toThrow(/No QueryClient set/);
  });

  it("reads nothing for a relation over the page's joins whose every column the corpus counted", async () => {
    const asked: unknown[] = [];
    const { coordinator } = summarizing([], asked);
    const joins: JoinGraph = {
      types: [
        {
          name: "Person",
          table: "people",
          key: "dense_id",
          candidateKeys: ["dense_id"],
          columns: [column("dense_id", "UBIGINT", { role: "address", stats: counted(10) }), column("team", "INTEGER", { stats: counted(4) })],
        },
      ],
      edges: [{ name: "Person_knows_Person", label: "knows", source: "Person", destination: "Person", table: "knows", src: "src", dst: "dst" }],
    };
    const { result } = renderHook(
      () => [useFieldStats("Person"), useFieldStats({ root: "Person", path: [{ edge: "Person_knows_Person", direction: "out" }] })],
      { wrapper: host(coordinator, undefined, undefined, joins) },
    );
    await waitFor(() => expect(result.current.every((stats) => stats.fields !== null)).toBe(true));
    expect(asked).toEqual([]);
    expect(result.current[0]!.fields!.map((f) => [f.name, f.role])).toEqual([["dense_id", "identifier"], ["team", "measure"]]);
    expect(result.current[1]!.columns).toEqual(["dense_id", "team", "knows.dense_id", "knows.team"]);
  });

  it("counts a relation whose only uncounted column is no field at all, such as a list", async () => {
    const asked: unknown[] = [];
    const { coordinator } = summarizing([], asked);
    const joins: JoinGraph = {
      types: [
        {
          name: "Person",
          table: "people",
          key: "dense_id",
          columns: [column("dense_id", "UINTEGER", { role: "address", stats: counted(10) }), column("nickname", "VARCHAR[]"), column("team", "INTEGER", { stats: counted(4) })],
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useFieldStats("Person"), { wrapper: host(coordinator, undefined, undefined, joins) });
    await waitFor(() => expect(result.current.fields).not.toBeNull());
    expect(asked).toEqual([]);
    expect(result.current.fields!.map((f) => f.name)).toEqual(["dense_id", "team"]);
  });

  it("summarizes a relation over the joins the corpus did not count, keeping what the graph says each column is", async () => {
    const asked: unknown[] = [];
    const { coordinator } = summarizing([row("dense_id", "UBIGINT", 10), row("born", "INTEGER", 10, "1900", "1909")], asked);
    const joins: JoinGraph = {
      types: [{ name: "vertices", table: "everything", key: "dense_id", columns: [column("dense_id", "UBIGINT", { role: "address" }), column("born", "INTEGER", { datatype: `${XSD}gYear` })] }],
      edges: [],
    };
    const { result } = renderHook(() => useFieldStats("vertices"), { wrapper: host(coordinator, undefined, undefined, joins) });
    await waitFor(() => expect(result.current.fields).not.toBeNull());
    expect(asked).toEqual(['SUMMARIZE SELECT * FROM "everything"']);
    expect(result.current.fields!.map((f) => [f.name, f.kind, f.role, f.distinct])).toEqual([
      ["dense_id", "numeric", "identifier", 10],
      ["born", "temporal", "dimension", 10],
    ]);
  });
});
