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

interface DuckDBHandle {
  registerFileText(name: string, text: string): Promise<void>;
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

const relations = new Map<string, Promise<Coordinator>>();

/**
 * Register a named set of relations exactly once, and hand back the shared coordinator.
 * Concurrent callers await the same load rather than racing two `CREATE TABLE`s.
 */
export function ensure(key: string, load: (boot: Boot) => Promise<void>): Promise<Coordinator> {
  const existing = relations.get(key);
  if (existing) return existing;
  const pending = boot().then(async (ctx) => {
    await load(ctx);
    return ctx.coordinator;
  });
  relations.set(key, pending);
  return pending;
}
