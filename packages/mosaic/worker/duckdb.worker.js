/* global self, console, URL */
/**
 * The worker `engine()` starts: DuckDB-WASM's own, named in this script's fragment, with one line of
 * its output dropped. Its synchronous HTTP glue runs `console.log("HEAD", name, value)` for every
 * header of every request it sends, and through `httpfs` those are an `s3://` read's SigV4
 * `Authorization` (the access key id) and `x-amz-security-token` (the whole STS session token), in
 * the console of every page that read under a vended credential. The engine's `VoidLogger` does not
 * reach it: it is the worker's own `console`, not DuckDB-WASM's logger.
 *
 * **A wrapper, not a copy with the line cut.** A copy is a `.js` inside this package, and a host that
 * transpiles `@kanzo-tech/mosaic` (Next's `transpilePackages`) runs its loader on it: SWC folds
 * `typeof window` to `"object"` in a client build, and DuckDB's worker then dies on `window is not
 * defined`. DuckDB's file stays in `@duckdb/duckdb-wasm`, where no host transpiles; this one has
 * nothing a loader can break.
 *
 * Classic, not a module: DuckDB-WASM's browser worker is a classic script, loaded with `importScripts`.
 */
const print = console.log;
console.log = (...args) => {
  if (args[0] !== "HEAD") print(...args);
};

const worker = new URL(decodeURIComponent(self.location.hash.slice(1)), self.location.href);
if (worker.origin !== self.location.origin) throw new Error(`refusing to start a worker from ${worker.origin}`);
self.importScripts(worker.href);
