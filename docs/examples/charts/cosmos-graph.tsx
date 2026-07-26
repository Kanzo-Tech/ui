"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Graph } from "@cosmos.gl/graph";
import { Query } from "@uwdata/mosaic-sql";
import { useMosaic, type Coordinator } from "@kanzo-tech/ui/analytics";
import { onceQuery } from "@/lib/once-query";
import { Button, Show, Skeleton } from "@kanzo-tech/ui";
import { CosmosClient } from "@/lib/cosmos-client";

// The React half of the probe: lifecycle, the lasso gesture, and the two arrays cosmos.gl wants.
//
// The layout is *not* read from the database. `x` / `y` seed the simulation and are then thrown
// away — from the first frame on, position lives on the GPU and nowhere else. That is the whole
// difference from the Plot route, and the reason the lasso has to publish ids.

const SPACE = 4096;

interface NodeRow {
  id: number;
  category: string;
  x: number;
  y: number;
}

interface GraphData {
  ids: number[];
  index: Map<unknown, number>;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  links: Float32Array;
}

function rgba(hex: string): [number, number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
}

async function load(
  coordinator: Coordinator,
  table: string,
  edges: string,
  palette: Record<string, string>,
): Promise<GraphData> {
  const nodeRows = Array.from(
    (await onceQuery(coordinator, () =>
      Query.from(table).select({ id: "id", category: "category", x: "x", y: "y" }).orderby("id"),
    )) as Iterable<NodeRow>,
  );
  const edgeRows = (await onceQuery(coordinator, () =>
    Query.from(edges).select({ source: "source", target: "target" }),
  )) as { getChild(name: string): { toArray(): ArrayLike<number> } };

  const n = nodeRows.length;
  const ids: number[] = new Array(n);
  const index = new Map<unknown, number>();
  const positions = new Float32Array(n * 2);
  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const row = nodeRows[i] as NodeRow;
    ids[i] = row.id;
    index.set(row.id, i);
    // Seeded into the middle half of the space: gravity pulls to the centre, and starting at the
    // full extent would open with a collapse rather than a layout.
    positions[i * 2] = SPACE * 0.25 + row.x * SPACE * 0.5;
    positions[i * 2 + 1] = SPACE * 0.25 + row.y * SPACE * 0.5;
    const [r, g, b, a] = rgba(palette[row.category] ?? "#94a3b8");
    colors.set([r, g, b, a], i * 4);
    sizes[i] = 3.2;
  }

  const source = edgeRows.getChild("source").toArray();
  const target = edgeRows.getChild("target").toArray();
  const links = new Float32Array(source.length * 2);
  for (let e = 0; e < source.length; e++) {
    links[e * 2] = index.get(source[e]) ?? 0;
    links[e * 2 + 1] = index.get(target[e]) ?? 0;
  }

  return { ids, index, positions, colors, sizes, links };
}

export interface CosmosGraphProps {
  /** The node relation — `id`, `category`, `x`, `y`. */
  table: string;
  /** The raw edge pairs — `source`, `target`, both node ids. */
  edges: string;
  /** Category → hex. Same colours the legend and the bars use. */
  palette: Record<string, string>;
  height?: number;
}

export function CosmosGraph({ table, edges, palette, height = 420 }: CosmosGraphProps) {
  const { coordinator, crossfilter } = useMosaic();
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const clientRef = useRef<CosmosClient | null>(null);
  const dataRef = useRef<GraphData | null>(null);

  const [data, setData] = useState<GraphData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [survivors, setSurvivors] = useState<number | null>(null);
  const [lasso, setLasso] = useState(false);
  const [path, setPath] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let live = true;
    load(coordinator, table, edges, palette).then(
      (next) => {
        if (!live) return;
        dataRef.current = next;
        setData(next);
      },
      (error: unknown) => {
        if (live) setFailure(String(error));
      },
    );
    return () => {
      live = false;
    };
    // `palette` is a literal at the call site; the relations are what identify the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator, table, edges]);

  useEffect(() => {
    const host = hostRef.current;
    if (!data || !host) return;
    const graph = new Graph(host, {
      backgroundColor: [0, 0, 0, 0],
      spaceSize: SPACE,
      pointSize: 3.2,
      pointGreyoutOpacity: 0.08,
      linkGreyoutOpacity: 0.02,
      linkColor: [0.55, 0.58, 0.64, 0.45],
      linkWidth: 0.5,
      enableDrag: false,
      fitViewOnInit: true,
      simulationGravity: 0.2,
      simulationRepulsion: 0.5,
      simulationLinkSpring: 0.8,
      simulationLinkDistance: 6,
      simulationFriction: 0.85,
      simulationDecay: 4000,
    });
    graphRef.current = graph;
    graph.setPointPositions(data.positions);
    graph.setPointColors(data.colors);
    graph.setPointSizes(data.sizes);
    graph.setLinks(data.links);
    graph.render();
    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const client = new CosmosClient({
      table,
      idField: "id",
      filterBy: crossfilter,
      // Straight into the crossfilter, as the Mosaic inputs do. `selected` is the page's read
      // model, not a publish target.
      as: crossfilter,
      onSurvivors: (ids) => {
        const graph = graphRef.current;
        const current = dataRef.current;
        if (!graph || !current) return;
        setSurvivors(ids.length);
        if (ids.length === current.ids.length) {
          graph.unselectPoints();
        } else {
          const indices: number[] = [];
          for (const id of ids) {
            const i = current.index.get(id);
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
  }, [coordinator, crossfilter, data, table]);

  const point = (event: React.PointerEvent): [number, number] => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const finish = (drawn: [number, number][] | null) => {
    setPath(null);
    const graph = graphRef.current;
    const current = dataRef.current;
    if (!graph || !current || !drawn || drawn.length < 3) return;
    const hit = graph.getPointsInPolygon(drawn);
    const ids = Array.from(hit, (i) => current.ids[i]).filter((id): id is number => id !== undefined);
    clientRef.current?.publish(ids.length > 0 ? ids : null);
  };

  const total = data?.ids.length ?? 0;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button onClick={() => setLasso((on) => !on)} size="sm" variant={lasso ? "default" : "outline"}>
          Lasso
        </Button>
        <Button
          onClick={() => {
            clientRef.current?.publish(null);
          }}
          size="sm"
          variant="ghost"
        >
          Clear
        </Button>
        <Button onClick={() => graphRef.current?.fitView()} size="sm" variant="ghost">
          Fit
        </Button>
        <span className="ms-auto text-muted-foreground text-xs tabular-nums">
          {survivors === null ? `${total} nodes` : `${survivors} of ${total} nodes`}
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border" style={{ height }}>
        {failure ? (
          <p className="p-4 text-destructive text-sm">{failure}</p>
        ) : data ? (
          <div className="size-full" ref={hostRef} style={{ cursor: lasso ? "crosshair" : "grab" }} />
        ) : (
          <Skeleton className="size-full" />
        )}
        <Show when={lasso}>
          <div
            className="absolute inset-0 cursor-crosshair"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setPath([point(event)]);
            }}
            onPointerMove={(event) => {
              if (!path) return;
              const next = point(event);
              const last = path[path.length - 1] as [number, number];
              if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 4) return;
              setPath([...path, next]);
            }}
            onPointerUp={() => finish(path)}
          >
            {path && path.length > 1 && (
              <svg className="pointer-events-none size-full">
                <polygon
                  className="fill-primary/10 stroke-primary"
                  points={path.map(([x, y]) => `${x},${y}`).join(" ")}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              </svg>
            )}
          </div>
        </Show>
      </div>
    </div>
  );
}
