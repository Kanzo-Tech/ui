import { QueryError } from "@uwdata/mosaic-core";
import { describe, expect, it } from "vitest";
import { queryFailure } from "./failure.js";

describe("queryFailure", () => {
  it("is what the query threw, code and all, from the QueryError the coordinator hands a client", () => {
    const thrown = Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });
    const wrapped = new QueryError(thrown, "SELECT 1");
    expect(wrapped.message).toContain("SELECT 1");
    expect(queryFailure(wrapped)).toBe(thrown);
  });

  it("leaves anything else as it is", () => {
    const plain = new Error("not a query's");
    expect(queryFailure(plain)).toBe(plain);
    expect(queryFailure("Canceled")).toBe("Canceled");
  });
});
