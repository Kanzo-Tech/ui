import { Selection, clauseNone, type ClauseSource, type SelectionClause } from "@uwdata/mosaic-core";

/**
 * **A selection inside another, joined by a map** — what a group of clients that crossfilter each
 * other in their own vocabulary publishes to the page in the page's. Built on Mosaic's public
 * `Selection` API alone: `update`, `reset`, `activate`, `clauses`, and the `value` and `activate`
 * events.
 *
 * - **outer → inner, as the clauses themselves.** Every clause `outer` holds is put into `inner`
 *   unchanged, `source` and `clients` intact, so a crossfilter still exempts each client from its own
 *   clause; a clause that leaves `outer` leaves `inner`. The one exception is the bridge's own clause.
 * - **inner → outer, through `map`.** The clauses published into `inner` itself are mapped *together*
 *   into one clause of `outer`'s, whose source is the bridge: `key IN (rows WHERE a AND b)` is what the
 *   inner clients show, and on a joined relation it is not `key IN (rows WHERE a) AND key IN (rows
 *   WHERE b)`.
 * - **Retraction follows the clause to where it was published.** Removing the inner clauses withdraws
 *   the mapped one. Retracting the mapped one on `outer` — a chip, a page's reset — calls its source
 *   back (`ClauseSource.reset`), and the bridge retracts the inner clauses. An `outer` clause reset
 *   inside `inner` — a "Clear" over the inner clients — is reset on `outer` too, so the page does not go
 *   on filtering by something nobody can see.
 *
 * **Why outer → inner is not `include`.** `include` would relay the bridge's own clause back in, and
 * Mosaic has no public way to keep it out. Every way to make that echo harmless is worse: unexempted,
 * it filters the client that made the brush by its own brush; exempting the publishers re-queries
 * every other inner client a second time per brush step; and exempting every inner client makes it
 * the selection's active clause for all of them, for which `SelectionResolver.predicate` answers *no
 * predicate at all* — so the next query a table pages or a tile mounts would read the relation
 * unfiltered. `include` also cannot be undone. Listening to `outer` has none of these.
 *
 * The bridge knows nothing of what it maps: `map` is the whole vocabulary. See `semiJoinOf` for the
 * one that turns a relation's column clauses into a semi-join on identity.
 */
export type ClauseMap = (clauses: readonly SelectionClause[], source: ClauseSource) => SelectionClause;

export interface BridgeOptions {
  /**
   * How the inner clauses are retracted when the mapped one is retracted on `outer`. Defaults to
   * `inner.reset(clauses)`. A reset travels downstream only, so when the inner clauses were relayed
   * in from selections upstream of `inner` — a chart's own — whoever owns those passes the call that
   * resets them there, or they would go on highlighting a pick the page no longer has.
   */
  retract?: (clauses: SelectionClause[]) => void;
}

/**
 * Join `inner` to `outer` through `map` — see {@link ClauseMap}. What `outer` already holds is put into
 * `inner`, and what `inner` already holds of its own is mapped, at once. Returns the unbridge, which
 * withdraws the mapped clause and stops listening.
 */
export function bridgeSelection(inner: Selection, outer: Selection, map: ClauseMap, options: BridgeOptions = {}): () => void {
  const { retract = (clauses) => void inner.reset(clauses) } = options;
  /** Clauses the bridge put into `inner` from `outer`: theirs to retract, never ours to map. */
  const arrived = new WeakSet<SelectionClause>();
  /** Those it took out again because `outer` let them go — not a reset made inside. */
  const withdrawn = new WeakSet<SelectionClause>();
  const own = () => inner.clauses.filter((c) => !arrived.has(c));
  const source: ClauseSource = { reset: () => retract(own()) };
  let relayed: readonly SelectionClause[] = [];
  let mapped: readonly SelectionClause[] = [];
  let held: readonly SelectionClause[] = [];

  const fromOuter = () => {
    const now = outer.clauses.filter((c) => c.source !== source);
    for (const clause of relayed) {
      if (now.includes(clause)) continue;
      withdrawn.add(clause);
      if (!now.some((c) => c.source === clause.source)) inner.update(clauseNone(clause.source));
    }
    for (const clause of now) {
      if (relayed.includes(clause)) continue;
      arrived.add(clause);
      inner.update(clause);
    }
    relayed = now;
  };
  const fromInner = () => {
    const now = inner.clauses;
    // An outer clause gone from `inner` that `outer` did not let go was reset in here: reset it there.
    const theirs = held.filter((c) => arrived.has(c) && !withdrawn.has(c) && !now.includes(c) && outer.clauses.includes(c));
    held = [...now];
    if (theirs.length > 0) outer.reset(theirs);

    const next = own();
    if (next.length === mapped.length && next.every((c, i) => c === mapped[i])) return;
    mapped = next;
    outer.update(next.length === 0 ? clauseNone(source) : map(next, source));
  };
  const activate = (clause: SelectionClause) => {
    if (clause.source !== source) inner.activate(clause);
  };

  fromOuter();
  outer.addEventListener("value", fromOuter);
  // @ts-expect-error mosaic-core types Selection's listeners by its value; `activate` hands a clause.
  outer.addEventListener("activate", activate);
  inner.addEventListener("value", fromInner);
  fromInner();

  return () => {
    outer.removeEventListener("value", fromOuter);
    // @ts-expect-error as above.
    outer.removeEventListener("activate", activate);
    inner.removeEventListener("value", fromInner);
    if (mapped.length > 0) outer.update(clauseNone(source));
    mapped = [];
  };
}
