import { tableFromArrays } from "@uwdata/flechette";
import { describe, expect, it } from "vitest";
import { numbers } from "./arrow.js";

describe("numbers", () => {
  it("reads a column out of an Arrow table", () => {
    expect(numbers(tableFromArrays({ id: new Int32Array([7, 8, 9]) }), "id")).toEqual([7, 8, 9]);
  });

  it("coerces the BigInt some integer widths arrive as", () => {
    expect(numbers(tableFromArrays({ id: new BigInt64Array([1n, 2n, 3n]) }, { useBigInt: true }), "id")).toEqual([1, 2, 3]);
  });

  it("reads an array of rows the same way", () => {
    expect(numbers([{ id: 1 }, { id: 2 }], "id")).toEqual([1, 2]);
  });

  it("throws on a field the query did not select", () => {
    expect(() => numbers([{ id: 1 }], "missing")).toThrow(/no column "missing"/);
  });
});
