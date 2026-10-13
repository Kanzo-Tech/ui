import type { ClauseSource, Selection, SelectionClause } from "@uwdata/mosaic-core";

/**
 * **A clause is the page's, and outlives the part that published it.** A chart's pick or a control's
 * value is published under a place's source; the part that drew it may unmount — a tab, a dashboard
 * switched to another relation — and the clause stays on the page's selection, a chip in the
 * `FilterBar` crossed to every other relation by key, until the reader removes it there, re-picks
 * or clears it where it was made, or clears every filter. A part that mounts again with the same
 * key takes the place back: its clause is the one it draws, and the one it replaces when it
 * publishes, so a remount never puts a second clause beside the first.
 *
 * A key is held by one part at a time: a second part on screen with the same key gets a place of
 * its own, which nothing takes back.
 */
export interface ClausePlace {
  readonly source: ClauseSource;
  /**
   * The last clause built under the source, until it is reset: what the page holds of the place, or
   * is about to. `Selection.clauses` is what the page last delivered, and an update waits to be
   * delivered behind the clients' answers to the one before, so it can lag a brush.
   */
  last?: SelectionClause;
  /** What a reset calls back: the part's own clear, a brush's say. */
  onReset?: () => void;
  /** Whether a part on screen holds it. */
  taken?: boolean;
}

const places = new WeakMap<Selection, Map<string, ClausePlace>>();

/** The place `key` names on `selection`, held by the caller until `releasePlace`. */
export function claimPlace(selection: Selection, key: string): ClausePlace {
  const map = places.get(selection) ?? new Map<string, ClausePlace>();
  places.set(selection, map);
  let place = map.get(key);
  if (!place || place.taken) {
    const fresh: ClausePlace = {
      source: {
        reset: () => {
          fresh.last = undefined;
          fresh.onReset?.();
          if (!fresh.taken && map.get(key) === fresh) map.delete(key);
        },
      },
    };
    if (!place) map.set(key, fresh);
    place = fresh;
  }
  place.taken = true;
  return place;
}

/** The clause the page holds under `place`, or `undefined` when it holds none. */
export function heldClause(place: ClausePlace): SelectionClause | undefined {
  return place.last?.predicate != null ? place.last : undefined;
}

/** The part holding `place` lets go of it, and the clause stays: see `ClausePlace`. */
export function releasePlace(place: ClausePlace): void {
  place.taken = false;
  if (!heldClause(place)) place.source.reset!();
}
