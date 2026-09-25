"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cursorChip,
  denseOf,
  useGraph,
  useGraphOverlays,
  useGraphSelection,
  vertexId,
  type Selection,
  type Tool,
  type VertexId,
} from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { Query, column, engine, numbers } from "@kanzo-tech/ui/analytics";
import { LassoIcon, SquareDashedIcon } from "lucide-react";
import { useArchive } from "@/lib/archive-corpus";

/**
 * The chrome the canvas deliberately does not own: the grid that belongs to the graph's space,
 * standing labels on the hubs, a hover card, and a drag that selects.
 *
 * Both hooks want the graph from *above* the element, where a context cannot be read — which is why
 * this is `useGraph`'s shape rather than `GraphCanvas`, and why the two are exported at all instead
 * of living inside it. What a lasso commits to is a policy only a product can write; everything
 * below `commit` is this example's, not the package's.
 *
 * Pick a tool and drag. Shift borrows the marquee whichever tool is armed, and at release `Alt`
 * removes what was drawn while `⌘`/`Ctrl` adds — read at release rather than at press, because that
 * is when the reader has decided. No tool at all is the reading posture: a drag pans.
 *
 * **The labels are the part this rewrite made honest.** A slice carries positions, identities and
 * category *ordinals* — never names, because a name is a string and the drawing path carries
 * addresses. So a label comes from the relation, and the relation is the other half `openCorpus`
 * handed back: one query at open for the fourteen hubs the archive has, keyed by `dense_id`, held as
 * a map. Hover anything else and the card says the address, which is the truth — this page never
 * asked what that vertex is called. A product asks: the workspace showcase's inspector queries the
 * handful it is about to draw, and that is a second request, which is why it is not free here.
 */

/** The two vertex kinds every report points at. Fourteen rows, so the labels are worth the ink. */
const HUBS = "kind IN ('beast', 'region')";

export default function Example() {
  const { opened, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hovered, setHovered] = useState<VertexId | null>(null);
  const [names, setNames] = useState<Map<number, string>>(new Map());

  // One ref, in the one direction that needs it. The overlays take the api, so they are declared
  // after it; the api owes the overlays a repaint after a look upload — which does not tick, so
  // nothing else would ask for one — and that is what this bridges.
  const overlaysRef = useRef<ReturnType<typeof useGraphOverlays> | null>(null);
  const schedule = useCallback(() => overlaysRef.current?.schedule(), []);

  const api = useGraph({
    source: opened?.source ?? null,
    fill: "kind",
    r: "degree",
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
  const overlays = useGraphOverlays(api);
  overlaysRef.current = overlays;
  const { cardRef, gridRef, hostRef, labelRef, setLabelOrder, setHovered: setOverlayHover, track } = overlays;

  /**
   * The hubs, by name — the one question this example asks the *relation* rather than the source.
   *
   * `coordinator.query` rather than a client, because the names do not move with the page: nothing
   * here publishes a filter. A readout that must follow a crossfilter is a `MosaicClient`, and the
   * workspace showcase is where those are.
   */
  useEffect(() => {
    if (!opened) return;
    let live = true;
    void engine()
      .then(({ coordinator }) =>
        coordinator.query(
          Query.from(opened.nodes).select({ id: "dense_id", label: "label" }).where(HUBS),
        ),
      )
      .then((rows: unknown) => {
        if (!live) return;
        const ids = numbers(rows, "id") ?? [];
        const labels = (column(rows, "label") ?? []) as string[];
        setNames(new Map([...ids].map((id, i) => [Number(id), labels[i] ?? ""])));
      });
    return () => {
      live = false;
    };
  }, [opened]);

  // Built from identity and not from who is resident — an overlay is attached to a vertex, and the
  // hook resolves it through `Resident` at the moment of painting. `openCorpus` draws one vertex
  // type and numbers it zero, which is the whole of why the type half is a literal here.
  const labelled = useMemo(() => [...names.keys()].map((id) => vertexId(0, id)), [names]);

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

  /** A name where one was asked for, and the address where none was. */
  const name = (vertex: VertexId) => names.get(denseOf(vertex)) ?? `#${denseOf(vertex)}`;

  const gesture = useGraphSelection({
    // Straight off the api: both are built once by `useGraph` and stable for the component's life.
    getGraph: api.getGraph,
    getResident: api.getResident,
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
            <AlertDescription>{unopened ?? failure}</AlertDescription>
          </Alert>
        }
        when={unopened === null && failure === null}
      >
        <div className="relative isolate size-full overflow-hidden bg-background" ref={hostRef}>
          <div className="size-full" ref={api.hostRef} />

          {/* Over the canvas rather than behind it: cosmos.gl paints an opaque background so its
              greyout maths knows what it is dimming against. The hook locks the pattern to the
              graph's own space, keeping the on-screen spacing inside one octave at every zoom —
              which is what makes a pan read as motion rather than as a redraw.

              No `backgroundSize`: `useGraphOverlays` owns the spacing of the element it is given,
              seeding it on mount and rewriting it every frame. What the dots are made of stays
              here — the hook never touches `background-image`. */}
          <div
            className="pointer-events-none absolute inset-0"
            ref={gridRef}
            style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)" }}
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
              {hovered !== null && <span>{name(hovered)}</span>}
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
