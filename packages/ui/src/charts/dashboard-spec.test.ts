import { describe, expect, it } from "vitest";
import {
  autoDashboard,
  bucketExpr,
  changeKind,
  channelFields,
  filterControl,
  measureExpr,
  newTile,
  normalizeCard,
  parseDashboard,
  parseDashboards,
  plotRelation,
  tileTitle,
  type ChartTile,
} from "./dashboard-spec.js";
import { Query, count, verbatim } from "@uwdata/mosaic-sql";
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

const card = (patch: Partial<ChartTile>): ChartTile => ({ id: "c", kind: "chart", span: 1, type: "bar", x: "region", y: { op: "count" }, ...patch });

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
    expect(next).toEqual({ id: "c", kind: "chart", span: 1, type: "bar", x: "beast", y: { op: "count" } });
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

  it("titles a tile from what it reads unless it was given one", () => {
    expect(tileTitle(card({ y: { op: "sum", field: "bounty" }, color: "beast" }))).toBe("Total bounty by region and beast");
    expect(tileTitle(card({ type: "dot", x: "bounty", y: { op: "value", field: "leagues" } }))).toBe("bounty × leagues");
    expect(tileTitle(card({ title: "Mine" }))).toBe("Mine");
    expect(tileTitle({ id: "s", kind: "stat", span: 1, measure: { op: "avg", field: "bounty" } })).toBe("Mean bounty");
    expect(tileTitle({ id: "t", kind: "table", span: 3, columns: [] })).toBe("Rows");
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
  const kinds = (kind: string) => spec.tiles.filter((t) => t.kind === kind);

  it("leads the filters with the time and bounds them to six", () => {
    expect(spec.filters.map((f) => f.field)).toEqual(["seen", "region", "beast", "email", "bounty", "leagues"]);
  });

  it("opens with one row of figures: the count and the mean of the first measures, along the time", () => {
    expect(spec.tiles.slice(0, 3).map((t) => (t.kind === "stat" ? [t.measure.op, t.measure.field, t.trend, t.span] : t.kind))).toEqual([
      ["count", undefined, "seen", 1],
      ["avg", "bounty", "seen", 1],
      ["avg", "leagues", "seen", 1],
    ]);
  });

  it("draws a timeline, bars, histograms and a fit, ends on the rows, and fills every row of the grid", () => {
    expect(kinds("chart").map((t) => t.kind === "chart" && t.type)).toEqual(["line", "bar", "bar", "histogram", "histogram", "regression"]);
    expect(spec.tiles.at(-1)).toMatchObject({ kind: "table", span: 3 });
    let used = 0;
    for (const t of spec.tiles) used = (used + t.span) % 3;
    expect(used).toBe(0);
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });
});

describe("newTile and changeKind", () => {
  it("adds the chart of a field the dashboard does not chart yet, and the mean of a measure it does not show", () => {
    const tiles = autoDashboard(FIELDS).tiles;
    expect(newTile("chart", FIELDS, [card({ x: "seen" })])).toMatchObject({ kind: "chart", x: "region" });
    expect(newTile("stat", FIELDS, tiles)).toMatchObject({ kind: "stat", measure: { op: "count" } });
    expect(newTile("stat", FIELDS, [])).toMatchObject({ kind: "stat", measure: { op: "avg", field: "bounty" } });
    expect(newTile("chart", [F("email", "categorical", "identifier", 900)], [])).toBeNull();
  });

  it("carries a chart's aggregate into a figure and back, keeping the id and the width", () => {
    const chart = card({ id: "k", span: 2, y: { op: "sum", field: "bounty" }, title: "Mine" });
    const stat = changeKind(chart, "stat", FIELDS, []);
    expect(stat).toEqual({ id: "k", kind: "stat", span: 2, measure: { op: "sum", field: "bounty" } });
    expect(changeKind(stat!, "chart", FIELDS, [])).toMatchObject({ id: "k", kind: "chart", span: 2, y: { op: "sum", field: "bounty" } });
    expect(changeKind(chart, "table", FIELDS, [])).toMatchObject({ id: "k", kind: "table", span: 2 });
  });
});

describe("plotRelation", () => {
  // The LDBC case: a vertex relation with a TIMESTAMP and a layout's `x`/`y`. A temporal line is
  // `SELECT time_bucket(…, "creationDate") AS "x", count(*) AS "y" … GROUP BY "x"`, and DuckDB binds
  // that `"x"` to the column, not the alias — "creationDate must appear in the GROUP BY clause".
  const columns = ["dense_id", "creationDate", "x", "y", "browser"];

  it("reads the relation itself when no column is named like a channel", () => {
    expect(plotRelation("comments", { fields: [], columns: ["creationDate", "browser"] }).table).toBe("comments");
  });

  it("projects the channel-named columns away, so a mark's alias can only mean the alias", () => {
    const fields = [F("x", "numeric", "measure", 900), F("creationDate", "temporal", "dimension", 900)];
    const { table: relation, fields: kept } = plotRelation(verbatim('"jobs/7"."Comment"'), { fields, columns });
    expect(kept.map((f) => f.name)).toEqual(["creationDate"]);
    expect(String(relation)).toBe('SELECT "dense_id", "creationDate", "browser" FROM "jobs/7"."Comment"');
    const mark = Query.from({ source: relation }).select({ x: "creationDate", y: count() }).groupby("x");
    expect(String(mark)).toContain('FROM (SELECT "dense_id", "creationDate", "browser" FROM "jobs/7"."Comment") AS "source"');
  });
});

describe("parseDashboard and parseDashboards", () => {
  const spec = autoDashboard(FIELDS);

  it("reads a current spec as itself, through JSON both ways", () => {
    expect(parseDashboard(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    const saved = { byRelation: { Person: spec } };
    expect(parseDashboards(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("reads nothing stored as no dashboards", () => {
    expect(parseDashboards(null)).toEqual({ byRelation: {} });
    expect(parseDashboards(undefined)).toEqual({ byRelation: {} });
  });

  it("refuses what an earlier release saved, whole, rather than reading part of it", () => {
    expect(() => parseDashboard({ version: 2, ...spec })).toThrow(/not a dashboard spec/);
    expect(() => parseDashboards({ version: 2, byRelation: {} })).toThrow(/not a dashboards document/);
    expect(() => parseDashboards({ version: 1, byType: {} })).toThrow(/not a dashboards document/);
  });

  it("names the relation and the field that is wrong", () => {
    const bad = { ...spec, tiles: [{ id: "a", kind: "chart", span: 4, type: "bar", x: "region", y: { op: "count" } }] };
    expect(() => parseDashboards({ byRelation: { Person: bad } })).toThrow(/at byRelation\.Person\.tiles\.0\.span/);
    expect(() => parseDashboard({ ...spec, tiles: [{ id: "a", kind: "map", span: 1 }] })).toThrow(/at tiles\.0\.kind/);
  });

  it("coerces, defaults and drops nothing", () => {
    expect(() => parseDashboard({ filters: [], tiles: [{ id: "a", kind: "table", span: "3", columns: [] }] })).toThrow(/span/);
    expect(() => parseDashboard({ filters: [] })).toThrow(/tiles/);
    expect(() => parseDashboard({ ...spec, tiles: [{ id: "a", kind: "table", span: 3, columns: [], extra: true }] })).toThrow(/extra/);
  });

  it("refuses a measure that cannot be drawn whatever the relation: a sum of nothing, a share of no value", () => {
    const stat = (measure: object) => ({ filters: [], tiles: [{ id: "a", kind: "stat", span: 1, measure }] });
    expect(parseDashboard(stat({ op: "count" })).tiles).toHaveLength(1);
    expect(() => parseDashboard(stat({ op: "sum" }))).toThrow(/at tiles\.0\.measure: every measure but count names a field/);
    expect(() => parseDashboard(stat({ op: "share", field: "verdict" }))).toThrow(/a share names the value it measures/);
  });
});
