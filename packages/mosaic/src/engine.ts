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
 * It satisfies fossil's `Engine` structurally; this package does not depend on fossil, and does not
 * name `@duckdb/duckdb-wasm` either — the connector hands the database over untyped.
 */
export interface Engine {
  readonly coordinator: Coordinator;
  /** Rows as objects, uncached: a read after a `lend` must see the new lease. */
  query(sql: string): Promise<Record<string, unknown>[]>;
  /** name → URL. The same URL is a no-op; a different one replaces the lease. */
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

/** A buffer is not a URL, so a held name never compares equal to a lent one. */
const HELD = Symbol("held");

async function boot(): Promise<Engine> {
  const connector = wasmConnector();
  const coordinator = new Coordinator(connector);
  const db = (await connector.getDuckDB()) as unknown as Registry;
  // Lent files are read lazily by range; caching their metadata is what keeps a pan from re-probing.
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
