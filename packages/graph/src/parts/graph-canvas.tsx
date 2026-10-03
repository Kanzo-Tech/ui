"use client";

import { categoricalCapacity, cn, Show, useThemeTick } from "@kanzo-tech/ui";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { nameOf } from "../core/categories";
import type { Encoding } from "../core/load";
import type { GraphOptions } from "../core/state";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { internalsOf } from "../react/use-graph";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { resolveLook } from "../render/graph-looks";
import { scaleOf } from "../render/graph-model";
import { cursorChip, useGesture } from "./gesture";
import { labelled, topOf, useInView, useTitles } from "./labels";
import { useOverlays } from "./overlays";
import { ShapeGlyph } from "./shape-glyph";

export interface GraphCanvasProps extends React.ComponentProps<"div"> {
  /** The chrome — a toolbar, a legend, an inspector — positioned over the surface. */
  children?: ReactNode;
}

const WASH = "color-mix(in oklab, var(--primary) 17%, transparent)";

const WAITING: Partial<Record<string, string>> = {
  loading: "Loading the graph…",
};

/**
 * **The element, and what the look declares over it** — the grid, the vignette, the labels and the
 * hover card are fields of `Look`, so drawing them is the canvas's; the marquee and lasso gesture is
 * too. Two layers: cosmos.gl fills the surface with a canvas of its own, so chrome parented there
 * would be a sibling inside an element the renderer resizes. The frame is `isolate`, so a host's
 * `z-index` on a child cannot escape into the page.
 *
 * The surface is never gated on the first answer: rendered behind a placeholder it deadlocks — no
 * element, no renderer, no camera, no question. Waiting is an overlay over an empty canvas.
 */
export function GraphCanvas({ children, className, slot, ...rest }: GraphCanvasProps) {
  const api = useGraphContext();
  const { attach, renderer } = internalsOf(api);
  const focus = useGraphState((s) => s.focus);
  const tool = useGraphState((s) => s.tool);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const waiting = useGraphState((s) => (s.drawn === null ? WAITING[s.status] : undefined));
  const look = useMemo(() => resolveLook(options.look), [options.look]);
  const getGraph = useCallback(() => renderer()?.graph ?? null, [renderer]);
  const overlays = useOverlays({ getGraph });
  const { cardRef, gridRef, hostRef, hoverAt, labelRef, schedule, setHovered, setLabelOrder, track } = overlays;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const geometry = useGraphSnapshot((s) => s.geometry);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const mask = useGraphSnapshot((s) => s.mask);

  const { inView, moved } = useInView(getGraph, surfaceRef, look.labels === "visible" || look.labels === "all");
  // A layout effect: its cleanup runs while the element is still in the page, and detaching reads
  // the camera at the canvas's size. A passive cleanup runs after React removed it, at no size.
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onFrame = () => {
      schedule();
      moved();
    };
    return attach(surface, { onFrame, onHover: hoverAt });
  }, [attach, hoverAt, moved, schedule]);

  const themeTick = useThemeTick();
  useEffect(() => {
    renderer()?.repaint();
  }, [renderer, themeTick]);

  const top = useMemo(
    () => (geometry && encoding ? topOf(look.labels, geometry.size, encoding.sizes, mask) : []),
    [geometry, encoding, mask, look.labels],
  );
  const labelledIds = useMemo(
    () => (geometry && encoding ? labelled(look.labels, geometry.size, encoding.sizes, top, mask, inView, focus) : []),
    [geometry, encoding, top, mask, inView, focus, look.labels],
  );
  const titles = useTitles(labelledIds);
  const labels = useMemo(
    () => labelledIds.flatMap((vertex) => (titles.get(vertex) ? [{ vertex, text: titles.get(vertex) as string }] : [])),
    [labelledIds, titles],
  );
  useEffect(() => {
    setLabelOrder(labels.map((label) => label.vertex));
    track();
    schedule();
  }, [labels, schedule, setLabelOrder, track, look.grid]);

  const gesture = useGesture({
    getGraph,
    getSelection: useCallback(() => api.getState().selection, [api]),
    commit: (vertices, source, label) => api.select(vertices ? [...vertices] : null, source, label),
    setTool: api.setTool,
    tool,
  });
  const { active, drag, preview } = gesture;

  const capacity = hostRef.current ? categoricalCapacity(hostRef.current) : undefined;
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);

  return (
    <div
      {...rest}
      className={cn("relative isolate size-full overflow-hidden bg-background", className)}
      data-slot={slot ?? "graph-canvas"}
      ref={hostRef}
    >
      <div className="size-full" data-slot="graph-canvas-surface" ref={surfaceRef} />
      <Show when={look.grid}>
        <div
          className="pointer-events-none absolute inset-0"
          ref={gridRef}
          style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)" }}
        />
      </Show>
      <Show when={look.vignette}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, var(--background) 100%)" }}
        />
      </Show>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((label) => (
          <span
            className="absolute top-0 left-0 whitespace-nowrap font-medium text-[10px] text-foreground leading-none opacity-0 transition-opacity [text-shadow:0_0_3px_var(--background),0_0_6px_var(--background)]"
            data-slot="graph-canvas-label"
            key={String(label.vertex)}
            ref={labelRef(label.vertex)}
          >
            {label.text}
          </span>
        ))}
        <Show when={look.labels !== "none"}>
          <HoverCard
            cardRef={cardRef}
            domain={domain}
            encoding={encoding}
            options={options}
            scale={scale}
            schedule={schedule}
            setHovered={setHovered}
          />
        </Show>
      </div>
      <Show when={active !== null}>
        <div className="absolute inset-0 cursor-crosshair" data-slot="graph-canvas-gesture" {...gesture.handlers}>
          {drag && (
            <svg className="pointer-events-none size-full">
              {drag.tool === "rect" ? (
                <rect
                  className="stroke-primary"
                  height={Math.abs(drag.to[1] - drag.from[1])}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  style={{ fill: WASH }}
                  width={Math.abs(drag.to[0] - drag.from[0])}
                  x={Math.min(drag.from[0], drag.to[0])}
                  y={Math.min(drag.from[1], drag.to[1])}
                />
              ) : (
                drag.path.length > 1 && (
                  <polygon
                    className="stroke-primary"
                    points={drag.path.map(([x, y]) => `${x},${y}`).join(" ")}
                    strokeWidth={1}
                    style={{ fill: WASH }}
                  />
                )
              )}
            </svg>
          )}
          <Show when={preview !== null}>
            <span
              className="pointer-events-none absolute rounded-sm bg-primary px-1.5 py-0.5 font-medium text-[10px] text-primary-foreground tabular-nums"
              style={cursorChip(drag)}
            >
              {preview} node{preview === 1 ? "" : "s"}
            </span>
          </Show>
        </div>
      </Show>
      <Show when={waiting !== undefined}>
        <p
          className="pointer-events-none absolute inset-0 grid place-items-center text-muted-foreground text-xs"
          data-slot="graph-canvas-waiting"
        >
          {waiting}
        </p>
      </Show>
      {children}
    </div>
  );
}

interface HoverCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  domain: readonly unknown[];
  encoding: Encoding | null;
  options: GraphOptions;
  scale: ReturnType<typeof scaleOf>;
  schedule: () => void;
  setHovered: (vertex: VertexId | null) => void;
}

/** The only part that re-renders on a hover: the canvas and its labels do not. */
function HoverCard({ cardRef, domain, encoding, options, scale, schedule, setHovered }: HoverCardProps) {
  const hovered = useGraphState((s) => s.hovered);
  const titles = useTitles(useMemo(() => (hovered === null ? [] : [hovered]), [hovered]));
  useEffect(() => {
    setHovered(hovered);
    schedule();
  }, [hovered, schedule, setHovered, titles]);

  if (hovered === null || !encoding || hovered >= encoding.ranks.length) return null;
  const rank = encoding.ranks[hovered] ?? 0;
  const category = rank < domain.length ? nameOf(domain[rank], options.categories) : null;
  return (
    <div
      className="absolute top-0 left-0 flex w-max max-w-60 items-center gap-2 rounded-lg border bg-popover px-2.5 py-2 opacity-0 shadow-lg"
      data-slot="graph-canvas-card"
      ref={cardRef}
    >
      <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />
      <span className="truncate font-medium text-popover-foreground text-sm leading-none">
        {titles.get(hovered) || `#${hovered}`}
      </span>
      <Show when={category !== null}>
        <span className="text-muted-foreground text-xs">{category}</span>
      </Show>
    </div>
  );
}
