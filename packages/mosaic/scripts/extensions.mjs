#!/usr/bin/env node
/**
 * Puts DuckDB's `httpfs` extension beside this package, so `engine()` loads it from the host's own
 * origin rather than from extensions.duckdb.org at runtime.
 *
 * **Fetched at build, never committed.** The binaries ride the npm tarball (`files` lists
 * `extensions/`) and the host's bundler emits them as assets through `new URL(…, import.meta.url)` in
 * `src/engine.ts` — the same idiom `@fossil-lang/corpus` uses for its own `.wasm`. Git holds only the
 * pin below.
 *
 * **Pinned by hash, because this is executable code.** DuckDB also verifies its own signature on
 * `LOAD`, but that says who built it, not that it is the build we tested. When upstream re-uploads an
 * extension for the same DuckDB version the build fails here, and re-pinning is a decision.
 *
 * `mvp` and `eh` only: those are the two bundles `engine()` hands `selectBundle`, so a `threads`
 * build would be bytes no page can load.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `duckdbWasm` is the DuckDB-WASM release this package depends on, and `duckdb` the library version
 * that release reports (`SELECT library_version FROM pragma_version()`), which is the directory
 * extensions are published under. `extensions.test.mjs` fails when a dependency moves and this does not.
 */
export const PIN = {
  duckdbWasm: "1.33.1-dev57.0",
  duckdb: "v1.5.4",
  httpfs: {
    wasm_mvp: "ef756ec28db02feafd02ab036aa01f4fc11ac197bd295bf0f20e4e23d48c54c3",
    wasm_eh: "576721756dd01b86cdfdcf1303ecdcc9776929fd21c3e3b86fdd43a2259aec5b",
  },
};

const REPOSITORY = "https://extensions.duckdb.org";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extensions");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function ensure(platform, expected) {
  const file = join(root, platform, "httpfs.duckdb_extension.wasm");
  const held = await readFile(file).catch(() => null);
  if (held && sha256(held) === expected) return;

  const url = `${REPOSITORY}/${PIN.duckdb}/${platform}/httpfs.duckdb_extension.wasm`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${url} is not the pinned build: sha256 ${actual}, pinned ${expected}`);
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  console.log(`extensions: ${PIN.duckdb}/${platform}/httpfs (${(bytes.byteLength / 1024).toFixed(0)} kB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await Promise.all(Object.entries(PIN.httpfs).map(([platform, hash]) => ensure(platform, hash)));
}
