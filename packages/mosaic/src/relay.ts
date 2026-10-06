import { clauseNone, type ClauseSource, type Selection, type SelectionClause } from "@uwdata/mosaic-core";

/** What a relay leaves out, and who hears of each clause it moves. */
export interface RelayOptions {
  /** A source whose clauses stay in `from`: a bridge's own mapped clause, which must not echo back. */
  except?: ClauseSource;
  /** Called with each clause as it is put into `to`. */
  onArrive?: (clause: SelectionClause) => void;
  /** Called with each clause as it is taken out of `to` because it left `from`. */
  onWithdraw?: (clause: SelectionClause) => void;
}

/**
 * **Relay `from`'s clauses into `to`, after both already exist** — on Mosaic's public `Selection`
 * API alone: `update`, `activate`, `clauses`, and the `value` and `activate` events.
 *
 * Mosaic relays only through the constructor's `include` option, which cannot be undone and cannot be
 * added once a selection is built — a chart's selection is born long after the crossfilter it feeds.
 * Its implementation, the `_relay` set, is an internal (`mosaic-public-api.test.ts` in `ui`).
 *
 * - **The clause objects themselves.** Each clause `from` holds is put into `to` unchanged, `source`
 *   and `clients` intact, so a crossfilter still exempts a client from its own clause; a copy would
 *   make every chart filter itself away.
 * - **A clause that leaves `from` leaves `to`**, whether it was replaced, reset or retracted: the
 *   relay reads `from.clauses` on every `value` event, so it follows the state rather than the
 *   operation, and a `reset` — which emits no event of its own — travels as the `value` it causes.
 * - **Timing.** Mosaic dispatches the first `value` at once and queues the ones raised while a
 *   dispatch is in flight, so a burst arrives a microtask late and coalesced. Reading the state
 *   rather than the event is what makes the coalescing lossless: the last delivery holds the latest
 *   clauses.
 *
 * Returns the unrelay, which stops listening and withdraws from `to` every clause it relayed. It
 * does not read `from` to decide: `clauses` is the last *dispatched* value, so a `from.reset()` just
 * before the unrelay may still be queued, and waiting for it would leave the relay half-wired.
 */
export function relaySelection(from: Selection, to: Selection, options: RelayOptions = {}): () => void {
  const { except, onArrive, onWithdraw } = options;
  let relayed: readonly SelectionClause[] = [];

  const sync = () => {
    const now = from.clauses.filter((c) => except === undefined || c.source !== except);
    for (const clause of relayed) {
      if (now.includes(clause)) continue;
      onWithdraw?.(clause);
      if (!now.some((c) => c.source === clause.source)) to.update(clauseNone(clause.source));
    }
    for (const clause of now) {
      if (relayed.includes(clause)) continue;
      onArrive?.(clause);
      to.update(clause);
    }
    relayed = now;
  };
  const activate = (clause: SelectionClause) => {
    if (except === undefined || clause.source !== except) to.activate(clause);
  };

  sync();
  from.addEventListener("value", sync);
  // @ts-expect-error mosaic-core types Selection's listeners by its value; `activate` hands a clause.
  from.addEventListener("activate", activate);

  return () => {
    from.removeEventListener("value", sync);
    // @ts-expect-error as above.
    from.removeEventListener("activate", activate);
    for (const clause of relayed) onWithdraw?.(clause);
    for (const source of new Set(relayed.map((c) => c.source))) to.update(clauseNone(source));
    relayed = [];
  };
}
