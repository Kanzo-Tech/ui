import { AsyncDuckDB, DuckDBDataProtocol, VoidLogger, selectBundle } from "@duckdb/duckdb-wasm";
import { Problem, isProblem, type Table } from "@kanzo-tech/kernel";
import { Coordinator, decodeIPC, type Connector } from "@uwdata/mosaic-core";
import { isSecret, redact } from "./redact.js";

/**
 * The page's one database: a DuckDB-WASM instance, the Mosaic `Coordinator` over it — private, see
 * {@link internalCoordinatorOf} — and the file registry, owned in one place.
 *
 * **One per document, because vgplot has one.** `MosaicProvider` registers its coordinator as
 * vgplot's process-wide active one, so a second coordinator on the page is a second database the
 * last-mounted chart wins. Every host wrote the same memoised boot to avoid it — three in these
 * docs, one in a host app, one in fossil's playground — and none of them owned the registry beside
 * it.
 *
 * **The registry is the part that was missing.** DuckDB-WASM refuses to register a name a second
 * time under a different URL (`File already registered`), and answers only when the URL is
 * identical. A signed URL is different on every signing, so the second visit to the same data threw.
 * `registerFiles` is the one place that knows what is behind a name: the same URL is a no-op, a new one drops
 * the old lease and registers the new. That indirection is also why the registry is kept rather than
 * reading `https://…` directly — a view names a stable file, and only the lease behind it rotates.
 *
 * **It reads `s3://` from boot.** DuckDB's `httpfs` is loaded before the engine is handed out, so a
 * reader that holds a credential scoped to a prefix makes it readable with one statement through
 * `query` — `CREATE OR REPLACE SECRET … (TYPE s3, …, SCOPE 's3://bucket/prefix/')` — and names the
 * objects by their own URLs. There is no method for it: the secret is SQL, and `query` is the door.
 *
 * **It reads Parquet and JSON from boot.** `parquet` is loaded before `httpfs`, since every graph is
 * Parquet and the boot sets its footer cache; `json` after them, for `read_json_auto` — a JSON source a
 * profile or a query names, and `loadJSON`. DuckDB-WASM builds in none of the three: its one statically
 * linked extension is `core_functions`.
 *
 * **Nothing is fetched from a CDN.** DuckDB-WASM's worker and module and its extensions are named
 * with `new URL(…, import.meta.url)`, so the host's bundler emits them as assets and the page
 * loads all of it from its own origin: `script-src 'self'`, `worker-src 'self'` and
 * `connect-src 'self' <storage>`. Autoloading is off, because it is the one path that would not be:
 * DuckDB answers a function from an extension nobody loaded by fetching that extension from
 * extensions.duckdb.org, which a page under that policy refuses. Off, the statement fails with
 * DuckDB's own error naming the extension, and the fix is a line in `scripts/extensions.mjs`.
 *
 * It satisfies fossil's `Engine` structurally; this package does not depend on fossil. Its answer is
 * the kernel's `Table`, the one every reader reads.
 *
 * **It is `@kanzo-tech/mosaic/engine`, not the root**, so a page that only draws from a host-supplied
 * `Queryable` imports no DuckDB (`/docs/design/engine`, *Three packages, one direction*).
 */
export interface Engine {
  /**
   * One statement, answered in columns as DuckDB-WASM produced them — nothing turns them into
   * objects.
   *
   * **It is the coordinator's connection**, for the charts, the graph and fossil's own statements —
   * the secret, the attach, the views. A second connection beside it made every read pay twice and
   * serialise against itself. The two doors take turns on it, one statement at a time, in the order
   * they asked.
   *
   * **It is not the coordinator's queue.** The statement goes to the connection directly and is
   * decoded as the coordinator decodes, because the queue batches every Arrow request behind
   * `requestAnimationFrame` — the consolidation the charts want — and a hidden tab never fires one:
   * fossil's attach waited forever there with no error, and a host's DDL sat behind chart batches.
   * Nothing is cached: these are statements with effects. A failure is `Problem` `engine/failed`,
   * DuckDB's message and the statement with every literal replaced by `?`.
   *
   * **An abort stops the statement.** While it runs, the signal interrupts it in DuckDB and the call
   * rejects with `signal.reason`; the connection answers the next statement as if it had never been
   * sent. While it waits its turn, it is never sent. Once it has finished, an abort is ignored and the
   * call resolves — there is nothing left to interrupt, as ADBC's `AdbcStatementCancel` finds nothing
   * to cancel. So a host that stops a read cannot rely on its side effects having happened or not: a
   * `DETACH` aborted mid-way may or may not have run.
   *
   * So a statement here does not wait for what the queue still holds. One that takes away what the
   * coordinator's clients read — a `DETACH`, a dropped view — runs only once nothing reads it: a
   * client that disconnects keeps its queued queries (mosaic-core's `disconnect` cancels nothing),
   * and they run after it. Release such a thing as a cache does, when it is collected some time
   * after its last reader went, never as its readers unmount.
   */
  query(sql: string, options: { readonly signal: AbortSignal }): Promise<Table>;
  /**
   * name → URL. The same URL is a no-op; a different one replaces the lease. The name has no scheme:
   * with `httpfs` loaded, `https://…` or `s3://…` in SQL is read by `httpfs` before the registry is
   * asked, so a lease under such a name is never consulted.
   */
  registerFiles(files: Record<string, string>): Promise<void>;
  /** Registers a copy of `bytes` under `name`, replacing whatever was there. */
  registerFileBuffer(name: string, bytes: Uint8Array): Promise<void>;
  /** Unregisters the names. A name the engine does not hold is not an error. */
  dropFiles(names: readonly string[]): Promise<void>;
}

/**
 * DuckDB-WASM >= 1.30 downloads a lent file whole unless full reads are refused outright: its range
 * probe reads `Content-Length` where it meant `Content-Range` and falls through to a whole-file GET
 * (duckdb/duckdb-wasm#2228). Refused, it reaches its `HEAD` fallback and reads by range. Measured on
 * a 160 MiB Parquet file, a count, a point lookup and a max: 1.3 MiB in eight ranges with this, the
 * whole file in one GET without it.
 *
 * It governs `registerFiles` alone. `s3://` and a URL named in SQL go through `httpfs`, which reads by range
 * either way (the same queries: 1.8 MiB in four requests, flag or not). What still lends is a store
 * DuckDB-WASM has no extension for — Azure, reached by a SAS URL — and that is a URL which answers
 * `HEAD`, which the fallback needs.
 */
const RANGE_READS = { filesystem: { forceFullHTTPReads: false } };

/** Absolute, against the page: webpack under Next hands back a root-relative URL. */
const served = (asset: URL) => new URL(asset.href, location.href).href;

/**
 * One build per bundle `selectBundle` chooses between, each with the extensions built for it. The
 * module is `@duckdb/duckdb-wasm`'s own, the release this package pins, named by specifier as
 * DuckDB-WASM documents for webpack: the bundler resolves it to that dependency. The worker is that
 * release's too, copied into `workers/` by `scripts/workers.mjs` without the statement that prints
 * every HTTP header it sends — an `s3://` read's credential among them. The extensions are not on
 * npm, so `scripts/extensions.mjs` fetches the pinned builds into `extensions/` and the tarball
 * carries them. Each is `LOAD`ed by URL, which DuckDB accepts under a hashed file name as long as the
 * name still starts with the extension's — `parquet.`, `httpfs.`, `json.` — the entrypoint is looked up by that
 * prefix.
 */
function builds() {
  return {
    mvp: {
      mainModule: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", import.meta.url)),
      mainWorker: served(new URL("../workers/duckdb-browser-mvp.worker.js", import.meta.url)),
      extensions: [
        served(new URL("../extensions/wasm_mvp/parquet.duckdb_extension.wasm", import.meta.url)),
        served(new URL("../extensions/wasm_mvp/httpfs.duckdb_extension.wasm", import.meta.url)),
        served(new URL("../extensions/wasm_mvp/json.duckdb_extension.wasm", import.meta.url)),
      ],
    },
    eh: {
      mainModule: served(new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url)),
      mainWorker: served(new URL("../workers/duckdb-browser-eh.worker.js", import.meta.url)),
      extensions: [
        served(new URL("../extensions/wasm_eh/parquet.duckdb_extension.wasm", import.meta.url)),
        served(new URL("../extensions/wasm_eh/httpfs.duckdb_extension.wasm", import.meta.url)),
        served(new URL("../extensions/wasm_eh/json.duckdb_extension.wasm", import.meta.url)),
      ],
    },
  };
}

/** A buffer is not a URL, so a held name never compares equal to a lent one. */
const HELD = Symbol("held");

/**
 * The slowest honest boot: the worker, ~30 MB of module and its extensions fetched over a slow link, then
 * instantiated. The figure and its argument are fossil's `/docs/design/failure`, G1.
 */
const BOOT_DEADLINE = 60_000;

/**
 * DuckDB-WASM 1.33's `onError` logs a worker's `error` event and clears its pending requests without
 * settling them, so a worker that fails to load leaves `instantiate` waiting forever, and one that dies
 * later leaves every request it held waiting forever. This rejects them first: as `engine/unavailable`
 * until `lost` is set, which is when the boot is over, and as `engine/lost` from then on, for the
 * worker's whole life. The constructor binds `this.onError`, which is why an override reaches the
 * listener; `messageerror` is routed to it as well, since a reply that cannot be read is a worker
 * that cannot be heard.
 */
class Duck extends AsyncDuckDB {
  /** Set when the boot is over: called once, with the failure every pending request was rejected with. */
  lost?: (failure: Problem) => void;

  protected override attach(worker: Worker): void {
    super.attach(worker);
    worker.addEventListener("messageerror", this._onErrorHandler as EventListener);
  }

  protected override onError(event: ErrorEvent): void {
    const message = event.message || (this.lost ? "it stopped answering" : "it did not load");
    const failure = this.lost
      ? new Problem(
          "engine/lost",
          `the DuckDB worker died: ${message}`,
          { reason: /memory|oom/i.test(message) ? "memory" : "worker" },
          { cause: event.error },
        )
      : new Problem("engine/unavailable", `the DuckDB worker failed: ${message}`, {}, { cause: event.error });
    for (const task of this._pendingRequests.values()) task.promiseRejecter(failure);
    super.onError(event);
    this.lost?.(failure);
  }
}

/**
 * What DuckDB refusing `sql` is to a caller: `engine/failed`, whose `message` and `data.statement` are
 * DuckDB's message and the statement with every literal replaced by `?` (see {@link redact}); a
 * `CREATE SECRET` is not echoed at all. The original text is on no field, not on `cause`, and not on
 * the coordinator's logger, so what a host's `onFailure` hands to its telemetry carries no user's
 * value and no credential. A loss passes as it is.
 */
function failed(sql: string, error: unknown): Problem {
  if (error instanceof Problem) return error;
  if (isSecret(sql)) return new Problem("engine/failed", "CREATE SECRET failed");
  return new Problem("engine/failed", redact(error instanceof Error ? error.message : String(error)), {
    statement: redact(sql),
  });
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

async function boot(forget: () => void): Promise<Engine> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), BOOT_DEADLINE);
  let duckdb: Duck | undefined;
  try {
    return await abandon(
      start(forget, (made) => (duckdb = made)),
      deadline.signal,
    );
  } catch (error) {
    void duckdb?.terminate();
    if (isProblem(error) && error.code !== "engine/failed") throw error;
    const after = deadline.signal.aborted ? { after: BOOT_DEADLINE } : {};
    const message = deadline.signal.aborted
      ? `DuckDB did not boot within ${BOOT_DEADLINE / 1000} s`
      : "DuckDB did not boot";
    throw new Problem("engine/unavailable", message, after, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function start(forget: () => void, made: (duckdb: Duck) => void): Promise<Engine> {
  const all = builds();
  const { mainModule } = await selectBundle(all);
  const build = mainModule === all.eh.mainModule ? all.eh : all.mvp;
  const duckdb = new Duck(new VoidLogger(), new Worker(build.mainWorker));
  made(duckdb);
  await duckdb.instantiate(build.mainModule);

  // The connection is ours rather than mosaic-core's connector's: DuckDB-WASM's pending-query protocol is
  // several messages, so a second statement sent in between would end the one a signal can interrupt.
  await duckdb.open(RANGE_READS);
  const connection = await duckdb.connect();
  const id = connection.useUnsafe((_, conn) => conn);

  // Set when the worker died; every step that has not started then refuses with it instead of waiting
  // on a worker that will not answer, and the request that was in flight was rejected with it already.
  let lost: Problem | undefined;
  const inOrder = () => {
    let tail: Promise<unknown> = Promise.resolve();
    return <T>(step: () => Promise<T>): Promise<T> => {
      const run = tail.then(() => {
        if (lost) throw lost;
        return step();
      });
      tail = run.catch(() => {}); // the caller holds `run`; the chain only orders the next step
      return run;
    };
  };
  const lane = inOrder();

  /**
   * **The one way a statement runs**, for the engine's own door and the coordinator's alike: in turn on
   * the one connection, interrupted when `signal` aborts, refused as `engine/failed` or `engine/lost`.
   * It is `startPendingQuery`, `pollPendingQuery` and `fetchQueryResults` on the bindings, which are
   * what `AsyncDuckDBConnection.send()` is made of, and `cancelPendingQuery`, which is `cancelSent()`;
   * the bytes are Arrow IPC, which the caller decodes with flechette. `send()` itself is not used: it
   * reads the result with apache-arrow, a different `Table` class, and measured in Node 22 on
   * DuckDB-WASM 1.33.1-dev57.0 (medians of 5-300 runs) it cost +1.4 ms on a trivial statement and +25% to
   * +95% at two million rows, where this path was within -13% to +11% of the one-message `runQuery`
   * it replaced (200,000 rows ×4 columns: -5% to +15%; a trivial statement +0.2 to +0.4 ms).
   */
  const execute = (sql: string, signal: AbortSignal): Promise<Uint8Array> => {
    if (signal.aborted) return Promise.reject(signal.reason as Error);
    let running = false;
    const answered = lane(async () => {
      if (signal.aborted) throw signal.reason; // aborted while it waited its turn: never sent
      running = true;
      const interrupt = () => void duckdb.cancelPendingQuery(id).catch(() => {}); // a cancel that fails is a dead worker, which rejects the statement itself
      signal.addEventListener("abort", interrupt, { once: true });
      try {
        let header = await duckdb.startPendingQuery(id, sql, false);
        while (header == null) header = await duckdb.pollPendingQuery(id);
        const parts = [header];
        for (;;) {
          let part = await duckdb.fetchQueryResults(id);
          while (part == null) part = await duckdb.fetchQueryResults(id);
          if (part.length === 0) break;
          parts.push(part);
        }
        const bytes = new Uint8Array(parts.reduce((total, one) => total + one.length, 0));
        let at = 0;
        for (const one of parts) {
          bytes.set(one, at);
          at += one.length;
        }
        return bytes;
      } catch (error) {
        // A statement that failed or was interrupted on the signal's account is the signal's reason.
        throw signal.aborted ? signal.reason : failed(sql, error);
      } finally {
        signal.removeEventListener("abort", interrupt);
      }
    });
    return new Promise<Uint8Array>((resolve, reject) => {
      // Waiting, an abort ends the wait at once; running, the statement is interrupted and rejects itself.
      const leave = () => running || reject(signal.reason);
      signal.addEventListener("abort", leave, { once: true });
      answered.then(resolve, reject).finally(() => signal.removeEventListener("abort", leave));
    });
  };

  // The coordinator's statements carry no signal; it decodes the bytes itself.
  const unsignalled = new AbortController().signal;
  const connector = {
    query: (request: { readonly type: string; readonly sql: string }) =>
      execute(request.sql, unsignalled).then((bytes) => (request.type === "exec" ? undefined : bytes)),
  } as Connector;
  // No logger: its default is `console`, which is handed the failure with the statement in its message.
  const coordinator = new Coordinator(connector, { logger: null });
  await coordinator.exec("SET autoload_known_extensions = false");
  for (const extension of build.extensions) await coordinator.exec(`LOAD '${extension}'`);
  // Files are read lazily by range; caching their metadata is what keeps a pan from re-probing, and
  // caching Parquet footers is what keeps every tile read from re-reading one that grows with the
  // graph — 2.2× on a window's reads, measured in fossil on 2026-09-30.
  await coordinator.exec("SET enable_http_metadata_cache = true");
  await coordinator.exec("SET parquet_metadata_cache = true");
  await coordinator.exec(`SET memory_limit = '${memoryLimit()}MiB'`);

  const behind = new Map<string, string | typeof HELD>();

  // Registry changes run one at a time: two `registerFiles` calls on one name racing each other would each see the
  // old entry, and the second register would be refused.
  const serial = inOrder();

  const release = async (name: string) => {
    if (!behind.has(name)) return;
    await duckdb.dropFile(name);
    behind.delete(name);
  };

  // `decodeIPC`'s defaults are the coordinator's own: this engine sets no `ipc` options on it.
  const query = (sql: string, { signal }: { readonly signal: AbortSignal }) =>
    execute(sql, signal).then((bytes) => decodeIPC(bytes) as unknown as Table);

  duckdb.lost = (failure) => {
    lost = failure;
    forget();
    void duckdb.terminate();
  };

  const door: Engine = {
    query,
    registerFiles: (files) =>
      serial(async () => {
        for (const [name, url] of Object.entries(files)) {
          if (behind.get(name) === url) continue;
          await release(name);
          await duckdb.registerFileURL(name, url, DuckDBDataProtocol.HTTP, false);
          behind.set(name, url);
        }
      }),
    registerFileBuffer: (name, bytes) =>
      serial(async () => {
        await release(name);
        // A copy, because DuckDB-WASM transfers the buffer to its worker and detaches the caller's.
        await duckdb.registerFileBuffer(name, bytes.slice());
        behind.set(name, HELD);
      }),
    dropFiles: (names) =>
      serial(async () => {
        for (const name of names) await release(name);
      }),
  };
  return internalEngineOver(door, coordinator);
}

/**
 * **The coordinator is the engine's, and no host holds one** (`/docs/design/engine`, *One door*). It
 * is on the engine under a registered symbol rather than in a `WeakMap` for the reason `engine()`'s
 * slot is on `globalThis`: two copies of this package in one bundle must still agree on it, and a
 * `WeakMap` is one copy's. The symbol is on no type, so a host reading `engine.coordinator` finds
 * nothing; these two functions are the library's way in — `MosaicProvider` and the graph's client
 * reach the coordinator through the first, `engine()` and a test double attach it with the second.
 * They are exported because the library's other packages need them, and named `internal` because
 * nothing else should.
 */
const COORDINATOR = Symbol.for("@kanzo-tech/mosaic/coordinator");

/** Not API: the Mosaic coordinator inside `engine`, for the library's own Mosaic clients. */
export function internalCoordinatorOf(engine: Engine): Coordinator {
  const coordinator = (engine as { [COORDINATOR]?: Coordinator })[COORDINATOR];
  if (!coordinator) throw new TypeError("not an engine: it holds no coordinator — build one with engine()");
  return coordinator;
}

/** Not API: `engine` holding `coordinator`, whose connector must be the engine's own connection. */
export function internalEngineOver<E extends Engine>(engine: E, coordinator: Coordinator): E {
  Object.defineProperty(engine, COORDINATOR, { value: coordinator });
  return engine;
}

/**
 * DuckDB's memory limit, in MiB, set below WebAssembly's 4 GiB per-tab ceiling so that DuckDB spills
 * or refuses with its own out-of-memory error while the worker is still alive, instead of the tab
 * taking the worker. **Neither figure is measured.** The ceiling is DuckDB-WASM's documented one; the
 * 3 GiB cap and the half of the device's memory under it are a margin chosen by argument. The figure
 * `/docs/design/engine` wants is the peak heap of the graph benchmark at 200,000 vertices, which has
 * not been run. `navigator.deviceMemory` is Chromium's, rounded to a power of two and capped at 8
 * (GiB); where it is absent the cap alone stands.
 */
function memoryLimit(): number {
  const gib = (globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory;
  return Math.max(512, Math.min(3072, typeof gib === "number" && gib > 0 ? (gib * 1024) / 2 : 3072));
}

/**
 * Keyed on the document's global rather than on this module, so two copies of the package in one
 * bundle still share one database — which is the invariant, not the module identity.
 */
const KEY = Symbol.for("@kanzo-tech/mosaic/engine");

/**
 * The page's one engine, booted on first ask. A boot that fails is forgotten, so the next ask boots
 * again rather than inheriting the failure for the life of the page; so is an engine whose worker
 * died, which rejected what it held with `engine/lost`. The next ask is then a new object with an
 * empty database: whatever a host attached, registered or mounted lived in the dead worker. A
 * refcount keyed on the engine object — a `WeakMap` — starts again at zero for it, which is what makes
 * "ask again, attach again" correct without anything resurrecting state. A `signal` ends this caller's
 * wait, not the boot, which other callers may be waiting on.
 */
export function engine(options: { readonly signal?: AbortSignal } = {}): Promise<Engine> {
  const scope = globalThis as { [KEY]?: Promise<Engine> };
  let booting = scope[KEY];
  if (!booting) {
    const forget = () => {
      if (scope[KEY] === started) delete scope[KEY];
    };
    const started = boot(forget);
    scope[KEY] = booting = started;
    started.catch(forget); // the callers hold `started`; this only forgets it
  }
  return options.signal ? abandon(booting, options.signal) : booting;
}
