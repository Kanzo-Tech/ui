import { describe, expect, it } from "vitest";
import { autoDashboard, type ChartTile, type Tile, type TileKind } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { changeKind, KINDS, newTile, tileTitle } from "./tile-kinds.js";

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
  F("email", "categorical", "identifier", 900),
  F("seen", "temporal", "dimension", 800),
  F("bounty", "numeric", "measure", 300),
  F("leagues", "numeric", "measure", 200),
];

const card = (patch: Partial<ChartTile>): ChartTile => ({ id: "c", kind: "chart", span: 1, type: "bar", x: "region", y: { op: "count" }, ...patch });

describe("tileTitle", () => {
  it("titles a tile from what it reads unless it was given one", () => {
    expect(tileTitle(card({ y: { op: "sum", field: "bounty" }, color: "beast" }))).toBe("Total bounty by region and beast");
    expect(tileTitle(card({ type: "dot", x: "bounty", y: { op: "value", field: "leagues" } }))).toBe("bounty × leagues");
    expect(tileTitle(card({ title: "Mine" }))).toBe("Mine");
    expect(tileTitle({ id: "s", kind: "stat", span: 1, measure: { op: "avg", field: "bounty" } })).toBe("Mean bounty");
    expect(tileTitle({ id: "t", kind: "table", span: 3, columns: [] })).toBe("Rows");
  });
});

describe("newTile and changeKind", () => {
  it("adds the chart of a field the dashboard does not chart yet, and the mean of a measure it does not show", () => {
    const tiles = autoDashboard(FIELDS).tiles;
    expect(newTile("chart", FIELDS, [card({ x: "seen" })], "n")).toMatchObject({ kind: "chart", x: "region" });
    expect(newTile("stat", FIELDS, tiles, "n")).toMatchObject({ kind: "stat", measure: { op: "count" } });
    expect(newTile("stat", FIELDS, [], "n")).toMatchObject({ kind: "stat", measure: { op: "avg", field: "bounty" } });
    expect(newTile("chart", [F("email", "categorical", "identifier", 900)], [], "n")).toBeNull();
  });

  it("carries a chart's aggregate into a figure and back, keeping the id and the width", () => {
    const chart = card({ id: "k", span: 2, y: { op: "sum", field: "bounty" }, title: "Mine" });
    const stat = changeKind(chart, "stat", FIELDS, []);
    expect(stat).toEqual({ id: "k", kind: "stat", span: 2, measure: { op: "sum", field: "bounty" } });
    expect(changeKind(stat!, "chart", FIELDS, [])).toMatchObject({ id: "k", kind: "chart", span: 2, y: { op: "sum", field: "bounty" } });
    expect(changeKind(chart, "table", FIELDS, [])).toMatchObject({ id: "k", kind: "table", span: 2 });
  });
});

describe("the kind table", () => {
  it("makes every kind with the id it is given, so making a tile is pure", () => {
    for (const kind of Object.keys(KINDS) as TileKind[]) {
      const a = newTile(kind, FIELDS, [], "given");
      expect(a?.id).toBe("given");
      expect(newTile(kind, FIELDS, [], "given")).toEqual(a);
    }
  });

  it("lets every kind become every other, keeping the id and the width and dropping the title", () => {
    const tiles: Tile[] = (Object.keys(KINDS) as TileKind[]).map((kind) => ({ ...newTile(kind, FIELDS, [], kind)!, span: 2, title: "Mine" }));
    for (const from of tiles) {
      for (const kind of Object.keys(KINDS) as TileKind[]) {
        if (kind === from.kind) continue;
        const to = changeKind(from, kind, FIELDS, []);
        expect(to).toMatchObject({ id: from.id, kind, span: 2 });
        expect(to?.title).toBeUndefined();
      }
    }
  });
});
