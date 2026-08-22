"use client";

import { Coordinator, wasmConnector } from "@kanzo-tech/ui/analytics";

/**
 * One DuckDB-WASM coordinator for the whole workspace, and a place for each view to register the
 * relations it needs.
 *
 * One, not two: vgplot resolves marks through a single *active* coordinator, so a second instance
 * on the same document would have the graph and the charts querying different databases while
 * `MosaicProvider` handed vgplot whichever mounted last. The two views also swap rather than
 * coexist — a chart in a hidden box measures zero width and never recovers — so this cache is what
 * keeps toggling between Graph and Analysis from re-booting WASM and reloading every relation.
 */

/**
 * The slice of DuckDB-WASM's binding surface this app actually uses.
 *
 * The buffer pair is what makes a Parquet round trip possible entirely in the browser: `COPY … TO
 * 'x.parquet'` writes into DuckDB's virtual filesystem, `copyFileToBuffer` lifts it out, and
 * `registerFileBuffer` puts it back under a name `read_parquet()` can open. No server, no extra
 * dependency, and it is the same shape keasy's real corpus arrives in.
 */
interface DuckDBHandle {
  registerFileText(name: string, text: string): Promise<void>;
  registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
  copyFileToBuffer(name: string): Promise<Uint8Array>;
}

export interface Boot {
  coordinator: Coordinator;
  db: DuckDBHandle;
}

let booted: Promise<Boot> | null = null;

export function boot(): Promise<Boot> {
  booted ??= (async () => {
    const connector = wasmConnector() as { getDuckDB(): Promise<DuckDBHandle> };
    const coordinator = new Coordinator(connector as never);
    const db = await connector.getDuckDB();
    return { coordinator, db };
  })();
  return booted;
}

const relations = new Map<string, Promise<unknown>>();

/**
 * Register a named set of relations exactly once, and hand back whatever the load produced.
 * Concurrent callers await the same load rather than racing two `CREATE TABLE`s.
 *
 * The load returns rather than resolving to nothing, because registering a relation and knowing
 * what it is called are the same act when the names are derived: opening a corpus hands back its
 * views and the spec written over them, and a caller that only got the coordinator back would have
 * to spell those names itself.
 */
export function ensure<T>(key: string, load: (boot: Boot) => Promise<T>): Promise<T> {
  const existing = relations.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = boot().then((ctx) => load(ctx));
  relations.set(key, pending);
  return pending;
}
