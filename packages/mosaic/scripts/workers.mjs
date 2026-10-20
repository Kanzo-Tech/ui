#!/usr/bin/env node
/**
 * Puts the DuckDB-WASM workers `engine()` starts beside this package, as `@duckdb/duckdb-wasm`'s own
 * with one statement taken out: the `console.log("HEAD", name, value)` its synchronous HTTP glue runs
 * for every header of every request it sends. Through `httpfs` those headers are the request's SigV4
 * `Authorization` (the access key id) and `x-amz-security-token` (the whole STS session token), so a
 * page that read `s3://` under a vended credential printed it to the console of every visitor. The
 * engine's `VoidLogger` does not reach it: it is the worker's own `console`, not DuckDB-WASM's logger.
 * The pinned release prints it, and so does `1.33.1-dev65.0`, the newest when this was written.
 *
 * **Copied at build, never committed**, like `extensions/`: `workers/` rides the npm tarball and the
 * host's bundler emits it through `new URL(…, import.meta.url)` in `src/engine.ts`. Git holds only
 * this transform.
 *
 * **The build fails when the statement is not there exactly once** in each worker, so a DuckDB-WASM
 * release that moves or renames it is read before it ships, rather than printing again unnoticed.
 * The source map is not carried: it maps the bytes before the cut.
 *
 * `mvp` and `eh` only: those are the two bundles `engine()` hands `selectBundle`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WORKERS = ["duckdb-browser-mvp.worker.js", "duckdb-browser-eh.worker.js"];

const PRINT = /console\.log\("HEAD",[^;]*\);/g;
const SOURCE_MAP = /\n\/\/# sourceMappingURL=\S+\s*$/;

/** The worker's source without the header print, or a refusal naming what is not as expected. */
export function quiet(source, name) {
  const found = source.match(PRINT)?.length ?? 0;
  if (found !== 1) throw new Error(`${name}: expected one console.log("HEAD", …), found ${found}`);
  return source.replace(PRINT, "").replace(SOURCE_MAP, "\n");
}

const here = dirname(fileURLToPath(import.meta.url));
export const DUCKDB_DIST = join(here, "..", "node_modules", "@duckdb", "duckdb-wasm", "dist");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(here, "..", "workers");
  await mkdir(root, { recursive: true });
  await Promise.all(
    WORKERS.map(async (name) => {
      const source = await readFile(join(DUCKDB_DIST, name), "utf8");
      await writeFile(join(root, name), quiet(source, name));
    }),
  );
}
