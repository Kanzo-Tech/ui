import { describe, expect, it } from "vitest";
import { autoDashboard, cardFor, normalizeCard } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { cardRationale, recommend } from "./recommend.js";

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

  it("is read back from a card until it is edited, whatever its width or id", () => {
    const [line] = autoDashboard(FIELDS).cards;
    expect(cardRationale(line!, FIELDS)).toBe("seen is a time, so a line of counts along it");
    expect(cardRationale({ ...line!, span: 1, id: "other" }, FIELDS)).toBe("seen is a time, so a line of counts along it");
    expect(cardRationale({ ...line!, type: "area" }, FIELDS)).toBeNull();
    expect(cardRationale({ ...line!, color: "region" }, FIELDS)).toBeNull();
    expect(cardRationale({ ...line!, title: "Sightings" }, FIELDS)).toBeNull();
  });

  it("explains a card past the overview's caps, and a card proposed as an answer", () => {
    expect(cardRationale(cardFor(FIELDS[3]!)!, FIELDS)).toBe("cult has 12 values, so a bar of counts per value");
    const answer = { id: "a", type: "bar" as const, x: "region", y: { op: "sum" as const, field: "bounty" } };
    expect(cardRationale(answer, FIELDS)).toBe("region has 6 values and bounty is a measure, so a bar of total bounty per value");
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
    const { cards } = autoDashboard(FIELDS);
    expect(cards.map((c) => [c.id, c.type, c.x])).toEqual([
      ["card-0", "line", "seen"],
      ["card-1", "bar", "region"],
      ["card-2", "bar", "beast"],
      ["card-3", "bar", "hall"],
      ["card-4", "histogram", "bounty"],
      ["card-5", "histogram", "leagues"],
    ]);
  });
});
