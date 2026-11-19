"use client";

import { useState } from "react";
import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { patternKey } from "@kanzo-tech/mosaic";
import { Skeleton } from "@kanzo-tech/ui";
import { Dashboard, FilterBar, MosaicProvider, RelationPicker, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { said, useArchive } from "../graph/archive";
import { EditingPage } from "./editing-page";

// The archive as a graph: one vertex type, `Node`, and its `linksTo` edges. Pick a hop to chart every
// link as a row — `node.kind` beside `linked.kind`, each field named by its variable — and the
// dashboard reads the pattern exactly as it reads a table. Each pattern keeps its own spec, keyed by
// `patternKey`. The provider is handed the graph, so the tiles' clauses — their chips in the bar —
// reach a graph view beside the dashboard on the nodes the pattern's rows stand for.

export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const { engine, graph } = useArchive(setFailure);
  const [pattern, setPattern] = useState<Pattern>([{ as: "node", type: "Node" }]);
  const [specs, setSpecs] = useState<Record<string, DashboardSpec>>({});
  const key = patternKey(pattern);

  if (failure !== null) return <p className="text-muted-foreground text-sm">{said(failure)}</p>;
  if (!engine || !graph) return <Skeleton className="h-96 w-full" />;
  return (
    <MosaicProvider engine={engine} graph={graph}>
      <EditingPage>
        <RelationPicker graph={graph} onValueChange={setPattern} value={pattern} />
        <FilterBar rowNoun={pattern.length > 1 ? "paths" : "nodes"} relation={pattern} />
        <Dashboard
          key={key}
          onChange={(spec) =>
            setSpecs((specs) => {
              const next = { ...specs };
              if (spec === undefined) delete next[key];
              else next[key] = spec;
              return next;
            })
          }
          relation={pattern}
          value={specs[key]}
        />
      </EditingPage>
    </MosaicProvider>
  );
}
