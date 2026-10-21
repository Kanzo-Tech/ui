import type { Engine } from "@kanzo-tech/mosaic/engine";
import { attachGraph, type Graph } from "@kanzo-tech/graphar-duckdb";

/**
 * A graph fossil's executor wrote, attached to the page's engine as the catalog `catalog`, and the
 * `Graph` that answers for it. `url` is the directory it was written to, origin-qualified: DuckDB-WASM
 * resolves a root-relative path in its own filesystem. `fossil.graph.yml` is the document the writer
 * puts at the root of its output.
 */
export function attachWritten(
  engine: Engine,
  catalog: string,
  url: string,
  signal?: AbortSignal,
): Promise<Graph> {
  return attachGraph(engine, catalog, (paths) => paths.map((path) => `${url}/${path}`), {
    entry: "fossil.graph.yml",
    signal,
  });
}
