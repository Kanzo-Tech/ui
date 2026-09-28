import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIN } from "./extensions.mjs";

/**
 * The DuckDB-WASM that `engine()` boots is whichever release `@uwdata/mosaic-core` pins, and an
 * extension loads only into the DuckDB version it was built for. So the pin follows mosaic-core, and
 * this fails the day mosaic-core moves on and the pin does not — in CI rather than on a page, where
 * DuckDB's refusal would be the first anyone heard of it.
 */
describe("extensions", () => {
  it("are built for the DuckDB-WASM mosaic-core boots", () => {
    // By path: mosaic-core's `exports` does not publish its package.json.
    const core = JSON.parse(
      readFileSync(new URL("../node_modules/@uwdata/mosaic-core/package.json", import.meta.url), "utf8"),
    );
    expect(core.dependencies["@duckdb/duckdb-wasm"]).toBe(PIN.duckdbWasm);
  });
});
