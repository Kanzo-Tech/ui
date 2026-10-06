import { describe, expect, it } from "vitest";
import { autoDashboard, cardFor, edited, normalizeCard, type ChartTile } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { enumerate, explain, rank, rationale, recommend, RULES } from "./recommend.js";

const F = (name: string, kind: FieldStat["kind"], role: FieldStat["role"], distinct: number): FieldStat => ({
  name,
  type: kind === "numeric" ? "DOUBLE" : kind === "temporal" ? "TIMESTAMP" : "VARCHAR",
  kind,
  role,
  distinct,
});

const FIELDS = [
  F("region", "categorical", "dimension", 6),
  F("beast", "categorical", "dimension", 40),
  F("hall", "categorical", "dimension", 3),
  F("cult", "categorical", "dimension", 12),
  F("email", "categorical", "identifier", 900),
  F("seen", "temporal", "dimension", 800),
  F("bounty", "numeric", "measure", 300),
  F("leagues", "numeric", "measure", 200),
  F("teeth", "numeric", "measure", 30),
];

const charts = (fields: readonly FieldStat[]) =>
  autoDashboard(fields).tiles.filter((t): t is ChartTile => t.kind === "chart");

const shape = (fields: readonly FieldStat[], intent?: "overview" | "answer") =>
  recommend(fields, intent).map(({ spec }) => [spec.type, spec.x, spec.y.op, spec.y.field]);

describe("recommend for an overview", () => {
  it("orders by weight: the time, then the categories, the measures and one fit", () => {
    expect(shape(FIELDS)).toEqual([
      ["line", "seen", "count", undefined],
      ["bar", "region", "count", undefined],
      ["bar", "beast", "count", undefined],
      ["bar", "hall", "count", undefined],
      ["histogram", "bounty", "count", undefined],
      ["histogram", "leagues", "count", undefined],
      ["regression", "bounty", "value", "leagues"],
    ]);
  });

  it("caps each rule — three categories, two measures, one fit — taking fields in the relation's order", () => {
    const kinds = recommend(FIELDS).map(({ spec }) => spec.type);
    expect(kinds.filter((t) => t === "bar")).toHaveLength(3);
    expect(kinds.filter((t) => t === "histogram")).toHaveLength(2);
    expect(kinds.filter((t) => t === "regression")).toHaveLength(1);
    expect(recommend(FIELDS).some(({ spec }) => spec.x === "cult" || spec.x === "teeth")).toBe(false);
  });

  it("draws no key and no constant", () => {
    expect(recommend([F("email", "categorical", "identifier", 900), F("one", "categorical", "dimension", 1)])).toEqual([]);
  });

  it("proposes only cards the editors would keep as they are", () => {
    for (const intent of ["overview", "answer"] as const) {
      for (const { spec } of recommend(FIELDS, intent)) expect(normalizeCard(spec, FIELDS)).toEqual(spec);
    }
  });
});

describe("recommend for an answer", () => {
  it("puts a measure against its time or its category before any chart of one field", () => {
    const result = [F("day", "temporal", "dimension", 30), F("kind", "categorical", "dimension", 4), F("n", "numeric", "measure", 25)];
    expect(shape(result, "answer").slice(0, 3)).toEqual([
      ["line", "day", "sum", "n"],
      ["bar", "kind", "sum", "n"],
      ["line", "day", "count", undefined],
    ]);
  });

  it("answers a category and a number with a bar of the number", () => {
    const [best] = recommend([F("type", "categorical", "dimension", 3), F("n", "numeric", "measure", 3)], "answer");
    expect(best?.spec).toMatchObject({ type: "bar", x: "type", y: { op: "sum", field: "n" } });
    expect(best?.rationale).toBe("type has 3 values and n is a measure, so a bar of total n per value");
  });
});

describe("the rationale", () => {
  it("names the fields and what about them chose the chart", () => {
    expect(recommend(FIELDS).map((r) => r.rationale)).toEqual([
      "seen is a time, so a line of counts along it",
      "region has 6 values, so a bar of counts per value",
      "beast has 40 values, so a bar of counts per value",
      "hall has 3 values, so a bar of counts per value",
      "bounty is a measure, so a histogram of how its values spread",
      "leagues is a measure, so a histogram of how its values spread",
      "bounty and leagues are both measures, so a fit of one against the other",
    ]);
  });

  it("is read back from a tile's origin, over the fields the tile itself reads", () => {
    const [line] = charts(FIELDS);
    expect(line!.origin).toEqual({ rule: "time" });
    expect(rationale(line!, FIELDS)).toBe("seen is a time, so a line of counts along it");
    expect(rationale({ ...line!, origin: undefined }, FIELDS)).toBeNull();
    expect(rationale(line!, FIELDS.filter((f) => f.name !== "seen"))).toBeNull();
  });

  it("is not claimed by a card added by hand, even one the rules would propose", () => {
    expect(cardFor(FIELDS[3]!)!.origin).toBeUndefined();
    expect(rationale(cardFor(FIELDS[3]!)!, FIELDS)).toBeNull();
  });
});

describe("edited", () => {
  const [line] = charts(FIELDS);

  it("keeps the origin of a tile only widened or moved", () => {
    expect(edited(line, { ...line!, span: 1 })).toEqual({ ...line!, span: 1 });
  });

  it("drops it once the tile reads something else or is renamed", () => {
    for (const change of [{ type: "area" as const }, { color: "region" }, { title: "Sightings" }, { y: { op: "sum" as const, field: "bounty" } }]) {
      expect((edited(line, { ...line!, ...change }) as ChartTile).origin).toBeUndefined();
    }
  });

  it("drops it from a tile it has never seen", () => {
    expect((edited(undefined, line!) as ChartTile).origin).toBeUndefined();
  });
});

describe("the pipeline", () => {
  it("enumerates every rule's candidates in the table's order, capped per rule, before any weighing", () => {
    const candidates = enumerate(RULES, FIELDS);
    expect(candidates.map((c) => c.rule.id)).toEqual([
      "time-measure", "time-measure", "time-measure",
      "category-measure", "category-measure", "category-measure",
      "time", "category", "category", "category", "measure", "measure", "measure-pair",
    ]);
  });

  it("ranks by the intent's weight, leaving out what it does not weigh, ties in the order they came", () => {
    const ranked = rank(enumerate(RULES, FIELDS), "overview").map((c) => [c.rule.id, c.fields[0]!.name]);
    expect(ranked.slice(0, 4)).toEqual([["time", "seen"], ["category", "region"], ["category", "beast"], ["category", "hall"]]);
    expect(ranked.some(([id]) => id === "time-measure")).toBe(false);
  });

  it("explains a candidate with a derived id, so the same fields always give the same answer", () => {
    const [first] = rank(enumerate(RULES, FIELDS), "overview");
    expect(explain(first!)).toEqual({
      spec: { id: "time:seen", kind: "chart", span: 2, type: "line", x: "seen", y: { op: "count" } },
      rationale: "seen is a time, so a line of counts along it",
      rule: "time",
    });
    expect(recommend(FIELDS)).toEqual(recommend(FIELDS));
  });

  it("is made of Show Me's cases, each rule naming the one it is", () => {
    for (const rule of RULES) expect(rule.showMe).toMatch(/^(Lines \(continuous\)|Bars|Histogram|Scatter plot): /);
  });
});

describe("cardFor", () => {
  it("gives a field the best chart of it alone, and a key none", () => {
    expect(cardFor(FIELDS[5]!)).toMatchObject({ type: "line", x: "seen" });
    expect(cardFor(FIELDS[6]!)).toMatchObject({ type: "histogram", x: "bounty" });
    expect(cardFor(FIELDS[4]!)).toBeNull();
  });
});

describe("autoDashboard's cards", () => {
  it("are the overview's first six, ids by position", () => {
    expect(charts(FIELDS).map((c) => [c.id, c.type, c.x])).toEqual([
      ["card-0", "line", "seen"],
      ["card-1", "bar", "region"],
      ["card-2", "bar", "beast"],
      ["card-3", "bar", "hall"],
      ["card-4", "histogram", "bounty"],
      ["card-5", "histogram", "leagues"],
    ]);
  });
});
