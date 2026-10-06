// The test's origin for DuckDB's `json` extension: `@kanzo-tech/mosaic`'s own pinned builds, served
// over loopback, so the test database loads the file the page loads rather than letting DuckDB fetch
// one from extensions.duckdb.org (`../testing/duckdb.ts`).
//
// **Over HTTP, because that is the only way DuckDB-WASM's Node build loads one.** A path or a
// `file://` URL never answers: the build fetches the extension on a helper thread and blocks the
// caller until it replies, and that fetch takes neither. The same block is why the server lives here,
// in Vitest's own process, and not in the test that waits on it.
//
// **The URL carries the file's hash.** The Node build keeps what it fetched under
// `~/.duckdb/extensions/`, keyed by the URL's last three directories, and reads that copy before it
// fetches. `/extensions/<sha256>/<platform>/` makes the key change exactly when the build does, and
// keeps the port, which changes every run, out of it.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { TestProject } from "vitest/node";

const PLATFORMS = ["wasm_mvp", "wasm_eh"] as const;
const FILE = "json.duckdb_extension.wasm";

declare module "vitest" {
  export interface ProvidedContext {
    /** The `json` build for each DuckDB-WASM bundle, as a URL `LOAD` accepts. */
    json: Record<(typeof PLATFORMS)[number], string>;
  }
}

export default async function serve(project: TestProject) {
  const require = createRequire(import.meta.url);
  const root = join(dirname(require.resolve("@kanzo-tech/mosaic/package.json")), "extensions");
  const served = new Map<string, Buffer>();
  const paths = {} as Record<(typeof PLATFORMS)[number], string>;
  for (const platform of PLATFORMS) {
    const bytes = readFileSync(join(root, platform, FILE));
    const path = `/extensions/${createHash("sha256").update(bytes).digest("hex")}/${platform}/${FILE}`;
    served.set(path, bytes);
    paths[platform] = path;
  }

  const server = createServer((request, response) => {
    const bytes = served.get(request.url ?? "");
    // jsdom's XMLHttpRequest is a page on another origin, so it asks.
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (!bytes) return void response.writeHead(404).end();
    response.writeHead(200, { "Content-Type": "application/wasm" }).end(bytes);
  });
  await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  project.provide("json", {
    wasm_mvp: origin + paths.wasm_mvp,
    wasm_eh: origin + paths.wasm_eh,
  });
  return () => new Promise<void>((closed) => server.close(() => closed()));
}
