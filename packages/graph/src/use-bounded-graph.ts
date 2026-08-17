"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Graph } from "@cosmos.gl/graph";
import {
  BOUNDED_DEFAULTS,
  shouldSlice,
  type BoundedSource,
  type ExploringSource,
  type Slice,
  type Viewport,
} from "./bounded";
import { residentOf, type Resident, type VertexId } from "./resident";

/**
 * The query loop: the camera moves, a bounded question is asked, the answer becomes the picture.
 *
 * This is the half `DESIGN.md` requires of anything with an engine — the canvas stays presentational
 * and this owns the asking. It debounces, cancels what the camera has already superseded, and pushes
 * each answer's geometry into the renderer. A host that already holds its arrays wraps them in a
 * source and gets the same path; there is no second one.
 *
 * **A graph that fits pays for nothing.** `total()` is asked first, and under the limit the source is
 * asked once for everything and never again — panning is then free exactly when it can be. Above it,
 * every camera move costs a query, which at 200,000 nodes is the trade that buys the ceiling away.
 */

export interface BoundedGraphOptions {
  source: BoundedSource | null;
  /** The live renderer, for reading the camera and receiving each answer. */
  graphRef: RefObject<Graph | null>;
  /** The element the canvas is drawn into — its box is the screen rectangle. */
  hostRef: RefObject<HTMLElement | null>;
  /**
   * Vertices that must come back whatever the camera is looking at.
   *
   * Dragged, pinned, selected. Their drawn positions are a view-local overlay on coordinates that
   * never move, so the index cannot find them where they now appear.
   */
  pinned?: VertexId[];
  /**
   * Which column colours a point and which the size ramp is spent on — Plot's channel names.
   *
   * They arrive here rather than being baked into the source because a channel is part of the
   * **question**: colouring by another column is a new answer over the same bytes, and a source that
   * held them meant building a second source to change a colour. So this loop asks again when one
   * changes, which is the whole behaviour the move buys.
   *
   * Both optional, and the source decides what an omitted one means — it is the only thing that
   * knows what its corpus carries.
   */
  fill?: string;
  r?: string;
  limit?: number;
  lodThreshold?: number;
  /**
   * How long the camera has to be still before asking, in milliseconds.
   *
   * A pan is a stream of `onZoom` callbacks and every one of them would otherwise be a query. Long
   * enough that a gesture costs one question rather than sixty; short enough that letting go feels
   * like it answered immediately.
   */
  debounce?: number;
  onError?: (message: string) => void;
}

export interface BoundedGraphState {
  /** The answer currently drawn, or `null` before the first one. */
  slice: Slice | null;
  /**
   * Who is drawn, and where — rebuilt with every answer, which is what makes it correct.
   *
   * It lives here rather than in each hook because **this is where residency changes**. The map is
   * a function of the current answer and nothing else, so a consumer that built its own would be
   * building the same thing from the same input, one render later, with no way to notice it had
   * fallen behind the buffers on screen. Selection, overlays, pins and the greyout all read this
   * one.
   */
  resident: Resident;
  /** Whether a question is outstanding. */
  pending: boolean;
  /** How many vertices there are, when the source knows. */
  total: number | undefined;
  /**
   * Whether this graph is being asked in pieces at all.
   *
   * `false` means it fit under the limit and was taken whole — the camera is not observed, and
   * nothing is asked again.
   */
  sliced: boolean;
  /** Ask again. Wire it to the camera, and call it when the pinned set changes. */
  refresh: () => void;
  /** Ask a topological question instead of a spatial one, when the source supports one. */
  explore: (seeds: VertexId[], depth: number) => void;
}

const EVERYTHING: Viewport = {
  xMin: Number.NEGATIVE_INFINITY,
  yMin: Number.NEGATIVE_INFINITY,
  xMax: Number.POSITIVE_INFINITY,
  yMax: Number.POSITIVE_INFINITY,
  // Above any threshold, so the one whole-corpus answer comes back in detail rather than aggregated.
  zoom: Number.POSITIVE_INFINITY,
};

/**
 * What the camera is over, asked of the renderer rather than recomputed.
 *
 * cosmos.gl owns the screen↔space transform, so deriving the rectangle from `camera.x/y/k` and the
 * space size — which an earlier `viewportOf` did — is a second implementation of it, free to drift.
 * Screen y grows downward and space y does not, so the corners are sorted rather than assumed.
 */
function cameraViewport(graph: Graph, host: HTMLElement): Viewport {
  const { height, width } = host.getBoundingClientRect();
  const [ax, ay] = graph.screenToSpacePosition([0, 0]);
  const [bx, by] = graph.screenToSpacePosition([width, height]);
  return {
    xMin: Math.min(ax, bx),
    yMin: Math.min(ay, by),
    xMax: Math.max(ax, bx),
    yMax: Math.max(ay, by),
    zoom: graph.getZoomLevel(),
  };
}

export function useBoundedGraph(options: BoundedGraphOptions): BoundedGraphState {
  const {
    debounce = DEBOUNCE_MS,
    fill,
    graphRef,
    hostRef,
    limit = BOUNDED_DEFAULTS.limit,
    lodThreshold = BOUNDED_DEFAULTS.lodThreshold,
    onError,
    pinned,
    r,
    source,
  } = options;

  const [slice, setSlice] = useState<Slice | null>(null);
  const [pending, setPending] = useState(false);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [sliced, setSliced] = useState(false);
  /** The source `total()` has already answered for — the gate the asking effect waits on. */
  const [counted, setCounted] = useState<BoundedSource | null>(null);

  /**
   * The request in flight, and the timer waiting to become one.
   *
   * Refs rather than state: aborting a superseded request is bookkeeping the render output never
   * shows, and putting it in state would re-render the canvas once per camera frame to no effect.
   */
  const inFlight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether the camera is being observed at all, where `refresh` can read it without a rebuild. */
  const slicing = useRef(false);
  /** The live pinned set, so the query loop is not rebuilt every time a node is dragged. */
  const held = useRef(pinned);
  held.current = pinned;
  const report = useRef(onError);
  report.current = onError;

  const ask = useCallback(
    async (run: (from: BoundedSource, signal: AbortSignal) => Promise<Slice>) => {
      if (!source) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setPending(true);
      try {
        const answer = await run(source, controller.signal);
        if (controller.signal.aborted) return;
        setSlice(answer);
      } catch (error) {
        // An abort is the loop working, not a failure: the camera moved on before the answer landed.
        if (controller.signal.aborted) return;
        report.current?.(String(error));
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setPending(false);
        }
      }
    },
    [source],
  );

  /**
   * Put the camera over the corpus, once, before the first question is asked.
   *
   * **The order is the point, and it is why this is not `fitView()` after the first slice.** A
   * sliced graph's first question is *what is the camera over*, so framing afterwards means the
   * opening query was asked about wherever the renderer happened to start — which for a corpus
   * occupying a corner of the space is a first paint of nothing, followed by a second query once the
   * fit moves the camera. Framing first costs one query instead of two and shows the corpus instead
   * of the default box.
   *
   * A source that cannot say its extent is left alone rather than guessed at: the camera stays where
   * the renderer put it, which is today's behaviour and is correct for arrays with no layout.
   *
   * Once, tracked on a ref, because this is the *opening* view: a reader who has panned somewhere
   * and then changes a channel is not asking to be sent home.
   */
  const framed = useRef<BoundedSource | null>(null);
  const frame = useCallback(
    async (from: BoundedSource) => {
      if (!from.extent || framed.current === from) return;
      framed.current = from;
      let box;
      try {
        box = await from.extent();
      } catch (error) {
        // **Framing may not stop the drawing.** This is a camera placement, and a source that cannot
        // answer where it is still has a slice to give — but the first version let the rejection
        // escape the chain the ask was waiting on, so a failed extent left the canvas saying "asking
        // for what is in view" forever, with nothing in the console. A defect that silences the whole
        // canvas has to be louder than the thing it was helping.
        report.current?.(String(error));
        return;
      }
      const graph = graphRef.current;
      if (!graph) return;
      // Two corners are enough: cosmos.gl fits the bounding box of whatever positions it is handed,
      // and a rectangle is its own bounding box. Duration zero — an opening view that flies in from
      // the default box is animation for its own sake, and the reader has not asked for anything yet.
      graph.fitViewByPointPositions([box.xMin, box.yMin, box.xMax, box.yMax], 0);
    },
    [graphRef],
  );

  /**
   * Ask about wherever the camera is now, after `debounce` of stillness.
   *
   * Wired to the renderer's `onZoom`, which fires per frame of a gesture. The timer collapses a pan
   * into one question; `ask` aborts anything the pan has already made stale.
   */
  const refresh = useCallback(() => {
    // A graph that fits was answered whole, and re-asking would replace that answer with whatever
    // rectangle the camera happens to be over — which is how a corpus of 582 nodes ends up empty
    // because the reader zoomed. The promise that panning is free exactly when it can be is kept
    // here rather than by asking every call site to remember not to wire this up.
    if (!slicing.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const graph = graphRef.current;
      const host = hostRef.current;
      if (!graph || !host) return;
      void ask((s, signal) =>
        s.slice({
          view: cameraViewport(graph, host),
          pinned: held.current,
          fill,
          r,
          limit,
          lodThreshold,
          signal,
        }),
      );
    }, debounce);
    // The channels are dependencies rather than a ref, unlike `pinned`: a new one is a new question
    // and the effect below re-runs this the moment its identity changes. A pin is a gesture the host
    // reports, and it says when to ask again itself.
  }, [ask, debounce, fill, graphRef, hostRef, limit, lodThreshold, r]);

  /**
   * Ask a topological question, when the source is one that can answer.
   *
   * `"explore" in source` is the narrowing, and it is the whole check — a source that cannot walk
   * edges does not carry the method, so this is the one place a caller pays for the distinction
   * instead of every source restating it in a predicate and a throw.
   */
  const explore = useCallback(
    (seeds: VertexId[], depth: number) => {
      if (!source || !("explore" in source)) {
        report.current?.("this source answers regions only");
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      void ask((s, signal) =>
        (s as ExploringSource).explore({
          seeds,
          depth,
          pinned: held.current,
          fill,
          r,
          limit,
          lodThreshold,
          signal,
        }),
      );
    },
    [ask, fill, limit, lodThreshold, r, source],
  );

  /**
   * How big it is — asked once per source, and the answer decides whether there is a query loop at
   * all: under the limit one slice covers everything and the camera is never consulted again. A
   * source that cannot say cheaply is treated as large, because an unknown corpus is more likely to
   * be the kind that needs bounding than not.
   *
   * The *asking* is the effect below rather than the tail of this one, and the split is what lets a
   * channel change re-ask: how big a corpus is belongs to the source and does not change with what
   * you want drawn, so counting again on every colour would be paying a `count(*)` for a question
   * nobody asked.
   */
  useEffect(() => {
    if (!source) {
      setSlice(null);
      setTotal(undefined);
      setCounted(null);
      return;
    }
    let live = true;
    void (async () => {
      let count: number | undefined;
      try {
        count = await source.total?.();
      } catch {
        // A source that will not count is a source that gets sliced.
      }
      if (!live) return;
      setTotal(count);
      const bounded = shouldSlice(count, limit);
      slicing.current = bounded;
      setSliced(bounded);
      setCounted(source);
    })();
    return () => {
      live = false;
    };
  }, [limit, source]);

  /**
   * What to draw — the opening question, and every later one that is not the camera's.
   *
   * It runs when the count lands, and again whenever the question itself changes: a channel is part
   * of the question, so `refresh` and this both carry them and both re-run. The counted source is
   * compared rather than a boolean, so an answer that arrives for a source already replaced cannot
   * open a slice against the new one.
   */
  useEffect(() => {
    if (!source || counted !== source) return;
    void (async () => {
      await frame(source);
      if (slicing.current) refresh();
      else
        await ask((s, signal) =>
          s.slice({ view: EVERYTHING, pinned: held.current, fill, r, limit, lodThreshold, signal }),
        );
    })();
  }, [ask, counted, fill, frame, limit, lodThreshold, r, refresh, source]);

  // A dropped canvas must not leave a timer holding a stale camera, or a request nobody will read.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  /**
   * The answer becomes the picture.
   *
   * Separate from the effect that builds the renderer, which is the whole point: a slice arrives on
   * every camera move, and rebuilding the instance for each one would destroy and recreate a WebGL
   * context sixty times a pan. Geometry is pushed; the instance outlives every slice it draws.
   */
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !slice) return;
    graph.setPointPositions(slice.positions);
    graph.setLinks(slice.links);
    graph.render();
  }, [graphRef, slice]);

  // Memoised on the answer, because a fresh map per render would make every consumer that depends on
  // it re-run for a value that had not changed.
  const resident = useMemo(() => residentOf(slice), [slice]);

  return { slice, resident, pending, total, sliced, refresh, explore };
}

/**
 * The stillness a camera has to hold before it is asked about — 120 ms.
 *
 * Under a gesture's own frame budget it would be one query per frame; far above it and letting go of
 * a pan feels like the canvas is thinking. The measured slice at 200,000 nodes is 30 ms, so this is
 * the larger half of the latency a reader actually feels, and it is the half we chose.
 */
const DEBOUNCE_MS = 120;
