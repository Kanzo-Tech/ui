import { describe, expect, it } from "vitest";
import { column, numbers } from "./arrow.js";

/** What Arrow returns for a column whose type has a typed array — an integer id. */
const typed = {
  getChild: (name: string) =>
    name === "id" ? { toArray: () => new Int32Array([7, 8, 9]) } : null,
};

/** What it returns for a dictionary-encoded string: no usable child at all. */
const dictionary = {
  getChild: () => null,
  [Symbol.iterator]: function* () {
    yield { label: "alpha", id: 1 };
    yield { label: "beta", id: 2 };
  },
};

describe("column", () => {
  it("reads a typed column through getChild", () => {
    expect(column(typed, "id")).toEqual([7, 8, 9]);
  });

  // The reason this helper exists: the same call site gets both shapes back, one per column type.
  it("falls back to iterating rows when the column has no typed child", () => {
    expect(column(dictionary, "label")).toEqual(["alpha", "beta"]);
  });

  it("iterates when the result is not Arrow at all", () => {
    expect(column([{ n: 1 }, { n: 2 }], "n")).toEqual([1, 2]);
  });

  it("gives a row-shaped hole rather than throwing on an absent field", () => {
    expect(column([{ n: 1 }], "missing")).toEqual([undefined]);
  });
});

describe("numbers", () => {
  it("coerces the BigInt some integer widths arrive as", () => {
    const big = { getChild: () => ({ toArray: () => [1n, 2n, 3n] }) };
    expect(numbers(big, "id")).toEqual([1, 2, 3]);
  });

  it("coerces through the untyped path too", () => {
    expect(numbers(dictionary, "id")).toEqual([1, 2]);
  });
});
