#!/usr/bin/env node
/**
 * Puts the DuckDB extensions `engine()` loads beside this package, so they come from the host's own
 * origin rather than from extensions.duckdb.org at runtime: `parquet`, the reader of a corpus and of
 * `loadParquet`; and `httpfs`, the reader of `s3://` and of a URL named in SQL. DuckDB-WASM builds
 * neither in: its only statically linked extension is `core_functions`.
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
 * `extensions` is each one's sha256 per platform.
 */
export const PIN = {
  duckdbWasm: "1.33.1-dev57.0",
  duckdb: "v1.5.4",
  extensions: {
    parquet: {
      wasm_mvp: "b64c255a7f7d06cc234535b2f0ecab345fda91bffff5509d3179004bc13aa19a",
      wasm_eh: "4845705bbd69fc9ad52878d96a505c73cae4a6c509822079cc2413e5eb437f95",
    },
    httpfs: {
      wasm_mvp: "ef756ec28db02feafd02ab036aa01f4fc11ac197bd295bf0f20e4e23d48c54c3",
      wasm_eh: "576721756dd01b86cdfdcf1303ecdcc9776929fd21c3e3b86fdd43a2259aec5b",
    },
  },
};

const REPOSITORY = "https://extensions.duckdb.org";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extensions");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function ensure(extension, platform, expected) {
  const file = join(root, platform, `${extension}.duckdb_extension.wasm`);
  const held = await readFile(file).catch(() => null);
  if (held && sha256(held) === expected) return;

  const url = `${REPOSITORY}/${PIN.duckdb}/${platform}/${extension}.duckdb_extension.wasm`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${url} is not the pinned build: sha256 ${actual}, pinned ${expected}`);
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  console.log(`extensions: ${PIN.duckdb}/${platform}/${extension} (${(bytes.byteLength / 1024).toFixed(0)} kB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await Promise.all(
    Object.entries(PIN.extensions).flatMap(([extension, builds]) =>
      Object.entries(builds).map(([platform, hash]) => ensure(extension, platform, hash)),
    ),
  );
}
