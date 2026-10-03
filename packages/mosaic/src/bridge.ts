import { Selection, clauseNone, type ClauseSource, type SelectionClause } from "@uwdata/mosaic-core";

/**
 * **A selection inside another, joined by a map** — what a group of clients that crossfilter each
 * other in their own vocabulary publishes to the page in the page's.
 *
 * Mosaic already has half of it. A selection built with `include` is told everything published into
 * the selections it includes: `new Selection(resolver, include)` adds itself to each one's `_relay`,
 * and `update`, `reset` and `activate` all end in `_relay.forEach(…)`, handing on the clause object
 * itself, so its `source` and `clients` arrive intact and a crossfilter still exempts each client from
 * its own clause. What `include` cannot do is change a clause on the way, and that is the other half:
 * a dashboard over a joined relation names `Person.country`, and the page's other clients have no such
 * column. So the bridge rides the same `_relay` channel in both directions:
 *
 * - **outer → inner, as `include` does:** every clause of `outer` reaches `inner` as itself, except
 *   the one the bridge published there — `inner` already holds what it was made from.
 * - **inner → outer, through `map`:** the clauses published into `inner` itself — not the ones that
 *   arrived from `outer` — become one clause of `outer`'s, whose source is the bridge. Mapped together,
 *   not one by one: `key IN (rows WHERE a AND b)` is what the inner clients show, and on a joined
 *   relation it is not `key IN (rows WHERE a) AND key IN (rows WHERE b)`.
 *
 * Retraction follows the clause to where it was published. Removing the inner clauses withdraws the
 * mapped one; retracting the mapped one on `outer` — a chip, a page's reset — calls the bridge back,
 * and it resets the inner clauses, whose own sources (a brush, an input) clear themselves; and an
 * `outer` clause reset inside `inner` is reset on `outer` too, so a "Clear" over the inner clients does
 * not leave the page filtering by something nobody can see.
 *
 * The bridge knows nothing of what it maps: `map` is the whole vocabulary. See `semiJoinOf` for the
 * one that turns a relation's column clauses into a semi-join on identity.
 */
export type ClauseMap = (clauses: readonly SelectionClause[], source: ClauseSource) => SelectionClause;

/** What a relay is handed: the three calls `Selection` makes on everything in its `_relay`. */
interface Heard {
  update(clause: SelectionClause): void;
  reset(clauses: SelectionClause[]): void;
  activate(clause: SelectionClause): void;
}

/** A downstream selection in `_relay` that hears instead of holding — `include`, with a callback. */
class Relay extends Selection {
  readonly #heard: Heard;
  constructor(heard: Heard) {
    super();
    this.#heard = heard;
  }
  override update(clause: SelectionClause): this {
    this.#heard.update(clause);
    return this;
  }
  override reset(clauses: SelectionClause[] = []): this {
    this.#heard.reset(clauses);
    return this;
  }
  override activate(clause: SelectionClause): void {
    this.#heard.activate(clause);
  }
}

function listen(selection: Selection, heard: Heard): () => void {
  const relay = new Relay(heard);
  selection._relay.add(relay);
  return () => void selection._relay.delete(relay);
}

export interface BridgeOptions {
  /**
   * How the inner clauses are retracted when the mapped one is retracted on `outer`. Defaults to
   * `inner.reset(clauses)`. A `reset` travels downstream only, so when the inner clauses were relayed
   * in from selections upstream of `inner` — a chart's own — whoever owns those passes the call that
   * resets them there, or they would go on highlighting a pick the page no longer has.
   */
  retract?: (clauses: SelectionClause[]) => void;
}

/**
 * Join `inner` to `outer` through `map` — see {@link ClauseMap}. `outer`'s clauses already standing are
 * relayed into `inner`, and `inner`'s already published, at once. Returns the unbridge, which withdraws
 * the mapped clause from `outer` and stops both relays.
 */
export function bridgeSelection(inner: Selection, outer: Selection, map: ClauseMap, options: BridgeOptions = {}): () => void {
  const { retract = (clauses) => void inner.reset(clauses) } = options;
  /** Clauses `inner` was handed by `outer`: theirs to retract, never ours to map. */
  const arrived = new WeakSet<SelectionClause>();
  let mapped: readonly SelectionClause[] = [];
  const own = () => inner._resolved.filter((c) => !arrived.has(c));
  const source: ClauseSource = { reset: () => retract(own()) };
  const ours = (clause: SelectionClause) => clause.source === source;

  const publish = () => {
    const next = own();
    if (next.length === mapped.length && next.every((c, i) => c === mapped[i])) return;
    mapped = next;
    outer.update(next.length > 0 ? map(next, source) : clauseNone(source));
  };
  const down = (clause: SelectionClause) => {
    if (ours(clause)) return;
    arrived.add(clause);
    inner.update(clause);
  };

  for (const clause of outer._resolved) down(clause);
  const stop = [
    listen(outer, {
      update: down,
      reset: (clauses) => {
        const held = clauses.filter((c) => !ours(c) && inner._resolved.includes(c));
        if (held.length > 0) inner.reset(held);
      },
      activate: (clause) => void (ours(clause) || inner.activate(clause)),
    }),
    listen(inner, {
      update: publish,
      reset: (clauses) => {
        const theirs = clauses.filter((c) => arrived.has(c) && outer._resolved.includes(c));
        if (theirs.length > 0) outer.reset(theirs);
        publish();
      },
      activate: () => {},
    }),
  ];
  publish();

  return () => {
    for (const s of stop) s();
    if (mapped.length > 0) outer.update(clauseNone(source));
    mapped = [];
  };
}
