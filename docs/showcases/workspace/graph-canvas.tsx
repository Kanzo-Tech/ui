"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Graph } from "@cosmos.gl/graph";
import { useMosaic } from "@kanzo-tech/ui/analytics";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Show,
  Spinner,
  cn,
} from "@kanzo-tech/ui";
import {
  LassoIcon,
  MaximizeIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
  SquareDashedIcon,
  XIcon,
} from "lucide-react";
import { CosmosClient } from "@/lib/cosmos-client";
import { LOOKS, SHAPE, SHAPE_PATH, type Look, type ShapeId } from "./graph-looks";
import {
  load,
  scaleOf,
  type Loaded,
  type NodeRow,
} from "./graph-model";
import { useCosmosGraph } from "./use-cosmos-graph";
import { useGraphLook } from "./use-graph-look";
import { GRID, useGraphOverlays } from "./use-graph-overlays";
import { cursorChip, useGraphSelection } from "./use-graph-selection";
import {
  KINDS,
  useGraphView,
  type Motion,
  type Selection,
  type SelectionSource,
} from "./graph-state";

/**
 * The chrome that floats over the canvas.
 *
 * The surface belongs to the group and the buttons inside are `ghost`, because giving the group a
 * card background *and* the buttons an `outline` border draws the box twice — invisible on a pale
 * page, and on a dark canvas a washed-out slab with see-through buttons sitting on it.
 *
 * The cost of that is real: `ButtonGroup` segments a cluster by collapsing its children's *shared
 * borders*, and ghost buttons have none to collapse. So the divisions come back as explicit
 * `ButtonGroupSeparator`s. And the radius matches `Button`'s own `rounded-lg` — at `rounded-md` the
 * group's corner and the corner a button reveals on hover were visibly different curves.
 */
const FLOATING = "rounded-lg border bg-card/85 shadow-sm backdrop-blur-md";

/**
 * The energy a wake puts back into a converged layout — enough to reorganise around a changed
 * force, not so much that the picture you were reading is thrown away. A full `start(1)` is what
 * Re-run is for.
 */
const REHEAT = 0.35;

/**
 * The canvas: cosmos.gl driving the picture, Mosaic driving the questions.
 *
 * Nothing here queries on a gesture. The relation is read once into the four typed arrays the GPU
 * wants; after that a zoom, a drag, a look or a force slider is `setConfig` and a buffer upload.
 * Only two things cross back into SQL — the lasso and a click, both as `id IN (…)` — and both go
 * through `CosmosClient`, which is a `MosaicClient` and therefore indistinguishable to the
 * crossfilter from a brushed histogram.
 */

// ── Look → buffers ───────────────────────────────────────────────────────────

// ── Canvas ───────────────────────────────────────────────────────────────────

interface Hovered {
  index: number;
  row: NodeRow;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

interface Hovered {
  index: number;
  row: NodeRow;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

interface Hovered {
  index: number;
  row: NodeRow;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

interface Hovered {
  index: number;
  row: NodeRow;
}

/**
 * The canvas mounts only once DuckDB is up, because everything below it reads the coordinator and
 * `MosaicProvider` is not in the tree until then. Same guard the Rules and Ask panels use.
 */
/**
 * The canvas before it is a canvas.
 *
 * Not a `Skeleton`: a skeleton stands in for content whose shape you can predict, and a graph has
 * no predictable shape — a big grey slab just tells the reader the page is broken. What it shows
 * instead is the canvas it is about to become, in the current look, with the same dot grid, and one
 * line saying what is taking the time.
 */
function CanvasPlaceholder({ look, note }: { look: Look; note: string }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: `${GRID}px ${GRID}px`,
        }}
      />
      <p
        className={cn(
          "relative flex items-center gap-2 text-xs",
          "text-muted-foreground",
        )}
      >
        <Spinner className="size-3.5" />
        {note}
      </p>
    </div>
  );
}

export function GraphCanvas() {
  const { look, ready } = useGraphView();
  if (!ready) {
    return <CanvasPlaceholder look={LOOKS[look]} note="Starting DuckDB…" />;
  }
  return <CanvasBody />;
}

function CanvasBody() {
  const {
    look: lookId,
    display,
    sim,
    spec,
    tool,
    setTool,
    setMotion,
    setFocused,
    selection,
    select,
    setCorpus,
    register,
  } = useGraphView();
  const { coordinator, crossfilter } = useMosaic();
  const look = LOOKS[lookId];

  const canvasRef = useRef<HTMLDivElement>(null);
  const graphAccess = useCallback(() => graphRef.current, []);
  const { cardRef, gridRef, hostRef, labelRef, schedule, setHovered: trackHovered, setLabelOrder } =
    useGraphOverlays(graphAccess);
  const graphRef = useRef<Graph | null>(null);
  const clientRef = useRef<CosmosClient | null>(null);
  const dataRef = useRef<Loaded | null>(null);

  const [data, setData] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [tracked, setTracked] = useState<number[]>([]);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Callbacks are handed to cosmos.gl once, at construction, so they read the current render
  // through a ref instead of closing over a stale one.
  const handlers = useRef({ setMotion, setFocused, select });
  handlers.current = { setMotion, setFocused, select };

  /**
   * What the layout is doing, mirrored where the imperative side can read it.
   *
   * The panels get this through context; the transport needs it inside a callback that must not
   * re-subscribe on every state change, and cosmos.gl's own getters are not a substitute — see
   * `resume` below for why the distinction it encodes cannot be recovered from them.
   */
  const motionRef = useRef<Motion>("running");
  const report = useCallback((next: Motion) => {
    motionRef.current = next;
    handlers.current.setMotion(next);
  }, []);

  /**
   * A gesture's result, handed to the shared selection.
   *
   * Add and subtract read the live selection through a ref rather than the closure, because the
   * gesture handlers are installed once and a pointer-up must act on what is selected *now*.
   */
  const live = useRef<Selection | null>(selection);
  live.current = selection;

  const commit = useCallback((ids: Set<number> | null, source: SelectionSource, label: string) => {
    if (!ids || ids.size === 0) {
      setFocusedIndex(null);
      handlers.current.setFocused(null);
      graphRef.current?.setConfig({ focusedPointIndex: undefined });
      handlers.current.select(null);
      return;
    }
    handlers.current.select({ ids: [...ids], source, label });
  }, []);


  useEffect(() => {
    let live = true;
    load(coordinator, spec).then(
      (next) => {
        if (!live) return;
        dataRef.current = next;
        setCorpus(next.ids.length);
        setData(next);
      },
      (error: unknown) => {
        if (live) setFailure(String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [coordinator, setCorpus, spec]);


  // The crossfilter's observable half: whatever survives the page's filters stays lit.
  useEffect(() => {
    if (!data) return;
    const client = new CosmosClient({
      table: spec.table,
      idField: spec.idField,
      filterBy: crossfilter,
      as: crossfilter,
      onSurvivors: (ids) => {
        const graph = graphRef.current;
        const current = dataRef.current;
        if (!graph || !current) return;
        if (ids.length === current.ids.length) {
          graph.unselectPoints();
        } else {
          const indices: number[] = [];
          for (const id of ids) {
            const i = current.index.get(Number(id));
            if (i !== undefined) indices.push(i);
          }
          graph.selectPointsByIndices(indices);
        }
        graph.render();
      },
    });
    clientRef.current = client;
    coordinator.connect(client);
    return () => {
      clientRef.current = null;
      client.publish(null);
      coordinator.disconnect(client);
    };
  }, [coordinator, crossfilter, data, spec]);

  /**
   * The selection, as SQL. The only place anything in this app publishes one — a panel hands a
   * value to the provider and this turns it into `id IN (…)`.
   */
  useEffect(() => {
    clientRef.current?.publish(selection ? selection.ids : null);
  }, [selection, data]);

  // Which nodes carry a standing label: the look's budget of hubs, plus whatever is focused.
  useEffect(() => {
    if (!data) return;
    if (!display.labels) {
      setLabelOrder([]);
      setTracked([]);
      return;
    }
    // Importance order, and it matters: the declutter pass places labels in this order and drops
    // whichever would collide with one already down, so the hubs win the crowded spots.
    //
    // The hovered node is deliberately NOT here. Adding it rebuilt the tracked set on every pointer
    // move, which re-mounted spans mid-gesture and made the labels flicker — and the hover card
    // already names the node under the cursor.
    const wanted = focusedIndex === null ? [] : [focusedIndex];
    for (const index of data.ranked.slice(0, look.form.labels)) {
      if (index !== focusedIndex) wanted.push(index);
    }
    setLabelOrder(wanted);
    setTracked(wanted);
    schedule();
  }, [data, display.labels, look.form.labels, focusedIndex, schedule, setLabelOrder]);

  // An overlay that has just mounted has no transform yet, and the simulation may already be
  // asleep — so nothing would place it until the next zoom. Place it now.
  useEffect(() => {
    schedule();
  }, [tracked, hovered, display.grid, schedule]);

  // What the panels can ask of the canvas.
  useEffect(() => {
    register({
      zoomBy: (factor) => {
        const graph = graphRef.current;
        if (!graph) return;
        graph.setZoomLevel(graph.getZoomLevel() * factor, 220);
        schedule();
      },
      fit: () => {
        graphRef.current?.fitView(420, 0.18);
        schedule();
      },
      pause: () => graphRef.current?.pause(),
      /**
       * Make it move again — whatever "again" means from here.
       *
       * `unpause()` is the inverse of `pause()`, not of "stopped": it flips the running flag and
       * adds no energy. A converged layout has spent its alpha, so unpausing it ends it again on
       * the next step and the button does nothing. Waking one needs energy, which is `start`.
       *
       * The panels ask for the intent and this decides the mechanism — a caller should not have to
       * know that cosmos.gl has two different kinds of stopped.
       */
      resume: () => {
        const graph = graphRef.current;
        if (!graph) return;
        if (motionRef.current === "settled") graph.start(REHEAT);
        else graph.unpause();
      },
      restart: () => graphRef.current?.start(1),
      /**
       * The same thing a click on the canvas does, plus the camera.
       *
       * It used to only move the view, which is why "find this node" from the inspector and
       * "click this node" on the canvas left the app in two different states for what the reader
       * experiences as one action.
       */
      reveal: (id) => {
        const graph = graphRef.current;
        const current = dataRef.current;
        if (!graph || !current) return;
        const index = current.index.get(id);
        if (index === undefined) return;
        const ids = new Set([id]);
        for (const neighbour of graph.getAdjacentIndices(index) ?? []) {
          const value = current.ids[neighbour];
          if (value !== undefined) ids.add(value);
        }
        commit(ids, "node", current.rows[index]?.label ?? "Node");
        setFocusedIndex(index);
        handlers.current.setFocused(id);
        graph.setConfig({ focusedPointIndex: index });
        graph.zoomToPointByIndex(index, 500, 5, true);
        schedule();
      },
      frameSelection: () => {
        const graph = graphRef.current;
        const current = dataRef.current;
        if (!graph || !current) return;
        const indices: number[] = [];
        for (const id of live.current?.ids ?? []) {
          const index = current.index.get(id);
          if (index !== undefined) indices.push(index);
        }
        if (indices.length === 0) return;
        graph.fitViewByPointIndices(indices, 420, 0.25);
        schedule();
      },
      clear: () => commit(null, "node", ""),
    });
    return () => register(null);
  }, [commit, register, schedule]);

  useGraphLook({ data, display, getGraph: graphAccess, hostRef, look, schedule });

  useCosmosGraph({
    data,
    events: {
      onBackgroundClick: () => commit(null, "node", ""),
      onPointClick: (instance, index) => {
        const current = dataRef.current;
        if (!current) return;
        const id = current.ids[index];
        if (id === undefined) return;
        // A node and what it touches: the honest reading of "show me this one", and the same clause
        // shape the marquee publishes, so every other panel understands it already.
        const row = current.rows[index];
        const ids = new Set([id]);
        for (const neighbour of instance.getAdjacentIndices(index) ?? []) {
          const value = current.ids[neighbour];
          if (value !== undefined) ids.add(value);
        }
        commit(ids, "node", row?.label ?? "Node");
        setFocusedIndex(index);
        handlers.current.setFocused(id);
        instance.setConfig({ focusedPointIndex: index });
      },
      onPointerOut: () => {
        trackHovered(null);
        setHovered(null);
      },
      onPointerOver: (index) => {
        const row = dataRef.current?.rows[index];
        if (!row) return;
        trackHovered(index);
        setHovered({ index, row });
      },
      onTick: schedule,
      onZoom: schedule,
    },
    graphRef,
    hostRef: canvasRef,
    onFailure: setFailure,
    report,
    sim,
  });

  const gesture = useGraphSelection({
    commit,
    getData: useCallback(() => dataRef.current, []),
    getGraph: graphAccess,
    getSelection: useCallback(() => live.current, []),
    setTool,
    tool,
  });
  const { active, drag, preview } = gesture;

  // The same scale the GPU buffers are built from, so the hover card's glyph cannot disagree with
  // the point it is describing.
  const scale = useMemo(() => scaleOf(look, data?.categories ?? []), [look, data]);


  return (
    <div
      className="absolute inset-0 overflow-hidden"
      ref={hostRef}
      style={{ background: "var(--background)" }}
    >
      {failure ? (
        <div className="grid size-full place-items-center p-6">
          <p className="max-w-sm text-center text-destructive text-sm">{failure}</p>
        </div>
      ) : data ? (
        <>
          <div className="size-full" ref={canvasRef} />

          {/* Decoration, over the canvas rather than behind it: cosmos.gl paints an opaque
              background so its greyout maths knows what it is dimming against. */}
          <Show when={display.grid}>
            <div
              className="pointer-events-none absolute inset-0"
              ref={gridRef}
              style={{
                backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
                backgroundSize: `${GRID}px ${GRID}px`,
              }}
            />
          </Show>
          <Show when={look.form.vignette}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, rgba(2,4,10,0.72) 100%)",
              }}
            />
          </Show>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Show when={display.labels}>
              {tracked.map((index) => {
                const row = data.rows[index];
                if (!row) return null;
                return (
                  <span
                    className={cn(
                      "absolute top-0 left-0 whitespace-nowrap font-medium text-[10px] leading-none opacity-0 transition-opacity",
                      // One tone, because there is one plane now. The white variant existed for
                      // Nebula's fixed dark canvas; the halo is the theme's own background, so it
                      // reads on either side of the flip without a look having to say which.
                      "text-foreground/75 [text-shadow:0_0_3px_var(--background),0_0_6px_var(--background)]",
                    )}
                    key={index}
                    ref={labelRef(index)}
                  >
                    {row.label}
                  </span>
                );
              })}
            </Show>

            {hovered ? (
              <div
                className="absolute top-0 left-0 w-max max-w-60 overflow-hidden rounded-lg border bg-popover/95 opacity-0 shadow-lg backdrop-blur-md"
                ref={cardRef}
              >
                {/* The glyph is the one the canvas drew for this kind, so the tooltip, the legend
                    and the point on screen are visibly the same claim. */}
                <div className="flex items-center gap-2 border-b px-2.5 py-2">
                  <ShapeGlyph
                    color={scale.color(hovered.row.category)}
                    shape={scale.shape(hovered.row.category)}
                  />
                  <p className="truncate font-medium text-popover-foreground text-sm leading-none">
                    {hovered.row.label}
                  </p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2.5 py-2 text-xs">
                  <dt className="text-muted-foreground">
                    {KINDS[hovered.row.category]?.label ? "Kind" : "Category"}
                  </dt>
                  <dd className="text-end">
                    {KINDS[hovered.row.category]?.label ?? hovered.row.category}
                  </dd>
                  {hovered.row.details.map((detail) => (
                    <Fragment key={detail.label}>
                      <dt className="text-muted-foreground">{detail.label}</dt>
                      <dd className="truncate text-end">{detail.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          <Show when={active !== null}>
            <div
              className="absolute inset-0 cursor-crosshair"
              {...gesture.handlers}
            >
              <Show when={drag !== null}>
                <svg className="pointer-events-none size-full">
                  {drag?.tool === "rect" ? (
                    <rect
                      className="fill-primary/10 stroke-primary"
                      height={Math.abs(drag.to[1] - drag.from[1])}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      width={Math.abs(drag.to[0] - drag.from[0])}
                      x={Math.min(drag.from[0], drag.to[0])}
                      y={Math.min(drag.from[1], drag.to[1])}
                    />
                  ) : null}
                  {drag?.tool === "lasso" && drag.path.length > 1 ? (
                    <>
                      <polygon
                        className="fill-primary/10 stroke-primary"
                        points={drag.path.map(([x, y]) => `${x},${y}`).join(" ")}
                        strokeWidth={1}
                      />
                      {/* The segment the reader has not drawn yet. Showing it is what makes a
                          half-finished stroke read as a loop rather than as a line. */}
                      <line
                        className="stroke-primary/50"
                        strokeDasharray="3 4"
                        strokeWidth={1}
                        x1={drag.path[drag.path.length - 1]?.[0]}
                        x2={drag.path[0]?.[0]}
                        y1={drag.path[drag.path.length - 1]?.[1]}
                        y2={drag.path[0]?.[1]}
                      />
                    </>
                  ) : null}
                </svg>
              </Show>

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
        </>
      ) : (
        <CanvasPlaceholder look={look} note="Reading the corpus…" />
      )}
    </div>
  );
}

// ── Canvas chrome ────────────────────────────────────────────────────────────

/** A small filled glyph of the shape the canvas draws for a kind. */
export function ShapeGlyph({
  className,
  color,
  shape,
}: {
  className?: string;
  color: string;
  shape: ShapeId;
}) {
  return (
    <svg className={cn("size-2.5 shrink-0", className)} viewBox="0 0 12 12">
      <path d={SHAPE_PATH[shape]} fill={color} />
    </svg>
  );
}

/**
 * The selection tools — the only control on the canvas that changes what a gesture *means*, which
 * is why it sits alone at the corner your hand is already heading for.
 *
 * Not a `SegmentGroup`: that always has exactly one member selected, and "no tool" is the posture
 * you spend most of your time in.
 */
const TOOLS = [
  { id: "rect", label: "Marquee", icon: SquareDashedIcon, hint: "Drag a box — or just hold Shift" },
  { id: "lasso", label: "Lasso", icon: LassoIcon, hint: "Draw a loop around a cluster" },
] as const;

export function GraphToolbar() {
  const { ready, setTool, tool } = useGraphView();
  return (
    <ButtonGroup
      aria-label="Selection tool"
      className={cn(FLOATING, "absolute end-2 top-2 z-10")}
    >
      {TOOLS.map((entry, i) => (
        <Fragment key={entry.id}>
          <Show when={i > 0}>
            <ButtonGroupSeparator />
          </Show>
          <Button
            aria-label={entry.label}
            aria-pressed={tool === entry.id}
            disabled={!ready}
            onClick={() => setTool(tool === entry.id ? null : entry.id)}
            size="icon-sm"
            title={entry.hint}
            variant={tool === entry.id ? "default" : "ghost"}
          >
            <entry.icon />
          </Button>
        </Fragment>
      ))}
    </ButtonGroup>
  );
}

/**
 * What the canvas is holding, and the two things you can do with it.
 *
 * Also a `ButtonGroup`: the count is a `ButtonGroupText`, which is what that part exists for — a
 * label living inside the cluster rather than a `<span>` bolted to its side.
 *
 * It appears only when there is a selection, so the reading posture leaves the canvas clean. The
 * number is the canvas' own clause, not the crossfilter's resolved total — the footer already
 * reports that, and other panels write to it too.
 */
/** What each origin is called, so the corner can say where the selection came from. */
const SOURCE_NAME: Record<SelectionSource, string> = {
  marquee: "Marquee",
  lasso: "Lasso",
  node: "Node",
  rule: "Rule",
  ask: "Ask",
};

export function GraphSelection() {
  const { commands, corpus, selection } = useGraphView();
  if (!selection) return null;
  return (
    <ButtonGroup
      aria-label="Current selection"
      className={cn(FLOATING, "absolute start-2 top-2 z-10")}
    >
      <ButtonGroupText className="gap-1.5 ps-1.5 pe-2 text-xs">
        <Badge className="text-[10px]" size="xs" variant="secondary">
          {SOURCE_NAME[selection.source]}
        </Badge>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">
            {selection.ids.length.toLocaleString()}
          </span>
          {corpus === null ? " selected" : ` of ${corpus.toLocaleString()} selected`}
        </span>
      </ButtonGroupText>
      <ButtonGroupSeparator />
      <Button
        aria-label="Frame the selection"
        onClick={() => commands.frameSelection()}
        size="icon-sm"
        title="Frame the selection"
        variant="ghost"
      >
        <ScanIcon />
      </Button>
      <Button
        aria-label="Clear the selection"
        onClick={() => commands.clear()}
        size="icon-sm"
        title="Clear the selection"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </ButtonGroup>
  );
}

/**
 * The bottom-end corner: everything that moves the picture without changing what it says.
 *
 * Two vertical `ButtonGroup`s stacked — the camera, and the layout's transport. Two groups rather
 * than one split by a separator, for the reason a group is a claim: zooming and pausing a
 * simulation are not the same job. The transport lives here and not beside the selection tools
 * because it belongs with the camera — both answer "what is the view doing", while a tool answers
 * "what does my drag do".
 *
 * Paused is stated, not implied: a converged graph and a stopped one look identical, so the button
 * turns solid and the footer says which one you are looking at.
 */
/**
 * One action per state, and the control names the one you are about to get. A layout that has
 * converged is not paused, so offering "Resume" there would promise something `unpause` cannot do.
 */
const TRANSPORT: Record<Motion, { action: "pause" | "resume"; label: string }> = {
  running: { action: "pause", label: "Pause the layout" },
  paused: { action: "resume", label: "Resume the layout" },
  settled: { action: "resume", label: "Wake the layout — it has settled" },
};

export function GraphZoom() {
  const { commands, motion, ready } = useGraphView();
  const transport = TRANSPORT[motion];

  return (
    <div className="absolute end-2 bottom-2 z-10 flex flex-col items-end gap-1.5">
      <ButtonGroup aria-label="Layout" className={FLOATING} orientation="vertical">
        <Button
          aria-label={transport.label}
          aria-pressed={motion === "paused"}
          disabled={!ready}
          onClick={() => (transport.action === "pause" ? commands.pause() : commands.resume())}
          size="icon-sm"
          title={transport.label}
          variant={motion === "paused" ? "default" : "ghost"}
        >
          {motion === "running" ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Re-run the layout"
          disabled={!ready}
          onClick={() => commands.restart()}
          size="icon-sm"
          title="Re-run the layout"
          variant="ghost"
        >
          <RotateCcwIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup
        aria-label="Zoom and fit"
        className={FLOATING}
        orientation="vertical"
      >
        <Button
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => commands.zoomBy(1.4)}
          size="icon-sm"
          variant="ghost"
        >
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => commands.zoomBy(1 / 1.4)}
          size="icon-sm"
          variant="ghost"
        >
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Fit to view"
          disabled={!ready}
          onClick={() => commands.fit()}
          size="icon-sm"
          variant="ghost"
        >
          <MaximizeIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
}
