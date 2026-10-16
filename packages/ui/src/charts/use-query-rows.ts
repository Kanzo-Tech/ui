"use client";

import { rowsOf, type Query } from "@kanzo-tech/mosaic";
import type { Engine } from "@kanzo-tech/mosaic/engine";
import { use } from "react";
import { useMosaic } from "./mosaic-provider.js";

/**
 * How many answers an engine keeps for `useQueryRows`, oldest dropped first. A component still
 * reading a dropped answer asks again and suspends once more; the number only bounds a page that
 * builds statements from what a reader types.
 */
const KEPT = 256;

interface Answer {
  readonly rows: Promise<readonly unknown[]>;
  failed: boolean;
}

/**
 * What a read that nothing stops hands the engine. A suspended reader holds no effect, so React
 * gives no moment at which it has gone: the statement runs to its end and its answer is kept.
 */
const UNSTOPPED = new AbortController().signal;

const answers = new WeakMap<Engine, Map<string, Answer>>();

/** One promise per statement, so `use` sees the same one on every render until it settles. */
function rowsFor(engine: Engine, sql: string): Promise<readonly unknown[]> {
  let kept = answers.get(engine);
  if (!kept) answers.set(engine, (kept = new Map()));
  const known = kept.get(sql);
  if (known) {
    // A failure is handed out once more — React's retry after the rejection is the render that
    // throws it to the boundary — and forgotten a task later, so the boundary's own retry asks
    // again. Forgotten at the rejection, React's retry would find nothing, ask again and suspend,
    // and the failure would never reach the boundary; never forgotten, no retry could recover.
    if (known.failed) setTimeout(() => kept.get(sql) === known && kept.delete(sql), 0);
    return known.rows;
  }
  const answer: Answer = {
    rows: engine.query(sql, { signal: UNSTOPPED }).then(rowsOf),
    failed: false,
  };
  kept.set(sql, answer);
  answer.rows.catch(() => (answer.failed = true)); // the caller holds `rows`; this only records it
  if (kept.size > KEPT) kept.delete(kept.keys().next().value as string);
  return answer.rows;
}

/**
 * **A statement's rows, suspending until they land** — on the provider's engine, its own door
 * (`Engine.query`), as objects keyed by column. React's `use` over one promise per engine and SQL
 * text: every component asking the same statement shares one answer, and asking it again later is
 * answered without a query. A failure is thrown, as it was thrown, to the nearest error boundary.
 *
 * It does **not** follow the crossfilter. It is for what a page reads once — a catalog, a schema, a
 * lookup — and `useChartQuery` is for anything that should move with the brush. The answer is kept
 * for the engine's life, so a statement whose answer changes needs different SQL: name what changed
 * in it.
 */
export function useQueryRows<Row = Record<string, unknown>>(query: Query | string): readonly Row[] {
  const { engine } = useMosaic();
  return use(rowsFor(engine, String(query))) as readonly Row[];
}
