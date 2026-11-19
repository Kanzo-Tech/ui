/* global self, console, URL, setTimeout */
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
 * defined`. DuckDB's file stays in `@duckdb/duckdb-wasm`, where no host transpiles.
 *
 * **A module, not a classic script**, because the host's loaders run on this file too: under
 * `next dev`, React Refresh appends a footer that reads `import.meta`, which a classic script refuses
 * to parse. DuckDB's worker is classic but module-safe (strict already; its one global is
 * `onmessage`), so it is imported. A module worker takes messages before that import has run, so
 * the ones that arrive first are held and handed to DuckDB's handler in order.
 */
const print = console.log;
console.log = (...args) => {
  if (args[0] !== "HEAD") print(...args);
};

const worker = new URL(decodeURIComponent(self.location.hash.slice(1)), self.location.href);
if (worker.origin !== self.location.origin) throw new Error(`refusing to start a worker from ${worker.origin}`);

const early = [];
self.onmessage = (event) => early.push(event);
import(worker.href).then(
  () => {
    for (const event of early) self.onmessage(event);
  },
  // A rejection reaches no `error` listener on the page; an exception thrown in a task does.
  (error) =>
    setTimeout(() => {
      throw error;
    }),
);
