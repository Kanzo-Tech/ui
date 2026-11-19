"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, usePick } from "@kanzo-tech/graph";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { eq, literal, numbers, Query, relationOver } from "@kanzo-tech/mosaic";
import { type Engine } from "@kanzo-tech/mosaic/engine";
import { Show, Toggle } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

const KINDS = ["beast", "region", "tag"] as const;

/**
 * A panel beside the canvas that picks *every vertex of a kind*. It is one place, so picking another
 * kind replaces its pick; the canvas greys out the rest, and a lasso intersects with it. The archive
 * has one vertex type, `Node`, so a node's index within it is its id on the canvas.
 */
function Kinds({ engine, graph }: { engine: Engine | null; graph: Graph | null }) {
  const kinds = usePick("kinds");
  const pick = async (kind: (typeof KINDS)[number], label: string) => {
    if (!engine || !graph) return;
    const nodes = relationOver(graph, [{ as: "n", type: "Node" }]);
    const query = Query.from(nodes.table).select({ id: "n" }).where(eq("n.kind", literal(kind)));
    const answer = await engine.query(String(query), { signal: AbortSignal.timeout(10_000) });
    kinds.pick(numbers(answer, "id"), label);
  };
  return (
    <div className="flex w-48 shrink-0 flex-col gap-2">
      {KINDS.map((kind) => {
        const label = `Every ${ARCHIVE_KINDS[kind].toLowerCase()}`;
        return (
          <Toggle
            disabled={!engine || !graph}
            key={kind}
            onPressedChange={(pressed) => (pressed ? void pick(kind, label) : kinds.pick(null, label))}
            pressed={kinds.picked === label}
            variant="outline"
          >
            {label}
          </Toggle>
        );
      })}
    </div>
  );
}

export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  return (
    <div className="flex h-96 w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <Kinds engine={archive.engine} graph={archive.graph} />
      </GraphRoot>
    </div>
  );
}
