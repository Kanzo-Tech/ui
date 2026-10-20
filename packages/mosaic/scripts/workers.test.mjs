import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DUCKDB_DIST, WORKERS, quiet } from "./workers.mjs";

const original = (name) => readFileSync(join(DUCKDB_DIST, name), "utf8");

/**
 * The worker DuckDB-WASM ships prints every header its HTTP glue sends, and through `httpfs` that is
 * an `s3://` read's `Authorization` and `x-amz-security-token`. What this proves is that the copy
 * `engine()` starts has no such statement and differs from DuckDB-WASM's in nothing else; it cannot
 * prove DuckDB-WASM prints a credential by no other path, which only a page reading `s3://` with its
 * console open would show.
 */
describe("workers", () => {
  it.each(WORKERS)("%s keeps everything but the header print", (name) => {
    const source = original(name);
    const copy = quiet(source, name);
    expect(copy).not.toMatch(/console\.log\("HEAD"/);
    expect(copy).not.toMatch(/sourceMappingURL/);
    const cut = source.match(/console\.log\("HEAD",[^;]*\);/)[0];
    expect(source.replace(cut, "").replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n")).toBe(copy);
  });

  it("refuses a worker where the print is not exactly once", () => {
    expect(() => quiet("self.onmessage = () => {};", "moved.worker.js")).toThrow(/found 0/);
  });

  // A worker copied and never started is bytes in every host's bundle; one started and not copied prints.
  it("are the two engine() starts", () => {
    const engine = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    const started = [...engine.matchAll(/"\.\.\/workers\/([\w.-]+\.worker\.js)"/g)].map(([, name]) => name).sort();
    expect(started).toEqual([...WORKERS].sort());
    expect(engine).not.toMatch(/@duckdb\/duckdb-wasm\/dist\/[\w.-]+\.worker\.js/);
  });
});
