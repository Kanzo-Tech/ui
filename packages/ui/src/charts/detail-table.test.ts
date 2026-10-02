import { describe, expect, it } from "vitest";
import { formatTemporal } from "./detail-table.js";

describe("formatTemporal", () => {
  const midnight = Date.UTC(2024, 2, 5);

  it("shows a DATE as the day it is, in any zone", () => {
    expect(formatTemporal("DATE", midnight)).toBe(new Date(midnight).toLocaleDateString(undefined, { timeZone: "UTC" }));
    expect(formatTemporal("DATE", midnight)).not.toMatch(/:/);
  });

  it("shows a TIMESTAMP as its wall clock and a TIMESTAMPTZ in the viewer's zone", () => {
    const at = Date.UTC(2024, 2, 5, 14, 30);
    expect(formatTemporal("TIMESTAMP", at)).toBe(new Date(at).toLocaleString(undefined, { timeZone: "UTC" }));
    expect(formatTemporal("TIMESTAMP WITH TIME ZONE", at)).toBe(new Date(at).toLocaleString());
    expect(formatTemporal("TIMESTAMP_MS", BigInt(at))).toBe(new Date(at).toLocaleString(undefined, { timeZone: "UTC" }));
  });

  it("leaves a time of day and an unreadable value as they came", () => {
    expect(formatTemporal("TIME", "14:30:00")).toBe("14:30:00");
    expect(formatTemporal("DATE", "not a date")).toBe("not a date");
  });
});
