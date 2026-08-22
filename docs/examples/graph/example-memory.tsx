"use client";

import { useMemo, useState } from "react";
import {
  GraphRootProvider,
  memorySource,
  useGraph,
  useGraphContext,
  vertexId,
} from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show } from "@kanzo-tech/ui";
import { sightingRows } from "@/example/sightings";
import { forceLayout, normalise, type LayoutEdge } from "@/lib/force-layout";
import { rng } from "@/lib/rng";

/**
 * The same canvas with no database at all — arrays in hand, wrapped in `memorySource`.
 *
 * It draws the sightings fixture as the graph it already is: every report joined to the beast it
 * names and the region it happened in, so the beasts and the regions are **hubs**. That is the one
 * thing a graph shows that the crossfilter charts over the same rows cannot — pull on one arc and
 * you get the reports of a beast across every region at once.
 *
 * And it is the `useGraph` + `GraphRootProvider` shape rather than `GraphCanvas`, because the count
 * below is read from `useGraphContext()` and a component that renders the root sits *above* the
 * provider, where no context is readable.
 *
 * **This is not the first example, and that is the point.** `example-default` used to be an
 * arrays-in-hand one and was deliberately replaced by the corpus: a first example that hands the
 * package three typed arrays teaches an API no product uses. So the corpus opens the page and this
 * sits under the sentence that names `memorySource` — the path for a host whose graph already fits
 * in hand. Restoring it as the first example would undo that argument rather than continue it.
 */

/** The coordinate box the positions are written into. Any positive number; the source reports it. */
const EXTENT = 4096;

/** beast · region · report — what a point is, which is what it wears. */
const KIND = ["beast", "region", "report"] as const;

function build() {
  const rows = sightingRows();

  // Hubs first, so a hub's index is stable and every report can point at one by name.
  const beasts = [...new Set(rows.map((row) => row.beast))].sort();
  const regions = [...new Set(rows.map((row) => row.region))].sort();
  const hubs = beasts.length + regions.length;
  const count = hubs + rows.length;

  const kind = new Uint16Array(count);
  kind.fill(2, hubs);
  kind.fill(1, beasts.length, hubs);

  const edges: LayoutEdge[] = [];
  for (const [n, row] of rows.entries()) {
    const report = hubs + n;
    edges.push({ source: report, target: beasts.indexOf(row.beast) });
    edges.push({ source: report, target: beasts.length + regions.indexOf(row.region) });
  }

  const degree = new Float32Array(count);
  for (const edge of edges) {
    degree[edge.source] += 1;
    degree[edge.target] += 1;
  }

  // Seeded, so the picture opens the same way in every browser.
  const { x, y } = forceLayout(count, edges, kind, KIND.length, 200, rng(0x5e1a).next);
  normalise(x);
  normalise(y);

  const positions = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    // Into the middle half of the box, so panning out has somewhere to go.
    positions[i * 2] = EXTENT * 0.25 + x[i]! * EXTENT * 0.5;
    positions[i * 2 + 1] = EXTENT * 0.25 + y[i]! * EXTENT * 0.5;
  }

  const links = new Float32Array(edges.length * 2);
  for (const [n, edge] of edges.entries()) {
    links[n * 2] = edge.source;
    links[n * 2 + 1] = edge.target;
  }

  // Identity is the pair `(type, dense)`, never the buffer index: a resident set that comes and
  // goes reuses every position, so an index names a different vertex the moment the camera moves.
  const vertices = new BigUint64Array(count);
  for (let i = 0; i < count; i++) {
    vertices[i] = vertexId(kind[i]!, i < hubs ? i : i - hubs);
  }

  return { vertices, positions, links, categories: kind, sizes: degree };
}

/** A child of the provider, because that is the only place the context is readable. */
function Tally() {
  const { slice } = useGraphContext();

  // `marks` of `n`, never `marks` alone: `n` is what the window matched before `limit` cut it, and a
  // truncated answer that reads like a complete one is the one thing a bounded view owes its reader
  // not to do.
  return (
    <Badge className="absolute top-2 left-2" variant="secondary">
      <Show fallback="asking…" when={slice !== null}>
        {slice?.marks} drawn of {slice?.n}
      </Show>
    </Badge>
  );
}

export default function Example() {
  const graph = useMemo(build, []);
  const source = useMemo(() => memorySource(graph), [graph]);
  const [failure, setFailure] = useState<string | null>(null);

  const api = useGraph({ source, onFailure: (error) => setFailure(String(error)) });

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
        <GraphRootProvider value={api}>
          <Tally />
        </GraphRootProvider>
      </Show>
    </div>
  );
}
