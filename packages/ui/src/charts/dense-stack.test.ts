import { describe, expect, it } from "vitest";
import { count, Query, sum } from "@uwdata/mosaic-sql";
import { denseStack } from "./dense-stack.js";

describe("denseStack", () => {
  // What `areaY x="hour" y={sum("bounty")} fill="region"` asks Mosaic for: one row per group that
  // has rows. A region with no sighting at 3am is absent from that bucket, and the stack above it falls.
  const stacked = Query.from("sightings")
    .select({ x: "hour", y: sum("bounty"), fill: "region", z: "region" })
    .groupby("x", "fill", "z");

  it("completes every (step, series) pair the filtered query answered with, at zero", () => {
    expect(String(denseStack(stacked, "x"))).toBe(
      'WITH "__stack" AS MATERIALIZED (' + String(stacked) + ") " +
        'SELECT "x", "fill", "z", sum("y") AS "y" FROM (' +
        'SELECT "x", "fill", "z", "y" FROM "__stack" UNION ALL ' +
        'SELECT "x", "fill", "z", 0 AS "y" FROM (SELECT DISTINCT "x" FROM "__stack"), (SELECT DISTINCT "fill", "z" FROM "__stack")' +
        ') GROUP BY "x", "fill", "z" ORDER BY "x"',
    );
  });

  it("stacks along a plain column, which Mosaic selects under its own name", () => {
    const plain = Query.from("ev").select({ kind: "kind", hour: "hour", y: count() }).groupby("kind", "hour");
    const sql = String(denseStack(plain, "hour"));
    expect(sql).toContain('SELECT "kind", "hour", 0 AS "y" FROM (SELECT DISTINCT "hour" FROM "__stack"), (SELECT DISTINCT "kind" FROM "__stack")');
    expect(sql).toMatch(/ORDER BY "hour"$/);
  });

  it("leaves a query alone that has no series or does not aggregate", () => {
    const single = Query.from("sightings").select({ x: "hour", y: count() }).groupby("x");
    expect(denseStack(single, "x")).toBe(single);
    const rows = Query.from("sightings").select({ x: "hour", y: "bounty", z: "region" });
    expect(denseStack(rows, "x")).toBe(rows);
  });
});
