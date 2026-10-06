import { describe, expect, it } from "vitest";
import { Mark } from "@uwdata/mosaic-plot";
import { count, sum } from "@uwdata/mosaic-sql";
import { denseStack, type StackChannel } from "./dense-stack.js";

/** A real mosaic-plot mark: its channels, and the query it builds from them. */
function mark(encodings: Record<string, unknown>) {
  const made = new Mark("areaY", { table: "sightings" }, encodings);
  return { channels: made.channels as StackChannel[], query: made.query([]) };
}

describe("denseStack", () => {
  // What `areaY x="hour" y={sum("bounty")} fill="region"` asks Mosaic for: one row per group that
  // has rows. A region with no sighting at 3am is absent from that bucket, and the stack above it falls.
  const { channels, query: stacked } = mark({ x: "hour", y: sum("bounty"), fill: "region", z: "region" });

  // A plain column is selected under its own name, and `fill` and `z` on one column are one dimension.
  it("completes every (step, series) pair the filtered query answered with, at zero", () => {
    expect(String(denseStack(stacked, channels, "hour"))).toBe(
      'WITH "__stack" AS MATERIALIZED (' + String(stacked) + ") " +
        'SELECT "hour", "region", sum("y") AS "y" FROM (' +
        'SELECT "hour", "region", "y" FROM "__stack" UNION ALL ' +
        'SELECT "hour", "region", 0 AS "y" FROM (SELECT DISTINCT "hour" FROM "__stack"), (SELECT DISTINCT "region" FROM "__stack")' +
        ') GROUP BY "hour", "region" ORDER BY "hour"',
    );
  });

  it("leaves a query alone that has no series or does not aggregate", () => {
    const single = mark({ x: "hour", y: count() });
    expect(denseStack(single.query, single.channels, "hour")).toBe(single.query);
    const rows = mark({ x: "hour", y: "bounty", z: "region" });
    expect(denseStack(rows.query, rows.channels, "hour")).toBe(rows.query);
  });
});
