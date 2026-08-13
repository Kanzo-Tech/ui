"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Graph } from "@cosmos.gl/graph";
import { Query } from "@uwdata/mosaic-sql";
// `useChartCapacity` sits on the root barrel and the database half does not: anything painting
// from tokens needs the first, only a Mosaic consumer needs the second.
import { useChartCapacity } from "@kanzo-tech/ui";
import { Coordinator, IdSetClient, useMosaic } from "@kanzo-tech/ui/analytics";
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
  PinOffIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
  SquareDashedIcon,
  XIcon,
} from "lucide-react";
import {
  cursorChip,
  GRID,
  LOOKS,
  neighboursOf,
  REHEAT,
  scaleOf,
  SHAPE_PATH,
  onceQuery,
  type ShapeId,
  type Slice,
  useBoundedGraph,
  useCosmosGraph,
  useGraphLook,
  useGraphOverlays,
  useGraphSelection,
} from "@kanzo-tech/graph";
import { duckBoundedSource } from "@kanzo-tech/graph/duckdb";
import {
  KINDS,
  useGraphView,
  type GraphSpec,
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
 *
 * **Solid, not `bg-card/85 backdrop-blur-md`.** A panel is an occluder, not a veil, and a diluted
 * surface is a function of whatever the layout happened to put behind it: measured over the plane
 * and the eight slots, `card/85` spans ΔE 9.4–11.1 and the legend's `card/80` spans 12.6–14.0 —
 * two ramp steps of drift in a token whose whole job is to be one colour, against the ramp's own
 * `interchangeable` bound of 4. An alpha step cannot rescue it either, and that is measured in the
 * theme rather than guessed here: at the surface band the alpha reproducing a raised step is 0–8
 * bytes, so a `--popover` bound to one shows the page's own text through itself.
 */
const FLOATING = "rounded-lg border bg-card shadow-sm";

/**
 * The wash a selection region wears — an **alpha step**, not a diluted solid.
 *
 * This is the consumer alpha steps were built for: the canvas draws over arbitrary content, so
 * `fill-primary/10` composites against whatever is underneath. Measured against the brand's own
 * step 5 over the canvas plane: the dilution misses by ΔE 2.8 (achromatic seed) to **10.6** (teal
 * and orange seeds, dark), while the alpha step lands at 0.8–1.5 — which is `alpha-fidelity`, the
 * obligation it was solved under, doing exactly what it promises.
 *
 * `--selection` is `(brand, alpha 5)` — `#0000001f` light, `#ffffff1d` dark in the shipped
 * document. It is not an editor token that the graph borrows: selecting text and selecting nodes
 * are one decision, so the role table carries one name for both.
 */
const SELECTION_WASH = "var(--brand-a5)";

/**
 * The canvas: cosmos.gl driving the picture, Mosaic driving the questions.
 *
 * Nothing here queries on a gesture. The relation is read once into the four typed arrays the GPU
 * wants; after that a zoom, a drag, a look or a force slider is `setConfig` and a buffer upload.
 * Only two things cross back into SQL — the lasso and a click, both as `id IN (…)` — and both go
 * through `IdSetClient`, which is a `MosaicClient` and therefore indistinguishable to the
 * crossfilter from a brushed histogram.
 */

// ── Canvas ───────────────────────────────────────────────────────────────────


/**
 * The canvas before it is a canvas.
 *
 * Not a `Skeleton`: a skeleton stands in for content whose shape you can predict, and a graph has
 * no predictable shape — a big grey slab just tells the reader the page is broken. What it shows
 * instead is the canvas it is about to become, with the same plane and the same dot grid, and one
 * line saying what is taking the time. It took a `look` and never read it: nothing a look carries
 * is visible before there are points to draw.
 */
function CanvasPlaceholder({ note }: { note: string }) {
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
  const { ready } = useGraphView();
  if (!ready) {
    return <CanvasPlaceholder note="Starting DuckDB…" />;
  }
  return <CanvasBody />;
}

/** One node, as a reader reads it. Fetched per handful of ids, never carried by a slice. */
interface Detail {
  label: string;
  category: string;
  details: { label: string; value: string }[];
}

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: a DATE column arrives as a
 * `Date`, and rendering one crashes React with "Objects are not valid as a React child".
 */
export function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

/**
 * The rows behind a handful of ids — ADR-0001's "detail is fetched, not carried", as a hook.
 *
 * A slice is geometry: positions, links, category ordinals, ids. It deliberately does not carry
 * twenty thousand labels so that three can be read, and it cannot carry a publisher or an issue date
 * at all. So the two places that need words ask for them: the label budget asks about the handful it
 * is about to draw, and the hover card asks about one node.
 *
 * Debounced, because the hover case is a pointer stream. This is the user-visible regression the ADR
 * named and accepted — a card that used to be a property lookup now waits — and against an in-tab
 * WASM query it is brief but not zero.
 *
 * The query is `id IN (…)` over a handful, so it is a point lookup and not a scan.
 */
function useDetails(
  coordinator: Coordinator,
  spec: GraphSpec,
  ids: number[],
  debounceMs = 90,
): Map<number, Detail> {
  const [details, setDetails] = useState<Map<number, Detail>>(new Map());
  const key = ids.join(",");

  useEffect(() => {
    if (key === "") {
      setDetails(new Map());
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      const columns: Record<string, string> = {
        id: spec.idField,
        label: spec.labelField,
        category: spec.categoryField,
      };
      for (const detail of spec.detailFields ?? []) columns[`d_${detail.field}`] = detail.field;
      void onceQuery(coordinator, () =>
        Query.from(spec.table).select(columns).where(`${spec.idField} IN (${key})`),
      ).then(
        (rows) => {
          if (!live) return;
          const next = new Map<number, Detail>();
          for (const row of rows as Iterable<Record<string, unknown>>) {
            next.set(Number(row.id), {
              label: text(row.label),
              category: text(row.category),
              details: (spec.detailFields ?? [])
                .map((detail) => ({ label: detail.label, value: text(row[`d_${detail.field}`]) }))
                .filter((detail) => detail.value !== ""),
            });
          }
          setDetails(next);
        },
        () => {
          // A detail that will not load is a card without a subtitle, not a broken canvas.
        },
      );
    }, debounceMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [coordinator, debounceMs, key, spec]);

  return details;
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
    setProgress,
    setFocused,
    selection,
    select,
    setCorpus,
    setPinned,
    register,
  } = useGraphView();
  const { coordinator, crossfilter } = useMosaic();
  const look = LOOKS[lookId];

  const canvasRef = useRef<HTMLDivElement>(null);
  const graphAccess = useCallback(() => graphRef.current, []);
  const {
    cardRef,
    gridRef,
    hostRef,
    labelRef,
    schedule,
    setHovered: trackHovered,
    setLabelOrder,
    track,
  } = useGraphOverlays(graphAccess);
  const graphRef = useRef<Graph | null>(null);
  const clientRef = useRef<IdSetClient | null>(null);
  const sliceRef = useRef<Slice | null>(null);

  const [failure, setFailure] = useState<string | null>(null);
  const [tracked, setTracked] = useState<number[]>([]);
  /**
   * What the pointer is over: an id for the detail query, and the index for the glyph.
   *
   * Both, because they answer different questions. The id survives a slice and is what a fetch is
   * keyed on; the index is a position in the buffers the GPU is drawing right now, which is how the
   * card's glyph reads the *canvas's own* category ordinal rather than re-deriving one from a name
   * and hoping the two agree.
   */
  const [pointer, setPointer] = useState<{ id: number; index: number } | null>(null);
  const hoveredId = pointer?.id ?? null;
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Callbacks are handed to cosmos.gl once, at construction, so they read the current render
  // through a ref instead of closing over a stale one.
  const handlers = useRef({ setMotion, setProgress, setFocused, setPinned, select });
  handlers.current = { setMotion, setProgress, setFocused, setPinned, select };

  /**
   * The nodes the reader has dropped somewhere and meant it.
   *
   * `enableDrag` moves a point while the pointer is down and nothing more — the position shader
   * integrates velocity again the moment the gesture ends, so a released node springs back to
   * wherever the forces wanted it and the drag was a gesture with no result. `setPinnedPoints`
   * makes it one: a pinned point holds its position and still pulls on everything attached to it,
   * which is what a reader means by putting a node somewhere.
   *
   * A ref, and a whole-set call, because cosmos.gl's API is a replacement rather than a toggle —
   * `setPinnedPoints` overwrites `inputPinnedPoints` outright, so the set has to be ours.
   *
   * **Held as ids, not indices.** cosmos.gl speaks indices and this used to store them, which was
   * correct exactly as long as the corpus arrived once. Under a bounded path index 7 is a different
   * node after every pan, so a pinned set of indices would silently pin whatever moved into those
   * slots. Ids are re-resolved against each slice on the way to the GPU — and they are also what
   * rides along in the query, so a node dragged off screen comes back with the next answer.
   */
  const pins = useRef(new Set<number>());

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
  const reportProgress = useCallback((value: number) => {
    handlers.current.setProgress(value);
  }, []);

  /**
   * A gesture's result, handed to the shared selection.
   *
   * Add and subtract read the live selection through a ref rather than the closure, because the
   * gesture handlers are installed once and a pointer-up must act on what is selected *now*.
   */
  const live = useRef<Selection | null>(selection);
  live.current = selection;

  /**
   * Where each id sits in the slice on screen right now, and `undefined` for the ones that do not.
   *
   * Rebuilt per slice rather than kept, because that is what a slice index means: a position in
   * *this* answer. Everything that outlives one answer — the selection, the focus, the pins — is
   * held as ids and comes back through here.
   */
  const localRef = useRef<Map<number, number>>(new Map());

  /** The pinned ids, as state, because the query loop carries them and must re-ask when they move. */
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  /** Hand the pin set to the GPU — resolved to this slice — and tell the panels how big it is. */
  const applyPins = useCallback(() => {
    const ids = [...pins.current];
    const indices: number[] = [];
    for (const id of ids) {
      const index = localRef.current.get(id);
      if (index !== undefined) indices.push(index);
    }
    graphRef.current?.setPinnedPoints(indices.length > 0 ? indices : null);
    handlers.current.setPinned(ids.length);
    setPinnedIds(ids);
  }, []);

  /** Drop the focus ring. A ring on a node nobody picked is a claim the selection is not making. */
  const unfocus = useCallback(() => {
    setFocusedIndex(null);
    handlers.current.setFocused(null);
    graphRef.current?.setConfigPartial({ focusedPointIndex: undefined });
  }, []);

  const commit = useCallback(
    (ids: Set<number> | null, source: SelectionSource, label: string) => {
      if (!ids || ids.size === 0) {
        unfocus();
        handlers.current.select(null);
        return;
      }
      // A marquee or a lasso selects without picking a node, so the ring from whatever was clicked
      // before has nothing left to point at. This used to clear only on the empty branch, which left
      // a stale ring under every region gesture. The node paths re-focus after this returns.
      // (Orders and Ask do not come through here — they hand a selection straight to the provider.)
      if (source !== "node") unfocus();
      // Dim now, not after the round trip. The authority on what stays lit is `onSurvivors` below —
      // it resolves this clause against every other filter on the page — but that answer is a
      // crossfilter update and a DuckDB query away, and the reader drew this loop a frame ago.
      // Greyout is a texture upload the next frame samples, so the optimistic answer costs nothing
      // and the correction overwrites it.
      const graph = graphRef.current;
      if (graph) {
        const indices: number[] = [];
        for (const id of ids) {
          const index = localRef.current.get(id);
          if (index !== undefined) indices.push(index);
        }
        graph.setConfigPartial({ highlightedPointIndices: indices });
      }
      handlers.current.select({ ids: [...ids], source, label });
    },
    [unfocus],
  );

  /**
   * The corpus, as something to ask rather than something to hold.
   *
   * Two relations and a spatial predicate — which is all this fixture is. The source is memoised on
   * the spec because rebuilding it would restart the query loop, and the loop's own first act is to
   * ask how big the graph is.
   */
  const source = useMemo(
    () =>
      duckBoundedSource({
        coordinator,
        nodes: spec.table,
        edges: spec.edges,
        idField: spec.idField,
        xField: spec.xField,
        yField: spec.yField,
        categoryField: spec.categoryField,
        sizeField: spec.sizeField,
      }),
    [coordinator, spec],
  );

  const { slice, total, refresh } = useBoundedGraph({
    graphRef,
    hostRef: canvasRef,
    onError: setFailure,
    pinned: pinnedIds,
    source,
  });

  // The lookups every callback needs, kept where a callback installed once can still read them.
  sliceRef.current = slice;
  const totalRef = useRef<number | undefined>(undefined);
  totalRef.current = total;
  useEffect(() => {
    const map = new Map<number, number>();
    if (slice) for (let i = 0; i < slice.ids.length; i++) map.set(slice.ids[i] as number, i);
    localRef.current = map;
  }, [slice]);

  useEffect(() => {
    if (total !== undefined) setCorpus(total);
  }, [setCorpus, total]);


  // The crossfilter's observable half: whatever survives the page's filters stays lit.
  useEffect(() => {
    const client = new IdSetClient({
      table: spec.table,
      idField: spec.idField,
      filterBy: crossfilter,
      as: crossfilter,
      // Greyout is a config field, not a call: `highlightedPointIndices` greys everything *not* in
      // the array, and `undefined` clears it. So the survivor set is stated rather than applied, and
      // there is no `render()` to pair with it — `setConfigPartial` ends in `requestRender()`, which
      // is also what wakes the loop now that 3.4.0 stops drawing when nothing changes. A `render()`
      // here would additionally pay for a full `GraphData.update()` — an O(n+e) revalidation that
      // rebuilds the adjacency lists and recomputes every degree — on every crossfilter change.
      //
      // The survivor set is the *corpus's*, and the greyout is the *slice's* — so the comparison
      // that decides "nothing is filtered" is against the total rather than against what is drawn.
      // Comparing it to the slice would read a full survivor set as a filter every time the camera
      // was over fewer nodes than the corpus holds, which is almost always.
      onSurvivors: (ids) => {
        const graph = graphRef.current;
        if (!graph) return;
        if (totalRef.current !== undefined && ids.length === totalRef.current) {
          graph.setConfigPartial({ highlightedPointIndices: undefined });
          return;
        }
        const indices: number[] = [];
        for (const id of ids) {
          const i = localRef.current.get(Number(id));
          if (i !== undefined) indices.push(i);
        }
        graph.setConfigPartial({ highlightedPointIndices: indices });
      },
    });
    clientRef.current = client;
    coordinator.connect(client);
    return () => {
      clientRef.current = null;
      client.publish(null);
      coordinator.disconnect(client);
    };
  }, [coordinator, crossfilter, spec]);

  /**
   * The selection, as SQL. The only place anything in this app publishes one — a panel hands a
   * value to the provider and this turns it into `id IN (…)`.
   */
  useEffect(() => {
    clientRef.current?.publish(selection ? selection.ids : null);
  }, [selection, slice]);

  /**
   * Which nodes carry a standing label: the look's budget of hubs *in this slice*, plus the focus.
   *
   * `ranked` is gone with `load()`, and the ADR is explicit that this is a real loss rather than a
   * refactor: a whole-corpus load sorts every node once and spends the budget from the front, and a
   * slice knows only its own points. So "the most important labels" stops being a property of the
   * corpus and becomes one of the answer — the biggest nodes *here*.
   *
   * That is a different claim, and on balance a better one: a reader looking at a corner of a graph
   * is asking about the corner. It does mean a hub keeps its label only while it is on screen.
   *
   * The hovered node is deliberately NOT here. Adding it rebuilt the *label* list on every pointer
   * move, which re-mounted spans mid-gesture and made the labels flicker — and the hover card
   * already names the node under the cursor. It is in cosmos.gl's tracked set, which is a texture
   * and not a subtree; that is `track` below.
   */
  useEffect(() => {
    if (!slice) return;
    if (!display.labels) {
      setLabelOrder([]);
      setTracked([]);
      return;
    }
    const budget = look.form.labels;
    const ramp = slice.sizes;
    // Importance order, and it matters: the declutter pass places labels in this order and drops
    // whichever would collide with one already down, so the hubs win the crowded spots. Without a
    // ramp there is no importance to speak of, and the first N is as honest as any other N.
    const order = Array.from({ length: slice.ids.length }, (_, i) => i);
    if (ramp) order.sort((a, b) => (ramp[b] ?? 0) - (ramp[a] ?? 0));
    const wanted = focusedIndex === null ? [] : [focusedIndex];
    for (const index of order.slice(0, budget)) {
      if (index !== focusedIndex) wanted.push(index);
    }
    setLabelOrder(wanted);
    setTracked(wanted);
    schedule();
  }, [slice, display.labels, look.form.labels, focusedIndex, schedule, setLabelOrder]);

  // An overlay that has just mounted has no transform yet, and the simulation may already be
  // asleep — so nothing would place it until the next zoom. Place it now.
  useEffect(() => {
    schedule();
  }, [tracked, hoveredId, display.grid, schedule]);

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
      /**
       * Throw the layout away and compute it again — which means letting go of the pins too.
       *
       * cosmos.gl would keep them: `inputPinnedPoints` is only ever written by `setPinnedPoints`,
       * so `start(1)` re-heats around them and the result is the layout of the data *plus your
       * hand*. The button says Re-run, so it re-runs. It is also the blunt release, and the one
       * that is there whether or not the reader has noticed the pin count.
       */
      restart: () => {
        pins.current.clear();
        applyPins();
        graphRef.current?.start(1);
      },
      unpin: () => {
        if (pins.current.size === 0) return;
        pins.current.clear();
        applyPins();
        // Released nodes are where the drag left them and nothing is pulling on them yet, so
        // without a nudge the picture keeps the shape the pins gave it and the button looks broken.
        graphRef.current?.start(REHEAT);
      },
      /**
       * The same thing a click on the canvas does, plus the camera.
       *
       * It used to only move the view, which is why "find this node" from the inspector and
       * "click this node" on the canvas left the app in two different states for what the reader
       * experiences as one action.
       */
      /**
       * Only reaches what is drawn, and that is the honest limit of a bounded canvas.
       *
       * The inspector can name a node the camera is nowhere near, and a slice has no coordinates for
       * it — so there is nothing to zoom to until the answer that holds it arrives. Pinning it first
       * is what makes it arrive: a pinned id rides along with every query regardless of the
       * rectangle, so the next slice contains it and the reveal lands.
       */
      reveal: (id) => {
        const graph = graphRef.current;
        const current = sliceRef.current;
        if (!graph || !current) return;
        const index = localRef.current.get(id);
        if (index === undefined) {
          pins.current.add(id);
          applyPins();
          return;
        }
        const ids = new Set([id]);
        for (const neighbour of neighboursOf(graph, index)) {
          const value = current.ids[neighbour];
          if (value !== undefined) ids.add(value);
        }
        commit(ids, "node", "Node");
        setFocusedIndex(index);
        handlers.current.setFocused(id);
        graph.setConfigPartial({ focusedPointIndex: index });
        graph.zoomToPointByIndex(index, 500, 5, true);
        schedule();
      },
      /**
       * Frames what is selected *and* on screen.
       *
       * A selection is ids and outlives any slice; the camera can only be aimed at points that have
       * positions. So this frames the intersection, which is what the reader can see anyway — and
       * the selection's own size still comes from the query, not from this count.
       */
      frameSelection: () => {
        const graph = graphRef.current;
        if (!graph) return;
        const indices: number[] = [];
        for (const id of live.current?.ids ?? []) {
          const index = localRef.current.get(id);
          if (index !== undefined) indices.push(index);
        }
        if (indices.length === 0) return;
        graph.fitViewByPointIndices(indices, 420, 0.25);
        schedule();
      },
      clear: () => commit(null, "node", ""),
    });
    return () => register(null);
  }, [applyPins, commit, register, schedule]);

  useCosmosGraph({
    events: {
      onBackgroundClick: () => commit(null, "node", ""),
      // Dropping a node onto the same node it was already pinned at is a no-op the `Set` absorbs,
      // and dropping a pinned node somewhere else re-pins it there — both are what the gesture says.
      // Recorded as an id: the gesture happened to a node, not to a slot in the current answer.
      onDragEnd: (index) => {
        const id = sliceRef.current?.ids[index];
        if (id === undefined) return;
        pins.current.add(id);
        applyPins();
      },
      onPointClick: (instance, index) => {
        const current = sliceRef.current;
        if (!current) return;
        const id = current.ids[index];
        if (id === undefined) return;
        // A node and what it touches: the honest reading of "show me this one", and the same clause
        // shape the marquee publishes, so every other panel understands it already. What it *touches*
        // is what is drawn — the renderer's adjacency over this slice, not the graph's own answer,
        // which is a `neighbourhood` query a relational source cannot serve.
        const ids = new Set([id]);
        for (const neighbour of neighboursOf(instance, index)) {
          const value = current.ids[neighbour];
          if (value !== undefined) ids.add(value);
        }
        commit(ids, "node", "Node");
        setFocusedIndex(index);
        handlers.current.setFocused(id);
        instance.setConfigPartial({ focusedPointIndex: index });
      },
      onPointerOut: () => {
        trackHovered(null);
        setPointer(null);
      },
      // An id, and then a query. The card used to be a property lookup on a row the canvas already
      // held; it is now a fetch, which is the one user-visible regression ADR-0001 names.
      onPointerOver: (index) => {
        const id = sliceRef.current?.ids[index];
        if (id === undefined) return;
        trackHovered(index);
        setPointer({ id, index });
      },
      onTick: schedule,
      // The camera moved: place the overlays, and ask the source about wherever it is now. `refresh`
      // debounces, so a pan is one question rather than one per frame.
      onZoom: () => {
        schedule();
        refresh();
      },
    },
    graphRef,
    hostRef: canvasRef,
    onFailure: setFailure,
    report,
    reportProgress,
    sim,
  });

  // After the constructor, for the same reason `useGraphLook` is: the graph the overlays register
  // against is built by the hook above, and effects run in declaration order. `slice` is a dependency
  // because every answer re-uploads positions, and that clears the registration on its way through.
  useEffect(() => {
    track();
  }, [slice, tracked, hoveredId, track]);

  // After the constructor, not before it. Effects in one component run in declaration order, so
  // above this the look's first upload found `graphRef.current` still null and bailed — the picture
  // only picked up its colours when something else moved (a theme mutation on `<html>`, a slider).
  useGraphLook({ display, getGraph: graphAccess, hostRef, look, schedule, slice });

  const gesture = useGraphSelection({
    commit,
    getGraph: graphAccess,
    getSelection: useCallback(() => live.current, []),
    getSlice: useCallback(() => sliceRef.current, []),
    setTool,
    tool,
  });
  const { active, drag, preview } = gesture;

  /**
   * The words behind the ids on screen: the labelled hubs, plus whatever the pointer is over.
   *
   * One query for both, keyed on the set — so a pointer move that lands on a node already carrying a
   * label costs nothing, and the label set only re-fetches when the slice changes.
   */
  const wanted = useMemo(() => {
    const ids = new Set<number>();
    for (const index of tracked) {
      const id = slice?.ids[index];
      if (id !== undefined) ids.add(id);
    }
    if (hoveredId !== null) ids.add(hoveredId);
    return [...ids].sort((a, b) => a - b);
  }, [hoveredId, slice, tracked]);
  const details = useDetails(coordinator, spec, wanted);
  const hovered = hoveredId === null ? null : details.get(hoveredId);
  /** Straight off the buffer the GPU is drawing — the card cannot disagree with the point. */
  const hoveredOrdinal = pointer ? (slice?.categories[pointer.index] ?? 0) : 0;

  // The same scale the GPU buffers are built from, so the hover card's glyph cannot disagree with
  // the point it is describing — including where Other begins, which `buffers` reads off the same
  // host element.
  const capacity = useChartCapacity(hostRef);
  const scale = useMemo(() => scaleOf(look, capacity), [look, capacity]);


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
      ) : (
        <>
          {/*
            Always mounted, and that is forced rather than tidy. The query loop reads the camera off
            the renderer, and the renderer needs this element — so gating it on the first answer is a
            deadlock: no host, no camera, no question, no answer. The waiting state is an overlay
            over an empty canvas instead of a substitute for it.
          */}
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
          {/* The rim dissolves into the plane. It used to dissolve into `rgba(2,4,10,0.72)`, a
              hand-written colour, and the measurement says what that cost: at full strength it
              lands ΔE 2.6–2.9 from `--background` in dark — inside the ramp's own `interchangeable`
              bound, so in dark it WAS the plane, spelled out by hand — and ΔE 58.2 away in light,
              where it dropped the slots' contrast against what they sit on from 2.12–6.99 to
              1.25–4.11 (3.39–5.60 to 1.56–2.57 for a teal tenant). Not an alpha-step case: an alpha
              step composites back to a ramp *step*, and what a vignette converges to is the page. */}
          <Show when={look.form.vignette}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, var(--background) 100%)",
              }}
            />
          </Show>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Show when={display.labels}>
              {tracked.map((index) => {
                const id = slice?.ids[index];
                // The label is fetched, so a freshly-drawn hub is a point without a name for one
                // query. Rendering nothing is the honest state, and it lasts under 100 ms.
                const label = id === undefined ? undefined : details.get(id)?.label;
                if (!label) return null;
                return (
                  <span
                    className={cn(
                      "absolute top-0 left-0 whitespace-nowrap font-medium text-[10px] leading-none opacity-0 transition-opacity",
                      // One tone, because there is one plane now. The white variant existed for
                      // Nebula's fixed dark canvas; the halo is the theme's own background, so it
                      // reads on either side of the flip without a look having to say which.
                      //
                      // Solid ink. `/75` was a label drawn in a colour that depends on the node
                      // behind it: over the eight slots its worst contrast measured 2.15–2.68,
                      // against 2.63–3.28 for solid `--foreground`. The obvious alternative — the
                      // solid step the dilution lands on over the page, which is `--muted-foreground`
                      // at ΔE 1.8 light / 3.8 dark — measures 1.31–1.64 there and was rejected on
                      // that. Quiet is a job for size and weight, not for thinning the ink.
                      "text-foreground [text-shadow:0_0_3px_var(--background),0_0_6px_var(--background)]",
                    )}
                    key={index}
                    ref={labelRef(index)}
                  >
                    {label}
                  </span>
                );
              })}
            </Show>

            {hovered ? (
              <div
                className="absolute top-0 left-0 w-max max-w-60 overflow-hidden rounded-lg border bg-popover opacity-0 shadow-lg"
                ref={cardRef}
              >
                {/* The glyph is the one the canvas drew for this kind, so the tooltip, the legend
                    and the point on screen are visibly the same claim. */}
                <div className="flex items-center gap-2 border-b px-2.5 py-2">
                  <ShapeGlyph
                    color={scale.color(hoveredOrdinal)}
                    shape={scale.shape(hoveredOrdinal)}
                  />
                  <p className="truncate font-medium text-popover-foreground text-sm leading-none">
                    {hovered.label}
                  </p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2.5 py-2 text-xs">
                  <dt className="text-muted-foreground">
                    {KINDS[hovered.category]?.label ? "Kind" : "Category"}
                  </dt>
                  <dd className="text-end">
                    {KINDS[hovered.category]?.label ?? hovered.category}
                  </dd>
                  {hovered.details.map((detail) => (
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
                      className="stroke-primary"
                      height={Math.abs(drag.to[1] - drag.from[1])}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      style={{ fill: SELECTION_WASH }}
                      width={Math.abs(drag.to[0] - drag.from[0])}
                      x={Math.min(drag.from[0], drag.to[0])}
                      y={Math.min(drag.from[1], drag.to[1])}
                    />
                  ) : null}
                  {drag?.tool === "lasso" && drag.path.length > 1 ? (
                    <>
                      <polygon
                        className="stroke-primary"
                        points={drag.path.map(([x, y]) => `${x},${y}`).join(" ")}
                        strokeWidth={1}
                        style={{ fill: SELECTION_WASH }}
                      />
                      {/* The segment the reader has not drawn yet. Showing it is what makes a
                          half-finished stroke read as a loop rather than as a line — and the dashes
                          are what say "not yet", which is why the stroke is solid. `stroke-primary/50`
                          measured 1.73:1 against the plane for a teal brand and 1.87:1 for an orange
                          one, under the 3:1 a line owes; solid clears at 3.00 and 3.72. Same shape as
                          the `ring-ring/32` failure the theme already removed. */}
                      <line
                        className="stroke-primary"
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

          <Show when={slice === null}>
            <CanvasPlaceholder note="Asking for what is in view…" />
          </Show>
        </>
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
  order: "Order",
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
  const { commands, motion, pinned, ready } = useGraphView();
  const transport = TRANSPORT[motion];
  // Shown only when there is something to release, and it names the number: a pinned point is drawn
  // exactly like an unpinned one, so this control is the only place the reader can see that they
  // are holding part of the layout still.
  const release = `Release ${pinned} pinned ${pinned === 1 ? "node" : "nodes"}`;

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
        <Show when={pinned > 0}>
          <ButtonGroupSeparator />
          <Button
            aria-label={release}
            onClick={() => commands.unpin()}
            size="icon-sm"
            title={release}
            variant="ghost"
          >
            <PinOffIcon />
          </Button>
        </Show>
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
