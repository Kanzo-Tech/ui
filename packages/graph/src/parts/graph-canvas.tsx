"use client";

import { ark } from "@ark-ui/react/factory";
import { categoricalCapacity, cn, Show, useThemeTick } from "@kanzo-tech/ui";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { tv } from "tailwind-variants";
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
import { useKeyboard } from "./keyboard";
import { ShapeGlyph } from "./shape-glyph";
import { registerForTesting } from "./testing-probe";

/** The words the canvas writes over itself. */
export interface GraphCanvasTranslations {
  /** Over the empty canvas while the graph loads. */
  loading: string;
  /** Beside the pointer while a marquee or a lasso is drawn, given how many it holds, formatted, and the number. */
  holds: (count: string, n: number) => string;
  /** The canvas's accessible name; a host replaces it with the graph's own. */
  name: string;
  /** What kind of widget it is, for a screen reader: `aria-roledescription`. */
  roledescription: string;
  /** What the canvas holds and how to read it, given how many vertices and links are drawn and how many the filters keep (`null`: none filtered). */
  summary: (vertices: string, edges: string, matching: string | null) => string;
  /** The focused vertex, in words: its text, type, neighbours, whether the filters keep it, and — walking its neighbours — the place `[k, n]` reached. */
  focused: (title: string, type: string, neighbours: number, kept: boolean, walk: readonly [number, number] | null) => string;
}

const ENGLISH: GraphCanvasTranslations = {
  loading: "Loading the graph…",
  holds: (count, n) => `${count} node${n === 1 ? "" : "s"}`,
  name: "Graph",
  roledescription: "graph canvas",
  summary: (vertices, edges, matching) =>
    `${vertices} vertices and ${edges} links drawn${matching === null ? "" : `, ${matching} kept by the filters`}. Arrow keys move between vertices, ] and [ walk a vertex's neighbours, Enter selects, F frames, P pauses the layout. The search finds a vertex by name and the inspector reads its row.`,
  focused: (title, type, neighbours, kept, walk) =>
    `${title}${type ? `, ${type}` : ""}${walk ? `, neighbour ${walk[0]} of ${walk[1]}` : `, ${neighbours} neighbour${neighbours === 1 ? "" : "s"}`}${kept ? "" : ", greyed out by the filters"}`,
};

export interface GraphCanvasProps extends React.ComponentProps<typeof ark.div> {
  /** The chrome — a toolbar, a legend, an inspector — positioned over the surface. */
  children?: ReactNode;
  translations?: Partial<GraphCanvasTranslations>;
}

const WASH = "color-mix(in oklab, var(--primary) 17%, transparent)";

/**
 * Where an overlay the renderer places every frame starts: the canvas's top-left corner, written as
 * a style beside the `transform` `overlays.ts` writes, because both are cosmos.gl's screen
 * coordinates — a corner, not a reading direction, so they do not mirror under `dir="rtl"`.
 */
const ORIGIN: React.CSSProperties = { left: 0, top: 0 };

const graphCanvas = tv({
  slots: {
    root: "relative isolate size-full overflow-hidden bg-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset",
    layer: "pointer-events-none absolute inset-0 size-full",
    surface: "relative size-full",
    labels: "pointer-events-none absolute inset-0 overflow-hidden",
    label: [
      "absolute whitespace-nowrap font-medium text-[10px] text-foreground leading-none opacity-0 transition-opacity",
      "[text-shadow:0_0_3px_var(--background),0_0_6px_var(--background)]",
    ],
    gesture: "absolute inset-0 cursor-crosshair",
    drawing: "pointer-events-none size-full",
    chip: "pointer-events-none absolute rounded-sm bg-primary px-1.5 py-0.5 font-medium text-[10px] text-primary-foreground tabular-nums",
    waiting: "pointer-events-none absolute inset-0 grid place-items-center text-muted-foreground text-xs",
    card: "absolute flex w-max max-w-60 items-center gap-2 rounded-lg border bg-popover px-2.5 py-2 opacity-0 shadow-lg",
    cardGlyph: "size-2.5 shrink-0",
    cardTitle: "truncate font-medium text-popover-foreground text-sm leading-none",
    cardDetail: "text-muted-foreground text-xs",
  },
});

/**
 * **The element, and what the look declares over it** — the grid, the vignette, the labels and the
 * hover card are fields of `Look`, so drawing them is the canvas's; the marquee and lasso gesture is
 * too. Two layers: cosmos.gl fills the surface with a canvas of its own, so chrome parented there
 * would be a sibling inside an element the renderer resizes. The frame is `isolate`, so a host's
 * `z-index` on a child cannot escape into the page.
 *
 * The grid is the one layer under the surface, which is positioned so tree order decides: cosmos.gl
 * clears to a transparent background (`appearance`) and this element paints the colour. It is a
 * `<canvas>` drawn by `overlays.ts` when the camera moved — `/docs/design/graph`, "The reference grid".
 *
 * The surface is never gated on the first answer: rendered behind a placeholder it deadlocks — no
 * element, no renderer, no camera, no question. Waiting is an overlay over an empty canvas.
 *
 * What a test reads (`/docs/design/testing`): the element is `aria-busy` until the graph's first drawn
 * frame, and `data-frame` counts the frames drawn — the one attribute with no accessible equivalent,
 * and the only way to see that a WebGL canvas moved. Its `id` is its key in the test hook.
 */
export function GraphCanvas({ children, className, slot, translations, ...rest }: GraphCanvasProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphCanvas();
  const api = useGraphContext();
  const generated = useId();
  const id = rest.id ?? generated;
  const { attach, renderer } = internalsOf(api);
  const focus = useGraphState((s) => s.focus);
  const tool = useGraphState((s) => s.tool);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const waiting = useGraphState((s) => s.drawn === null && s.status === "loading");
  const busy = useGraphState((s) => s.drawn === null && s.status !== "failed");
  const look = useMemo(() => resolveLook(options.look), [options.look]);
  const getGraph = useCallback(() => renderer()?.graph ?? null, [renderer]);
  const themeTick = useThemeTick();
  const overlays = useOverlays({ getGraph, theme: themeTick });
  const summaryId = `${id}-summary`;
  const drawn = useGraphState((s) => s.drawn);
  const matching = useGraphState((s) => s.matching);
  const { heard, onKeyDown } = useKeyboard(t.focused);
  const { cardRef, gridRef, hostRef, hoverAt, labelRef, schedule, setHovered, setLabelOrder, track } = overlays;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const geometry = useGraphSnapshot((s) => s.geometry);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const kept = useGraphSnapshot((s) => s.kept);

  const { inView, moved } = useInView(getGraph, surfaceRef, look.labels === "visible" || look.labels === "all");
  // A layout effect: its cleanup runs while the element is still in the page, and detaching reads
  // the camera at the canvas's size. A passive cleanup runs after React removed it, at no size.
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onFrame = () => {
      schedule();
      moved();
      // Written past React, once a frame: a render per frame is what the overlays exist to avoid.
      const host = hostRef.current;
      host?.setAttribute("data-frame", String(Number(host.getAttribute("data-frame")) + 1));
    };
    return attach(surface, { onFrame, onHover: hoverAt });
  }, [attach, hoverAt, hostRef, moved, schedule]);
  useEffect(
    () => registerForTesting(id, getGraph, () => internalsOf(api).store.getSnapshot().geometry),
    [api, getGraph, id],
  );

  useEffect(() => {
    renderer()?.repaint();
  }, [renderer, themeTick]);

  const top = useMemo(
    () => (geometry && encoding ? topOf(look.labels, geometry.size, encoding.sizes, kept) : []),
    [geometry, encoding, kept, look.labels],
  );
  const labelledIds = useMemo(
    () => (geometry && encoding ? labelled(look.labels, geometry.size, encoding.sizes, top, kept, inView, focus) : []),
    [geometry, encoding, top, kept, inView, focus, look.labels],
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
    commit: (vertices, source, label, excludes) => internalsOf(api).store.select(vertices ? [...vertices] : null, source, label, excludes),
    setTool: api.setTool,
    tool,
  });
  const { active, drag, preview } = gesture;

  const capacity = hostRef.current ? categoricalCapacity(hostRef.current) : undefined;
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);

  return (
    <ark.div
      aria-describedby={summaryId}
      aria-label={t.name}
      aria-roledescription={t.roledescription}
      role="application"
      tabIndex={0}
      {...rest}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event);
        if (!event.defaultPrevented) onKeyDown(event);
      }}
      aria-busy={busy || undefined}
      className={cn(styles.root(), className)}
      data-frame={0}
      data-slot={slot ?? "graph-canvas"}
      id={id}
      ref={hostRef}
    >
      <Show when={look.grid}>
        <canvas className={styles.layer()} data-slot="graph-canvas-grid" ref={gridRef} />
      </Show>
      <div className={styles.surface()} data-slot="graph-canvas-surface" ref={surfaceRef} />
      <Show when={look.vignette}>
        <div
          className={styles.layer()}
          style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, var(--background) 100%)" }}
        />
      </Show>
      <div className={styles.labels()}>
        {labels.map((label) => (
          <span
            className={styles.label()}
            data-slot="graph-canvas-label"
            key={String(label.vertex)}
            ref={labelRef(label.vertex)}
            style={ORIGIN}
          >
            {label.text}
          </span>
        ))}
        <Show when={look.labels !== "none"}>
          <HoverCard
            cardRef={cardRef}
            styles={styles}
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
        <div {...gesture.handlers} className={styles.gesture()} data-slot="graph-canvas-gesture">
          {drag && (
            <svg className={styles.drawing()}>
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
            <span className={styles.chip()} style={cursorChip(drag)}>
              {t.holds(String(preview), preview ?? 0)}
            </span>
          </Show>
        </div>
      </Show>
      <Show when={waiting}>
        <p className={styles.waiting()} data-slot="graph-canvas-waiting">
          {t.loading}
        </p>
      </Show>
      <p className="sr-only" id={summaryId}>
        {drawn ? t.summary(drawn.vertices.toLocaleString(), drawn.edges.toLocaleString(), matching === null ? null : matching.toLocaleString()) : ""}
      </p>
      <div aria-live="polite" className="sr-only" role="status">
        {heard}
      </div>
      {children}
    </ark.div>
  );
}

interface HoverCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  styles: ReturnType<typeof graphCanvas>;
  domain: readonly unknown[];
  encoding: Encoding | null;
  options: GraphOptions;
  scale: ReturnType<typeof scaleOf>;
  schedule: () => void;
  setHovered: (vertex: VertexId | null) => void;
}

/** The only part that re-renders on a hover: the canvas and its labels do not. */
function HoverCard({ cardRef, styles, domain, encoding, options, scale, schedule, setHovered }: HoverCardProps) {
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
    <div className={styles.card()} data-slot="graph-canvas-card" ref={cardRef} style={ORIGIN}>
      <ShapeGlyph className={styles.cardGlyph()} color={scale.color(rank)} shape={scale.shape(rank)} />
      <span className={styles.cardTitle()}>{titles.get(hovered) || `#${hovered}`}</span>
      <Show when={category !== null}>
        <span className={styles.cardDetail()}>{category}</span>
      </Show>
    </div>
  );
}
