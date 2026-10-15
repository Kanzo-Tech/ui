"use client";

import { useMemo, useRef, useState } from "react";
import { nameOf } from "../core/categories";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { internalsOf } from "../react/use-graph";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { modified } from "./gesture";
import { useTitles } from "./labels";

/** How far Shift + an arrow pans, in screen pixels, and how much `+` and `-` zoom. */
const PAN = 80;
const ZOOM = 1.4;

const ARROWS: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Where a walk through a vertex's neighbours stands: the vertex it stopped on, its place among them and how many there are. */
interface Walk {
  readonly anchor: VertexId;
  readonly vertex: VertexId;
  readonly place: number;
  readonly of: number;
}

/**
 * **The canvas's keys, and what it says of the focused vertex.** The cursor is the store's `focus`,
 * the vertex the inspector already shows. Arrows move it to the nearest kept vertex that way on screen;
 * `]` and `[` walk its neighbours in id order, so a neighbourhood is read without sight; Enter or
 * Space selects it as a click does — ⌘/Ctrl adds, Alt takes; Shift + arrows pan, `+` and `-` zoom,
 * `F` frames and `P` pauses the layout. The returned `heard` is what the polite status region says: the
 * vertex, its type, its neighbours, and whether the filters keep it, in words and not in colour alone.
 */
export function useKeyboard(announce: (title: string, type: string, neighbours: number, kept: boolean, walk: readonly [number, number] | null) => string) {
  const api = useGraphContext();
  const { renderer, store } = internalsOf(api);
  const [walk, setWalk] = useState<Walk | null>(null);
  const held = useRef<Walk | null>(null);
  const focus = useGraphState((s) => s.focus);
  const kept = useGraphSnapshot((s) => s.kept);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const focused = useMemo(() => (focus === null ? [] : [focus]), [focus]);
  const titles = useTitles(focused);

  const move = (vertex: VertexId, next: Walk | null) => {
    held.current = next;
    setWalk(next);
    api.setFocus(vertex);
    renderer()?.show(vertex);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // A key inside a control laid over the canvas — the toolbar's buttons — is that control's.
    if (event.target !== event.currentTarget) return;
    const { key } = event;
    const r = renderer();
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
    const direction = ARROWS[key];
    let handled = true;
    if (direction && event.shiftKey) r?.pan(direction[0] * PAN, direction[1] * PAN);
    else if (direction) {
      const next = r?.toward(focus, direction) ?? null;
      if (next !== null) move(next, null);
    } else if ((key === "]" || key === "[") && focus !== null && r) {
      const step = key === "]" ? 1 : -1;
      let anchor = held.current?.anchor ?? focus;
      let around = r.neighbours(anchor);
      if (focus !== anchor && !around.includes(focus)) [anchor, around] = [focus, r.neighbours(focus)];
      if (around.length === 0) return;
      const at = around.indexOf(focus);
      const place = at < 0 ? (step > 0 ? 0 : around.length - 1) : (at + step + around.length) % around.length;
      move(around[place] as VertexId, { anchor, vertex: around[place] as VertexId, place: place + 1, of: around.length });
    } else if ((key === "Enter" || key === " ") && focus !== null) {
      const caught = new Set<VertexId>([focus, ...(r?.neighbours(focus) ?? [])]);
      const next = modified(api.getState().selection, caught, event.altKey ? "take" : event.metaKey || event.ctrlKey ? "add" : "replace");
      store.select(next ? [...next.vertices] : null, "node", "Node", next?.excludes ?? false);
    } else if (plain && (key === "+" || key === "=")) api.zoomBy(ZOOM);
    else if (plain && (key === "-" || key === "_")) api.zoomBy(1 / ZOOM);
    else if (plain && (key === "f" || key === "F")) api.frame();
    else if (plain && (key === "p" || key === "P")) {
      if (api.getState().motion === "running") api.pause();
      else api.resume();
    } else handled = false;
    if (handled) event.preventDefault();
  };

  const title = focus === null ? undefined : titles.get(focus);
  const rank = focus === null || !encoding ? undefined : encoding.ranks[focus];
  const type = rank === undefined || rank >= domain.length ? "" : nameOf(domain[rank], options.categories);
  const heard =
    focus === null
      ? ""
      : announce(
          title ?? `#${focus}`,
          type,
          renderer()?.neighbours(focus).length ?? 0,
          kept === null || kept[focus] === 1,
          walk?.vertex === focus ? [walk.place, walk.of] : null,
        );
  return { heard, onKeyDown };
}
