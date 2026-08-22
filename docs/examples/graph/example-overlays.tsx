"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GRID,
  cursorChip,
  denseOf,
  memorySource,
  typeOf,
  useGraph,
  useGraphOverlays,
  useGraphSelection,
  vertexId,
  type Selection,
  type Tool,
  type VertexId,
} from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { LassoIcon, SquareDashedIcon } from "lucide-react";
import { KIND, sightingsGraph } from "@/lib/sightings-graph";

/**
 * The chrome the canvas deliberately does not own: the grid that belongs to the graph's space,
 * standing labels on the hubs, a hover card, and a drag that selects.
 *
 * Both hooks want `getGraph` and `getResident` from *above* the element, where a context cannot be
 * read — which is why this is `useGraph` + `GraphRootProvider`'s shape rather than `GraphCanvas`,
 * and why the two are exported at all instead of living inside it. What a lasso commits to is a
 * policy only a product can write; everything below `commit` is this example's, not the package's.
 *
 * Pick a tool and drag. Shift borrows the marquee whichever tool is armed, and at release `Alt`
 * removes what was drawn while `⌘`/`Ctrl` adds — read at release rather than at press, because that
 * is when the reader has decided. No tool at all is the reading posture: a drag pans.
 */
export default function Example() {
  const graph = useMemo(sightingsGraph, []);
  const source = useMemo(() => memorySource(graph), [graph]);
  const [failure, setFailure] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hovered, setHovered] = useState<VertexId | null>(null);

  // The overlays need the api and the api owes the overlays a repaint, so one of the two is held in
  // a ref. That mutual dependency is the reason `GraphOverlays` is an exported type.
  const overlaysRef = useRef<ReturnType<typeof useGraphOverlays> | null>(null);
  const apiRef = useRef<ReturnType<typeof useGraph> | null>(null);
  const getGraph = useCallback(() => apiRef.current?.getGraph() ?? null, []);
  const getResident = useCallback(() => apiRef.current!.getResident(), []);
  const schedule = useCallback(() => overlaysRef.current?.schedule(), []);

  const api = useGraph({
    source,
    onFailure: setFailure,
    schedule,
    // **The overlays never paint on their own, and that is the whole of why they are a hook.**
    // There is one `requestAnimationFrame` and the host owns when it fires: the camera moving is
    // what moves the grid, and it is not visible from inside the hook. Wire nothing here and the
    // grid sits frozen while the graph pans under it, with nothing failing.
    events: {
      onTick: schedule,
      onZoom: schedule,
      onPointerOver: (vertex) => setHovered(vertex),
      onPointerOut: () => setHovered(null),
      onBackgroundClick: () => setSelection(null),
    },
  });
  apiRef.current = api;

  const overlays = useGraphOverlays({ getGraph, getResident });
  overlaysRef.current = overlays;
  const { cardRef, gridRef, hostRef, labelRef, setLabelOrder, setHovered: setOverlayHover, track } = overlays;

  // The hubs carry the labels: they are the only points whose name is worth the ink at this scale.
  // Built from identity and not from who is resident — an overlay is attached to a vertex, and the
  // hook resolves it through `Resident` at the moment of painting.
  const labelled = useMemo(
    () => [
      ...graph.hubs.beasts.map((_, i) => vertexId(0, i)),
      ...graph.hubs.regions.map((_, i) => vertexId(1, i)),
    ],
    [graph],
  );

  useEffect(() => {
    setLabelOrder(labelled);
    setOverlayHover(hovered);
    // Re-register after the graph exists and whenever the watched set moves: cosmos.gl clears the
    // tracked set on the render that follows `setPointPositions`, so this cannot be a one-shot.
    track();
    // Then one nudge a frame behind it, because nothing else will ask for one: the camera has not
    // moved, and the positions `track()` just registered are only readable after a render.
    const frame = requestAnimationFrame(schedule);
    return () => cancelAnimationFrame(frame);
  }, [labelled, hovered, setOverlayHover, setLabelOrder, track, schedule, api.slice]);

  const name = (vertex: VertexId) =>
    typeOf(vertex) === 0
      ? graph.hubs.beasts[denseOf(vertex)]
      : graph.hubs.regions[denseOf(vertex)];

  const gesture = useGraphSelection({
    getGraph,
    getResident,
    getSelection: useCallback(() => selection, [selection]),
    commit: (vertices, from, label) =>
      setSelection(vertices === null ? null : { vertices: [...vertices], source: from, label }),
    setTool,
    tool,
  });
  const { active, drag, preview } = gesture;

  return (
    <div className="h-96 w-full">
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        }
        when={failure === null}
      >
        <div className="relative isolate size-full overflow-hidden bg-background" ref={hostRef}>
          <div className="size-full" ref={api.hostRef} />

          {/* Over the canvas rather than behind it: cosmos.gl paints an opaque background so its
              greyout maths knows what it is dimming against. The hook locks the pattern to the
              graph's own space, keeping the on-screen spacing inside [GRID, 2·GRID) at every zoom —
              which is what makes a pan read as motion rather than as a redraw. */}
          <div
            className="pointer-events-none absolute inset-0"
            ref={gridRef}
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: `${GRID}px ${GRID}px`,
            }}
          />

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {labelled.map((vertex) => (
              <span
                className="absolute top-0 left-0 whitespace-nowrap font-medium text-[10px] text-foreground leading-none opacity-0 transition-opacity [text-shadow:0_0_3px_var(--background),0_0_6px_var(--background)]"
                key={String(vertex)}
                ref={labelRef(vertex)}
              >
                {name(vertex)}
              </span>
            ))}
            {/* One card, moved — not one per node. The same rAF places it, and it clears both its
                own node and the canvas edge without this component knowing either. */}
            <div
              className="absolute top-0 left-0 rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs opacity-0 shadow-md"
              ref={cardRef}
            >
              {/* `&&` rather than `Show`: its children are an eager prop, and this dereferences. */}
              {hovered !== null && (
                <span>
                  {KIND[typeOf(hovered)]} · {name(hovered)}
                </span>
              )}
            </div>
          </div>

          <Show when={active !== null}>
            <div className="absolute inset-0 cursor-crosshair" {...gesture.handlers}>
              <Show when={drag !== null}>
                <svg className="pointer-events-none size-full">
                  {/* Ternaries rather than `Show`: its children are an eager prop, and both of these
                      dereference the drag they are guarded on. */}
                  {drag?.tool === "rect" ? (
                    <rect
                      className="stroke-primary"
                      height={Math.abs(drag.to[1] - drag.from[1])}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      style={{ fill: "var(--brand-a5)" }}
                      width={Math.abs(drag.to[0] - drag.from[0])}
                      x={Math.min(drag.from[0], drag.to[0])}
                      y={Math.min(drag.from[1], drag.to[1])}
                    />
                  ) : null}
                  {drag?.tool === "lasso" && drag.path.length > 1 ? (
                    <polygon
                      className="stroke-primary"
                      points={drag.path.map(([x, y]) => `${x},${y}`).join(" ")}
                      strokeWidth={1}
                      style={{ fill: "var(--brand-a5)" }}
                    />
                  ) : null}
                </svg>
              </Show>
              {/* The running count rides just off the cursor, so the number lands before the mouse
                  does. `cursorChip` is the whole of that positioning. The hit test behind it is a
                  GPU pass plus a synchronous readback, so it is throttled rather than run per event. */}
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

          <div className="absolute top-2 left-2 flex items-center gap-2">
            {/* Deselectable one-of-two, which is why it is a `ToggleGroup` and not a `SegmentGroup`:
                no tool at all is a real state, and it is the one where a drag pans. */}
            <ToggleGroup
              aria-label="Selection tool"
              multiple={false}
              onValueChange={(details) => setTool((details.value[0] as Tool) ?? null)}
              size="sm"
              value={tool === null ? [] : [tool]}
              variant="outline"
            >
              <ToggleGroupItem aria-label="Marquee" value="rect">
                <SquareDashedIcon />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="Lasso" value="lasso">
                <LassoIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <Show when={selection !== null}>
              <Badge variant="secondary">
                {selection?.label}: {selection?.vertices.length}
              </Badge>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
