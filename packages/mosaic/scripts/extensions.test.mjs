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

  // A pin nothing loads is bytes in every host's bundle; a load nothing pins is a 404 at boot.
  it("are each pinned for both bundles and loaded by engine() for both", () => {
    const engine = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    const loaded = [...engine.matchAll(/"\.\.\/extensions\/(wasm_\w+)\/(\w+)\.duckdb_extension\.wasm"/g)]
      .map(([, platform, name]) => `${platform}/${name}`)
      .sort();
    const pinned = Object.entries(PIN.extensions)
      .flatMap(([name, builds]) => Object.keys(builds).map((platform) => `${platform}/${name}`))
      .sort();
    expect(Object.values(PIN.extensions).map((builds) => Object.keys(builds).sort())).toEqual(
      Object.keys(PIN.extensions).map(() => ["wasm_eh", "wasm_mvp"]),
    );
    expect(loaded).toEqual(pinned);
  });
});
