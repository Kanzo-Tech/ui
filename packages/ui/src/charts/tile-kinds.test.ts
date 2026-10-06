import { describe, expect, it } from "vitest";
import { autoDashboard, type ChartTile, type Tile, type TileKind } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { changeKind, inBand, KINDS, newTile, peersOf, placeTile, tileTitle } from "./tile-kinds.js";

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
    expect(tileTitle({ id: "s", kind: "stat", measure: { op: "avg", field: "bounty" } })).toBe("Mean bounty");
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

  it("carries a chart's aggregate into a figure and back, keeping the id, and the width between chart and table", () => {
    const chart = card({ id: "k", span: 2, y: { op: "sum", field: "bounty" }, title: "Mine" });
    const stat = changeKind(chart, "stat", FIELDS, []);
    expect(stat).toEqual({ id: "k", kind: "stat", measure: { op: "sum", field: "bounty" } });
    expect(changeKind(stat!, "chart", FIELDS, [])).toMatchObject({ id: "k", kind: "chart", y: { op: "sum", field: "bounty" } });
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

  it("lets every kind become every other, keeping the id and dropping the title, and a figure has no width", () => {
    const sized = (t: Tile): Tile => (t.kind === "stat" ? t : { ...t, span: 2 });
    const tiles: Tile[] = (Object.keys(KINDS) as TileKind[]).map((kind) => ({ ...sized(newTile(kind, FIELDS, [], kind)!), title: "Mine" }));
    for (const from of tiles) {
      for (const kind of Object.keys(KINDS) as TileKind[]) {
        if (kind === from.kind) continue;
        const to = changeKind(from, kind, FIELDS, []);
        expect(to).toMatchObject({ id: from.id, kind });
        expect(to?.title).toBeUndefined();
        if (to?.kind === "stat") expect("span" in to).toBe(false);
        else if (from.kind !== "stat") expect(to?.span).toBe(2);
      }
    }
  });
});

describe("where a tile goes", () => {
  const stat = (id: string): Tile => ({ id, kind: "stat", measure: { op: "count" } });
  const ids = (tiles: Tile[]) => tiles.map((t) => t.id);
  const tiles = [stat("s1"), card({ id: "c1" }), stat("s2"), card({ id: "c2" })];

  it("draws a figure in the band and every other kind in the grid", () => {
    expect(tiles.map(inBand)).toEqual([true, false, true, false]);
    expect(ids(peersOf(tiles, tiles[0]!))).toEqual(["s2"]);
    expect(ids(peersOf(tiles, tiles[1]!))).toEqual(["c2"]);
  });

  it("places a tile among its peers, whatever lies between them in the spec", () => {
    expect(ids(placeTile(tiles, stat("s2"), 0))).toEqual(["s2", "s1", "c1", "c2"]);
    expect(ids(placeTile(tiles, card({ id: "c1" }), 1))).toEqual(["s1", "s2", "c2", "c1"]);
    expect(ids(placeTile(tiles, card({ id: "new" }), 9))).toEqual(["s1", "c1", "s2", "c2", "new"]);
    expect(ids(placeTile([card({ id: "c1" })], stat("s"), 0))).toEqual(["s", "c1"]);
  });
});
