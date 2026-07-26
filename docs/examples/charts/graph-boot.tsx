"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Coordinator, MosaicProvider, loadCSV, wasmConnector } from "@kanzo-tech/ui/analytics";
import { Skeleton } from "@kanzo-tech/ui";
import { buildGraph, edgesCsv, nodesCsv } from "./graph";

// One coordinator for the whole page, as everywhere else in these examples. What is new is the
// second relation: `graph_edges` is a *view* that joins each edge back to both endpoints, and it
// names the source endpoint's columns exactly as `graph_nodes` names them (`id`, `category`,
// `weight`, `x`, `y`). That naming is the entire crossfilter trick — a clause published by any
// chart is SQL over column names, so `weight BETWEEN … AND …` lands on the edge relation without
// anyone teaching it what an edge is.

export interface GraphStats {
  size: number;
  nodes: number;
  edges: number;
  /** Force sim, in the browser, once. */
  layoutMs: number;
  /** CSV registration + `read_csv` + the join view. */
  loadMs: number;
}

let connecting: Promise<{ coordinator: Coordinator; db: DuckDBHandle }> | null = null;

interface DuckDBHandle {
  registerFileText(name: string, text: string): Promise<void>;
}

function connect() {
  connecting ??= (async () => {
    const connector = wasmConnector() as { getDuckDB(): Promise<DuckDBHandle> };
    const coordinator = new Coordinator(connector as never);
    const db = await connector.getDuckDB();
    return { coordinator, db };
  })();
  return connecting;
}

const edgeView = (prefix: string) => `CREATE OR REPLACE VIEW ${prefix}_edges AS
  SELECT s.id, s.category, s.degree, s.weight, s.x, s.y, t.x AS x2, t.y AS y2
  FROM ${prefix}_edge_pairs e
  JOIN ${prefix}_nodes s ON e.source = s.id
  JOIN ${prefix}_nodes t ON e.target = t.id`;

const registered = new Set<string>();
const loaded = new Map<string, GraphStats>();
let queue: Promise<unknown> = Promise.resolve();

async function prepare(prefix: string, size: number) {
  const { coordinator, db } = await connect();
  const run = queue.then(async () => {
    const cached = loaded.get(prefix);
    if (cached?.size === size) return cached;
    const graph = buildGraph(size);
    const started = performance.now();
    const nodeFile = `${prefix}-nodes-${size}.csv`;
    const edgeFile = `${prefix}-edges-${size}.csv`;
    if (!registered.has(nodeFile)) {
      await db.registerFileText(nodeFile, nodesCsv(graph));
      await db.registerFileText(edgeFile, edgesCsv(graph));
      registered.add(nodeFile);
    }
    await coordinator.exec(loadCSV(`${prefix}_nodes`, nodeFile, { replace: true }));
    await coordinator.exec(loadCSV(`${prefix}_edge_pairs`, edgeFile, { replace: true }));
    await coordinator.exec(edgeView(prefix));
    const stats: GraphStats = {
      size,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      layoutMs: Math.round(graph.layoutMs),
      loadMs: Math.round(performance.now() - started),
    };
    loaded.set(prefix, stats);
    return stats;
  });
  queue = run.catch(() => undefined);
  return { coordinator, stats: await run };
}

export interface GraphBootProps {
  /**
   * Table-name prefix. The page holds one coordinator, so two demos that want different data need
   * different relations — `graph_nodes` / `graph_edges` versus `bench_nodes` / `bench_edges`.
   */
  prefix?: string;
  /** Node count. Changing it rebuilds both relations in place. */
  size?: number;
  onStats?: (stats: GraphStats) => void;
  children: ReactNode;
}

export default function GraphBoot({ prefix = "graph", size = 200, onStats, children }: GraphBootProps) {
  const [state, setState] = useState<{ coordinator: Coordinator; stats: GraphStats } | null>(null);

  useEffect(() => {
    let live = true;
    setState(null);
    prepare(prefix, size).then((next) => {
      if (!live) return;
      setState(next);
      onStats?.(next.stats);
    });
    return () => {
      live = false;
    };
    // `onStats` is a callback the caller may rebuild; the load is keyed by the relation alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, size]);

  if (!state) return <Skeleton className="h-96 w-full" />;

  return (
    <MosaicProvider coordinator={state.coordinator} key={state.stats.size}>
      {children}
    </MosaicProvider>
  );
}
