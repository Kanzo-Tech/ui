import { describe, expect, it } from "vitest";
import {
  autoDashboard,
  bucketExpr,
  cardTitle,
  channelFields,
  filterControl,
  measureExpr,
  normalizeCard,
  type DashboardCardSpec,
} from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";

const F = (name: string, kind: FieldStat["kind"], role: FieldStat["role"], distinct: number, extent?: [number, number]): FieldStat => ({
  name,
  type: kind === "numeric" ? "DOUBLE" : kind === "temporal" ? "TIMESTAMP" : "VARCHAR",
  kind,
  role,
  distinct,
  ...(extent ? { min: extent[0], max: extent[1] } : {}),
});

const FIELDS = [
  F("region", "categorical", "dimension", 6),
  F("beast", "categorical", "dimension", 40),
  F("email", "categorical", "identifier", 900),
  F("seen", "temporal", "dimension", 800, [Date.UTC(2024, 0, 1), Date.UTC(2024, 11, 31)]),
  F("bounty", "numeric", "measure", 300, [0, 500]),
  F("leagues", "numeric", "measure", 200, [0, 10]),
];

const card = (patch: Partial<DashboardCardSpec>): DashboardCardSpec => ({ id: "c", type: "bar", x: "region", y: { op: "count" }, ...patch });

describe("filterControl", () => {
  it("gives a time a timeline, a category a facet, a key a search and a measure a slider", () => {
    expect(FIELDS.map((f) => filterControl(f))).toEqual(["filter", "filter", "search", "timeline", "slider", "slider"]);
    expect(filterControl(F("id", "numeric", "identifier", 1000))).toBeNull();
  });
});

describe("channelFields", () => {
  it("offers bars the categories, a line the ordered fields, a scatter the measures", () => {
    const names = (fs: FieldStat[]) => fs.map((f) => f.name);
    expect(names(channelFields("bar", "x", FIELDS))).toEqual(["region", "beast"]);
    expect(names(channelFields("line", "x", FIELDS))).toEqual(["seen", "bounty", "leagues"]);
    expect(names(channelFields("dot", "x", FIELDS))).toEqual(["bounty", "leagues"]);
  });

  it("caps series at eight and panels at six, and gives neither to the chart that cannot take them", () => {
    expect(channelFields("line", "color", FIELDS).map((f) => f.name)).toEqual(["region"]);
    expect(channelFields("regression", "color", FIELDS)).toEqual([]);
    expect(channelFields("bar", "facet", FIELDS)).toEqual([]);
    expect(channelFields("area", "facet", FIELDS).map((f) => f.name)).toEqual(["region"]);
  });
});

describe("normalizeCard", () => {
  it("keeps what the new type can keep and replaces what it cannot", () => {
    expect(normalizeCard(card({ type: "line", color: "region" }), FIELDS)).toMatchObject({ x: "seen", color: "region" });
    expect(normalizeCard(card({ type: "regression", x: "bounty" }), FIELDS)).toMatchObject({
      x: "bounty",
      y: { op: "value", field: "leagues" },
    });
  });

  it("drops an optional encoding that no longer fits and falls back to a count", () => {
    const next = normalizeCard(card({ type: "bar", x: "beast", y: { op: "value", field: "bounty" }, facet: "region" }), FIELDS);
    expect(next).toEqual({ id: "c", type: "bar", x: "beast", y: { op: "count" } });
  });

  it("answers null when the relation has nothing the type can draw", () => {
    expect(normalizeCard(card({ type: "dot" }), [F("region", "categorical", "dimension", 6)])).toBeNull();
  });
});

describe("measureExpr", () => {
  it("compiles every aggregate to SQL, and a share to a filtered count over the count", () => {
    expect(String(measureExpr({ op: "count" }))).toBe("count(*)");
    expect(String(measureExpr({ op: "distinct", field: "beast" }))).toBe('count(DISTINCT "beast")');
    expect(String(measureExpr({ op: "avg", field: "bounty" }))).toBe('avg("bounty")');
    expect(String(measureExpr({ op: "share", field: "verdict", equals: "hoax" }))).toBe(
      `(100 * (count(*) FILTER (WHERE ("verdict" = 'hoax')) / count(*)))`,
    );
  });

  it("titles a card from its encodings unless it was given one", () => {
    expect(cardTitle(card({ y: { op: "sum", field: "bounty" }, color: "beast" }))).toBe("Total bounty by region and beast");
    expect(cardTitle(card({ type: "dot", x: "bounty", y: { op: "value", field: "leagues" } }))).toBe("bounty × leagues");
    expect(cardTitle(card({ title: "Mine" }))).toBe("Mine");
  });
});

describe("bucketExpr", () => {
  it("keeps a few-valued number as its own step and bins a time or a wide range", () => {
    expect(bucketExpr(F("hour", "numeric", "measure", 24, [0, 23]))).toBe("hour");
    expect(String(bucketExpr(FIELDS[3]!))).toMatch(/date_trunc|time_bucket/);
    expect(String(bucketExpr(FIELDS[4]!))).toMatch(/FLOOR/i);
  });
});

describe("autoDashboard", () => {
  const spec = autoDashboard(FIELDS);

  it("leads the filters with the time and bounds them to six", () => {
    expect(spec.filters.map((f) => f.field)).toEqual(["seen", "region", "beast", "email", "bounty", "leagues"]);
  });

  it("counts the rows and averages each measure, along the time", () => {
    expect(spec.stats.map((s) => [s.measure.op, s.measure.field, s.trend])).toEqual([
      ["count", undefined, "seen"],
      ["avg", "bounty", "seen"],
      ["avg", "leagues", "seen"],
    ]);
  });

  it("draws a timeline, bars, histograms and a fit, and fills every row of the grid", () => {
    expect(spec.cards.map((c) => c.type)).toEqual(["line", "bar", "bar", "histogram", "histogram", "regression"]);
    let used = 0;
    for (const c of spec.cards) used = (used + (c.span ?? 1)) % 3;
    expect(used).toBe(0);
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });
});
