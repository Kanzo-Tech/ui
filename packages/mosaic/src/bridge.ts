import { Selection, clauseNone, type ClauseSource, type SelectionClause } from "@uwdata/mosaic-core";
import { relaySelection } from "./relay.js";

/**
 * **A selection inside another, joined by a map** — what a group of clients that crossfilter each
 * other in their own vocabulary publishes to the page in the page's. Built on Mosaic's public
 * `Selection` API alone: `update`, `reset`, `activate`, `clauses`, and the `value` and `activate`
 * events.
 *
 * - **outer → inner, as the clauses themselves** — `relaySelection`, except the bridge's own clause.
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
 * Mosaic has no way to keep it out; `relaySelection` takes `except`. Every way to make that echo harmless is worse: unexempted,
 * it filters the client that made the brush by its own brush; exempting the publishers re-queries
 * every other inner client a second time per brush step; and exempting every inner client makes it
 * the selection's active clause for all of them, for which `SelectionResolver.predicate` answers *no
 * predicate at all* — so the next query a table pages or a tile mounts would read the relation
 * unfiltered. `include` also cannot be undone. A relay that skips the bridge's source has none of these.
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

/** What a mapped clause was made of, and the way back to each part. */
export interface Bridged {
  /** The inner clauses it maps, in the order they were published. */
  readonly parts: readonly SelectionClause[];
  /** Retract some of them where they were published, as the bridge's `retract` does. */
  retract(parts: readonly SelectionClause[]): void;
}

const made = new WeakMap<SelectionClause, Bridged>();

/**
 * **The parts of a bridged clause** — the inner clauses a bridge mapped into this one, or `null` for
 * any other clause. A row of chips over the page shows each part where the page holds one clause —
 * *country Spain*, *creationDate 2011 – 2012* rather than one *Dashboard* — and removing one retracts
 * that part alone, which maps the rest again.
 */
export function bridged(clause: SelectionClause): Bridged | null {
  return made.get(clause) ?? null;
}

/**
 * Join `inner` to `outer` through `map` — see {@link ClauseMap}. What `outer` already holds is put into
 * `inner`, and what `inner` already holds of its own is mapped, at once. Returns the unbridge, which
 * stops listening and withdraws both halves: the mapped clause from `outer`, the relayed ones from
 * `inner`.
 */
export function bridgeSelection(inner: Selection, outer: Selection, map: ClauseMap, options: BridgeOptions = {}): () => void {
  const { retract = (clauses) => void inner.reset(clauses) } = options;
  /** Clauses the bridge put into `inner` from `outer`: theirs to retract, never ours to map. */
  const arrived = new WeakSet<SelectionClause>();
  /** Those it took out again because `outer` let them go — not a reset made inside. */
  const withdrawn = new WeakSet<SelectionClause>();
  const own = () => inner.clauses.filter((c) => !arrived.has(c));
  const source: ClauseSource = { reset: () => retract(own()) };
  let mapped: readonly SelectionClause[] = [];
  let held: readonly SelectionClause[] = [];

  const fromInner = () => {
    const now = inner.clauses;
    // An outer clause gone from `inner` that `outer` did not let go was reset in here: reset it there.
    const theirs = held.filter((c) => arrived.has(c) && !withdrawn.has(c) && !now.includes(c) && outer.clauses.includes(c));
    held = [...now];
    if (theirs.length > 0) outer.reset(theirs);

    const next = own();
    if (next.length === mapped.length && next.every((c, i) => c === mapped[i])) return;
    mapped = next;
    if (next.length === 0) return void outer.update(clauseNone(source));
    const clause = map(next, source);
    made.set(clause, { parts: next, retract: (parts) => retract([...parts]) });
    outer.update(clause);
  };

  const unrelay = relaySelection(outer, inner, {
    except: source,
    onArrive: (clause) => arrived.add(clause),
    onWithdraw: (clause) => withdrawn.add(clause),
  });
  inner.addEventListener("value", fromInner);
  fromInner();

  return () => {
    inner.removeEventListener("value", fromInner);
    unrelay();
    if (mapped.length > 0) outer.update(clauseNone(source));
    mapped = [];
  };
}
