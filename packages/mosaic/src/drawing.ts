import type { Selection } from "@uwdata/mosaic-core";

/**
 * **What a page has yet to draw for the first time**, counted on the page's selection — the one
 * object every client of the page shares, whatever package drew it. A chart holds the count from
 * the moment it asks until its first answer is drawn (or fails, or stops asking); a part whose own
 * load should appear with everything else — the graph's canvas — reads it, so the page comes up
 * together instead of in the order the answers land.
 *
 * Mosaic has no such notion: a client's `pending` is one query, not "drawn", and nothing counts the
 * clients of a selection.
 */
interface Drawing {
  count: number;
  readonly listeners: Set<() => void>;
}

const pages = new WeakMap<Selection, Drawing>();

function drawingOf(page: Selection): Drawing {
  let found = pages.get(page);
  if (!found) pages.set(page, (found = { count: 0, listeners: new Set() }));
  return found;
}

/** Count one first draw on `page` as pending. Returns the release, which counts it once. */
export function holdFirstDraw(page: Selection): () => void {
  const drawing = drawingOf(page);
  drawing.count++;
  drawing.listeners.forEach((listener) => listener());
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    drawing.count--;
    drawing.listeners.forEach((listener) => listener());
  };
}

/** How many first draws on `page` are still pending. */
export function firstDrawsPending(page: Selection): number {
  return pages.get(page)?.count ?? 0;
}

/** Call `listener` whenever that count changes. Returns the unsubscribe. */
export function onFirstDraws(page: Selection, listener: () => void): () => void {
  const { listeners } = drawingOf(page);
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
