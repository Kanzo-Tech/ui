"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ExprNode } from "@kanzo-tech/mosaic";
import { publish } from "../core/client";
import { clausesOf } from "../core/source";
import type { VertexId } from "../core/types";
import { useGraphContext } from "./graph-root";
import { internalsOf } from "./use-graph";

/** A place that picks vertices beside the canvas, and what it has picked. */
export interface Pick {
  /** The label of the clause this place published, while the crossfilter holds it; `null` otherwise. */
  picked: string | null;
  /**
   * Publish `ids` as this place's clause, named `label` — replacing what it picked before — or
   * withdraw it with `null`. A no-op before the corpus is read: there is no key to pick by yet.
   */
  pick(ids: readonly VertexId[] | null, label: string): void;
  /**
   * The subset this place reads: every clause on the crossfilter but its own — Mosaic's
   * `Selection.predicate(client)`, as a list. A search asks within it, a rule checks within it, and
   * neither is narrowed by what it picked itself.
   */
  predicate(): ExprNode[];
}

/**
 * **A pick from beside the canvas** — a search's matches, a rule's findings, an answer's rows — as a
 * clause of its own on the crossfilter the graph filters by: `key IN (ids)`, whose chip reads
 * `label`. Every clause filters every client, the graph included, which greys out the rest; and
 * because each place is its own source, two places intersect while one place picking again
 * replaces its own pick. Mosaic's `Selection`, one source per publisher.
 *
 * `id` names the place, and the source is the root's for its whole life: a panel that closes and
 * opens again is still the publisher of the clause it left on the page, so `picked` still says so
 * and picking replaces it rather than adding a second. The clause outlives the component on
 * purpose: a pick belongs to the page, and is retracted where it shows — its chip.
 */
export function usePick(id: string): Pick {
  const api = useGraphContext();
  const { store } = internalsOf(api);
  const source = store.source(id);

  const subscribe = useCallback(
    (changed: () => void) => {
      let scope = store.scope();
      scope.addEventListener("value", changed);
      // `filterBy` can change under the root: follow the selection the graph filters by now.
      const unsubscribe = store.subscribe(() => {
        if (store.scope() === scope) return;
        scope.removeEventListener("value", changed);
        scope = store.scope();
        scope.addEventListener("value", changed);
        changed();
      });
      return () => {
        scope.removeEventListener("value", changed);
        unsubscribe();
      };
    },
    [store],
  );
  const picked = useSyncExternalStore(
    subscribe,
    () => {
      const clause = store.scope().clauses.find((c) => c.source === source);
      return clause ? ((clause.meta as { label?: string } | undefined)?.label ?? "") : null;
    },
    () => null,
  );

  const pick = useCallback(
    (ids: readonly VertexId[] | null, label: string) => {
      const { structure } = store.getSnapshot();
      if (structure) publish(store.scope(), source, structure.key, ids, label);
    },
    [store, source],
  );

  // `noSkip`: Mosaic answers nothing to the client of the active clause, which needs no update; a
  // reader asking now wants the predicate itself.
  const predicate = useCallback(() => clausesOf(store.scope().predicate(source, true)), [store, source]);

  return { picked, pick, predicate };
}
