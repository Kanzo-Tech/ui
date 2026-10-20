// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const wrapper = readFileSync(new URL("../worker/duckdb.worker.js", import.meta.url), "utf8");

/** The wrapper, run as a browser runs a worker started from `url`: what it printed, and what it imported. */
function start(url: string) {
  const printed: unknown[][] = [];
  const imported: string[] = [];
  const console = { log: (...args: unknown[]) => printed.push(args) };
  const self = { location: new URL(url), importScripts: (href: string) => imported.push(href) };
  runInNewContext(wrapper, { console, self, URL });
  return { log: (...args: unknown[]) => console.log(...args), printed, imported };
}

const page = "https://page.test/_next/static/media/duckdb.worker.0a1b.js";
const duckdb = "https://page.test/_next/static/media/duckdb-browser-eh.worker.2c3d.js";

/**
 * The wrapper DuckDB's worker runs inside. What this proves is that DuckDB's header print is dropped,
 * every other line kept, and DuckDB's worker the one imported; it cannot prove DuckDB-WASM prints a
 * credential by no other path, which only a page reading `s3://` with its console open would show.
 */
describe("the engine's worker", () => {
  it("drops the line DuckDB prints for each header it sends, and keeps every other", () => {
    const worker = start(`${page}#${encodeURIComponent(duckdb)}`);
    worker.log("HEAD", "x-amz-security-token", "IQoJb3JpZ2luX2VjE…");
    worker.log("HEAD", "Authorization", "AWS4-HMAC-SHA256 Credential=ASIAEXAMPLE/…");
    worker.log("DuckDB says", 42);
    expect(worker.printed).toEqual([["DuckDB says", 42]]);
  });

  it("imports the DuckDB worker its fragment names", () => {
    expect(start(`${page}#${encodeURIComponent(duckdb)}`).imported).toEqual([duckdb]);
  });

  it("refuses a worker from another origin", () => {
    expect(() => start(`${page}#${encodeURIComponent("https://elsewhere.test/duckdb.js")}`)).toThrow(/elsewhere\.test/);
  });

  // The filter matches DuckDB's spelling; a release that prints headers under another word prints them again.
  it("matches the one header print in each of the pinned DuckDB-WASM's workers", () => {
    for (const build of ["mvp", "eh"]) {
      const source = readFileSync(new URL(`../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-${build}.worker.js`, import.meta.url), "utf8");
      expect(source.match(/console\.log\("HEAD",/g), build).toHaveLength(1);
      expect(source.match(/console\.log\([^)]*UTF8ToString\([^)]*\),\s*UTF8ToString/g), build).toHaveLength(1);
    }
  });
});
