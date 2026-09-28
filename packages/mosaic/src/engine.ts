import { Coordinator, wasmConnector } from "@uwdata/mosaic-core";

/**
 * The page's one database: a DuckDB-WASM instance, the Mosaic `Coordinator` over it, and the file
 * registry, owned in one place.
 *
 * **One per document, because vgplot has one.** `MosaicProvider` registers its coordinator as
 * vgplot's process-wide active one, so a second coordinator on the page is a second database the
 * last-mounted chart wins. Every host wrote the same memoised boot to avoid it — three in these
 * docs, one in keasy, one in fossil's playground — and none of them owned the registry beside it.
 *
 * **The registry is the part that was missing.** DuckDB-WASM refuses to register a name a second
 * time under a different URL (`File already registered`), and answers only when the URL is
 * identical. A signed URL is different on every signing, so the second visit to the same data threw.
 * `lend` is the one place that knows what is behind a name: the same URL is a no-op, a new one drops
 * the old lease and registers the new. That indirection is also why the registry is kept rather than
 * reading `https://…` directly — a view names a stable file, and only the lease behind it rotates.
 *
 * **It reads `s3://` from boot.** DuckDB's `httpfs` is loaded before the engine is handed out, so a
 * reader that holds a credential scoped to a prefix makes it readable with one statement through
 * `query` — `CREATE OR REPLACE SECRET … (TYPE s3, …, SCOPE 's3://bucket/prefix/')` — and names the
 * objects by their own URLs. There is no method for it: the secret is SQL, and `query` is the door.
 *
 * It satisfies fossil's `Engine` structurally; this package does not depend on fossil, and does not
 * name `@duckdb/duckdb-wasm` either — the connector hands the database over untyped.
 */
export interface Engine {
  readonly coordinator: Coordinator;
  /** Rows as objects, uncached: a read after a `lend` must see the new lease. */
  query(sql: string): Promise<Record<string, unknown>[]>;
  /**
   * name → URL. The same URL is a no-op; a different one replaces the lease. The name has no scheme:
   * with `httpfs` loaded, `https://…` or `s3://…` in SQL is read by `httpfs` before the registry is
   * asked, so a lease under such a name is never consulted.
   */
  lend(files: Record<string, string>): Promise<void>;
  /** Registers a copy of `bytes` under `name`, replacing whatever was there. */
  hold(name: string, bytes: Uint8Array): Promise<void>;
  /** Unregisters the names. A name the engine does not hold is not an error. */
  drop(names: readonly string[]): Promise<void>;
}

/** The slice of DuckDB-WASM's `AsyncDuckDB` the registry uses. */
interface Registry {
  registerFileURL(name: string, url: string, protocol: number, directIO: boolean): Promise<void>;
  registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
  dropFile(name: string): Promise<void>;
}

/** `DuckDBDataProtocol.HTTP` — a numeric enum, spelled here so the type never has to be imported. */
const HTTP = 4;

/**
 * DuckDB-WASM >= 1.30 downloads a lent file whole unless full reads are refused outright: its range
 * probe reads `Content-Length` where it meant `Content-Range` and falls through to a whole-file GET
 * (duckdb/duckdb-wasm#2228). Refused, it reaches its `HEAD` fallback and reads by range. Measured on
 * a 160 MiB Parquet file, a count, a point lookup and a max: 1.3 MiB in eight ranges with this, the
 * whole file in one GET without it.
 *
 * It governs `lend` alone. `s3://` and a URL named in SQL go through `httpfs`, which reads by range
 * either way (the same queries: 1.8 MiB in four requests, flag or not). What still lends is a store
 * DuckDB-WASM has no extension for — Azure, reached by a SAS URL — and that is a URL which answers
 * `HEAD`, which the fallback needs.
 */
const RANGE_READS = { filesystem: { forceFullHTTPReads: false } };

/**
 * `httpfs`, from beside this package rather than from extensions.duckdb.org: `scripts/extensions.mjs`
 * fetches the pinned builds into `extensions/` and the tarball carries them, and the host's bundler
 * emits each one as an asset. It is `LOAD`ed by URL, which DuckDB accepts under a hashed file name as
 * long as the name still starts `httpfs.` — the entrypoint is looked up by that prefix.
 *
 * One per bundle `wasmConnector` can select, keyed on what `PRAGMA platform` answers.
 */
function httpfs(platform: string): URL {
  switch (platform) {
    case "wasm_mvp":
      return new URL("../extensions/wasm_mvp/httpfs.duckdb_extension.wasm", import.meta.url);
    case "wasm_eh":
      return new URL("../extensions/wasm_eh/httpfs.duckdb_extension.wasm", import.meta.url);
    default:
      throw new Error(`engine: no httpfs is shipped for the ${platform} bundle`);
  }
}

/** A buffer is not a URL, so a held name never compares equal to a lent one. */
const HELD = Symbol("held");

async function boot(): Promise<Engine> {
  const connector = wasmConnector({ config: RANGE_READS });
  const coordinator = new Coordinator(connector);
  const db = (await connector.getDuckDB()) as unknown as Registry;
  const [{ platform }] = (await coordinator.query("PRAGMA platform", {
    type: "json",
    cache: false,
  })) as [{ platform: string }];
  // Against the page: webpack's asset URL is root-relative, and DuckDB fetches it from a `blob:` worker.
  await coordinator.exec(`LOAD '${new URL(httpfs(platform).href, location.href).href}'`);
  // Files are read lazily by range; caching their metadata is what keeps a pan from re-probing.
  await coordinator.exec("SET enable_http_metadata_cache = true");

  const behind = new Map<string, string | typeof HELD>();

  // Registry changes run one at a time: two `lend`s of one name racing each other would each see the
  // old entry, and the second register would be refused.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = (step: () => Promise<void>): Promise<void> => {
    const run = tail.then(step);
    tail = run.catch(() => {});
    return run;
  };

  const release = async (name: string) => {
    if (!behind.has(name)) return;
    await db.dropFile(name);
    behind.delete(name);
  };

  return {
    coordinator,
    query: (sql) =>
      coordinator.query(sql, { type: "json", cache: false }) as Promise<Record<string, unknown>[]>,
    lend: (files) =>
      serial(async () => {
        for (const [name, url] of Object.entries(files)) {
          if (behind.get(name) === url) continue;
          await release(name);
          await db.registerFileURL(name, url, HTTP, false);
          behind.set(name, url);
        }
      }),
    hold: (name, bytes) =>
      serial(async () => {
        await release(name);
        // A copy, because DuckDB-WASM transfers the buffer to its worker and detaches the caller's.
        await db.registerFileBuffer(name, bytes.slice());
        behind.set(name, HELD);
      }),
    drop: (names) =>
      serial(async () => {
        for (const name of names) await release(name);
      }),
  };
}

/**
 * Keyed on the document's global rather than on this module, so two copies of the package in one
 * bundle still share one database — which is the invariant, not the module identity.
 */
const KEY = Symbol.for("@kanzo-tech/mosaic/engine");

/** The page's one engine, booted on first ask. */
export function engine(): Promise<Engine> {
  const scope = globalThis as { [KEY]?: Promise<Engine> };
  scope[KEY] ??= boot();
  return scope[KEY];
}
