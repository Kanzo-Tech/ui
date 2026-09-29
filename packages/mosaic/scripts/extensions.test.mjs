import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIN } from "./extensions.mjs";

const manifest = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

/**
 * An extension loads only into the DuckDB version it was built for, so the pin follows the
 * DuckDB-WASM `engine()` boots — and mosaic-core's is held to the same release, or the tree carries a
 * second engine nothing boots. Either moving without the pin fails here, in CI rather than on a page,
 * where DuckDB's refusal would be the first anyone heard of it.
 */
describe("extensions", () => {
  it("are built for the DuckDB-WASM engine() boots", () => {
    expect(manifest("../package.json").dependencies["@duckdb/duckdb-wasm"]).toBe(PIN.duckdbWasm);
  });

  it("are built for the DuckDB-WASM mosaic-core depends on", () => {
    // By path: mosaic-core's `exports` does not publish its package.json.
    const core = manifest("../node_modules/@uwdata/mosaic-core/package.json");
    expect(core.dependencies["@duckdb/duckdb-wasm"]).toBe(PIN.duckdbWasm);
  });
});
