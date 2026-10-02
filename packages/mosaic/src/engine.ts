import { AsyncDuckDB, DuckDBDataProtocol, VoidLogger, selectBundle } from "@duckdb/duckdb-wasm";
import { Coordinator, decodeIPC, wasmConnector } from "@uwdata/mosaic-core";

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
 * **Nothing is fetched from a CDN.** DuckDB-WASM's worker and module and its `httpfs` are named with
 * `new URL(…, import.meta.url)`, so the host's bundler emits them as assets and the page loads all of
 * it from its own origin: `script-src 'self'`, `worker-src 'self'` and `connect-src 'self' <storage>`.
 *
 * It satisfies fossil's `Engine` structurally; this package does not depend on fossil.
 */
export interface Engine {
  readonly coordinator: Coordinator;
  /**
   * One statement, answered in columns as DuckDB-WASM produced them — nothing turns them into
   * objects.
   *
   * **It is the coordinator's connection**, for the charts, the graph and fossil's own statements —
   * the secret, the attach, the views. A second connection beside it made every read pay twice and
   * serialise against itself.
   *
   * **It is not the coordinator's queue.** The statement goes to the connector directly and is
   * decoded as the coordinator decodes, because the queue batches every Arrow request behind
   * `requestAnimationFrame` — the consolidation the charts want — and a hidden tab never fires one:
   * fossil's attach waited forever there with no error, and a host's DDL sat behind chart batches.
   * DuckDB-WASM still runs one statement at a time on the connection, and a caller awaits each, so a
   * host's sequence keeps its order. An abort rejects the caller's wait with `signal.reason` at
   * once; the statement, a short one, finishes. Nothing is cached: these are statements with
   * effects. A failure is DuckDB's own error, unwrapped.
   */
  query(sql: string, options: { readonly signal: AbortSignal }): Promise<Columns>;
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

/** An answer in columns: the part of apache-arrow's `Table` a reader reads. */
export interface Columns {
  readonly numRows: number;
  readonly schema: { readonly fields: readonly { readonly name: string }[] };
  getChild(name: string): Column | null;
}

/** One column of {@link Columns}: a typed array for a fixed-width type, where a null reads as zero. */
export interface Column {
  readonly length: number;
  get(index: number): unknown;
  toArray(): ArrayLike<unknown>;
}

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

/** Absolute, against the page: webpack under Next hands back a root-relative URL. */
const served = (asset: URL) => new URL(asset.href, location.href).href;

/**
 * One build per bundle `selectBundle` chooses between, each with the `httpfs` built for it. The worker
 * and module are `@duckdb/duckdb-wasm`'s own, the release this package pins, named by specifier as
 * DuckDB-WASM documents for webpack: the bundler resolves it to that dependency. `httpfs` is not on npm,
 * so `scripts/extensions.mjs` fetches the pinned builds into `extensions/` and the tarball carries
 * them. It is `LOAD`ed by URL, which DuckDB accepts under a hashed file name as long as the name still
 * starts `httpfs.` — the entrypoint is looked up by that prefix.
 */
function builds() {
  return {
    mvp: {
      mainModule: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", import.meta.url)),
      mainWorker: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js", import.meta.url)),
      httpfs: served(new URL("../extensions/wasm_mvp/httpfs.duckdb_extension.wasm", import.meta.url)),
    },
    eh: {
      mainModule: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url)),
      mainWorker: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js", import.meta.url)),
      httpfs: served(new URL("../extensions/wasm_eh/httpfs.duckdb_extension.wasm", import.meta.url)),
    },
  };
}

/** A buffer is not a URL, so a held name never compares equal to a lent one. */
const HELD = Symbol("held");

/**
 * The slowest honest boot: the worker, ~30 MB of module and `httpfs` fetched over a slow link, then
 * instantiated. The figure and its argument are fossil's `/docs/design/failure`, G1.
 */
const BOOT_DEADLINE = 60_000;

/** The one failure the engine names: it would not boot. `data.after` is set when the deadline fired. */
export class EngineError extends Error {
  override readonly name = "EngineError";
  constructor(
    readonly code: "engine/unavailable",
    message: string,
    readonly data: { readonly after?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * DuckDB-WASM 1.33's `onError` logs a worker's `error` event and clears its pending requests without
 * settling them, so a worker that fails to load leaves `instantiate` waiting forever. This rejects
 * them first. The constructor binds `this.onError`, which is why an override reaches the listener.
 */
class Duck extends AsyncDuckDB {
  protected override onError(event: ErrorEvent): void {
    const failure = new EngineError(
      "engine/unavailable",
      `the DuckDB worker failed: ${event.message || "it did not load"}`,
      {},
      { cause: event.error },
    );
    for (const task of this._pendingRequests.values()) task.promiseRejecter(failure);
    super.onError(event);
  }
}

/** `promise`, or `signal.reason` the moment the signal aborts — the work behind it is not stopped. */
function abandon<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function boot(): Promise<Engine> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), BOOT_DEADLINE);
  let duckdb: AsyncDuckDB | undefined;
  try {
    return await abandon(
      start((made) => (duckdb = made)),
      deadline.signal,
    );
  } catch (error) {
    void duckdb?.terminate();
    if (error instanceof EngineError) throw error;
    const after = deadline.signal.aborted ? { after: BOOT_DEADLINE } : {};
    const message = deadline.signal.aborted
      ? `DuckDB did not boot within ${BOOT_DEADLINE / 1000} s`
      : "DuckDB did not boot";
    throw new EngineError("engine/unavailable", message, after, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function start(made: (duckdb: AsyncDuckDB) => void): Promise<Engine> {
  const all = builds();
  const { mainModule } = await selectBundle(all);
  const build = mainModule === all.eh.mainModule ? all.eh : all.mvp;
  const duckdb = new Duck(new VoidLogger(), new Worker(build.mainWorker));
  made(duckdb);
  await duckdb.instantiate(build.mainModule);

  const connector = wasmConnector({ duckdb, config: RANGE_READS });
  const coordinator = new Coordinator(connector);
  await coordinator.exec(`LOAD '${build.httpfs}'`);
  // Files are read lazily by range; caching their metadata is what keeps a pan from re-probing, and
  // caching Parquet footers is what keeps every tile read from re-reading one that grows with the
  // corpus — 2.2× on a window's reads, measured in fossil on 2026-09-30.
  await coordinator.exec("SET enable_http_metadata_cache = true");
  await coordinator.exec("SET parquet_metadata_cache = true");

  const behind = new Map<string, string | typeof HELD>();

  // Registry changes run one at a time: two `lend`s of one name racing each other would each see the
  // old entry, and the second register would be refused.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = (step: () => Promise<void>): Promise<void> => {
    const run = tail.then(step);
    tail = run.catch(() => {}); // the caller holds `run`; the chain only orders the next step
    return run;
  };

  const release = async (name: string) => {
    if (!behind.has(name)) return;
    await duckdb.dropFile(name);
    behind.delete(name);
  };

  const query = (sql: string, { signal }: { readonly signal: AbortSignal }) => {
    if (signal.aborted) return Promise.reject(signal.reason as Error);
    // `decodeIPC`'s defaults are the coordinator's own: this engine sets no `ipc` options on it.
    return abandon(
      connector.query({ type: "arrow", sql }).then((bytes) => decodeIPC(bytes) as unknown as Columns),
      signal,
    );
  };

  return {
    coordinator,
    query,
    lend: (files) =>
      serial(async () => {
        for (const [name, url] of Object.entries(files)) {
          if (behind.get(name) === url) continue;
          await release(name);
          await duckdb.registerFileURL(name, url, DuckDBDataProtocol.HTTP, false);
          behind.set(name, url);
        }
      }),
    hold: (name, bytes) =>
      serial(async () => {
        await release(name);
        // A copy, because DuckDB-WASM transfers the buffer to its worker and detaches the caller's.
        await duckdb.registerFileBuffer(name, bytes.slice());
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

/**
 * The page's one engine, booted on first ask. A boot that fails is forgotten, so the next ask boots
 * again rather than inheriting the failure for the life of the page. A `signal` ends this caller's
 * wait, not the boot, which other callers may be waiting on.
 */
export function engine(options: { readonly signal?: AbortSignal } = {}): Promise<Engine> {
  const scope = globalThis as { [KEY]?: Promise<Engine> };
  let booting = scope[KEY];
  if (!booting) {
    const started = boot();
    scope[KEY] = booting = started;
    started.catch(() => {
      if (scope[KEY] === started) delete scope[KEY];
    }); // the callers hold `started`; this only forgets it
  }
  return options.signal ? abandon(booting, options.signal) : booting;
}
