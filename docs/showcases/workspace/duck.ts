"use client";

import { engine, type Engine } from "@kanzo-tech/ui/analytics";

/**
 * A place for each workspace view to register the relations it needs, once, in the page's one
 * engine.
 *
 * The engine is `engine()`'s, so the graph and the charts query the same database and vgplot's
 * single active coordinator is the one both mean. The two views also swap rather than coexist — a
 * chart in a hidden box measures zero width and never recovers — so this cache is what keeps
 * toggling between Graph and Analysis from reloading every relation.
 */

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
export function ensure<T>(key: string, load: (engine: Engine) => Promise<T>): Promise<T> {
  const existing = relations.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = engine().then(load);
  relations.set(key, pending);
  return pending;
}
