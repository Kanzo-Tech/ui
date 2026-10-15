"use client";

import { useEffect, useMemo, useState } from "react";
import { engine } from "@kanzo-tech/mosaic/engine";
import { readJoinGraph, JoinResolver, relationKey, type JoinGraph, type Relation } from "@kanzo-tech/relations";
import { Skeleton } from "@kanzo-tech/ui";
import {
  Dashboard,
  FilterBar,
  MosaicProvider,
  RelationPicker,
  type DashboardSpec,
} from "@kanzo-tech/ui/analytics";
import { FROM, said, useArchive } from "../graph/archive";
import { EditingPage } from "./editing-page";

// The archive's corpus as a join graph: one type, `Node`, its `linksTo` edges, and `vertices`, every
// node as one relation. Pick "Add related…" to chart every link as a row — `kind` beside
// `linksTo.kind`, each column named by its path — and the dashboard reads the joined relation exactly as it reads a table. Each
// relation keeps its own spec, keyed by `relationKey`. The provider is handed the joins, so the tiles'
// clauses — their chips in the bar — reach a graph beside the dashboard crossed by the root's key.

export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const { coordinator } = useArchive(setFailure);
  const [graph, setGraph] = useState<JoinGraph | null>(null);
  const [relation, setRelation] = useState<Relation>({ root: "Node", path: [] });
  const [specs, setSpecs] = useState<Record<string, DashboardSpec>>({});

  useEffect(() => {
    if (!coordinator) return;
    // The archive is attached to the page's one engine; its catalog is read through it.
    const controller = new AbortController();
    engine()
      .then((e) => readJoinGraph(e, FROM, { signal: controller.signal }))
      .then(setGraph, (error: unknown) => !controller.signal.aborted && setFailure(error));
    return () => controller.abort();
  }, [coordinator]);
  const drawn = useMemo(
    () => {
      if (!graph) return null;
      const key = relationKey(graph, relation);
      return {
        key,
        // The keys are identity, not data: in the relation, out of the fields.
        exclude: new JoinResolver(graph).steps(relation).map((s) => s.key),
      };
    },
    [graph, relation],
  );

  if (failure !== null) return <p className="text-muted-foreground text-sm">{said(failure)}</p>;
  if (!coordinator || !graph || !drawn) return <Skeleton className="h-96 w-full" />;
  return (
    <MosaicProvider coordinator={coordinator} joins={graph}>
      <EditingPage>
        <RelationPicker graph={graph} onValueChange={setRelation} value={relation} />
        <FilterBar rowNoun={relation.path.length ? "paths" : "nodes"} relation={relation} />
        <Dashboard
          exclude={drawn.exclude}
          key={drawn.key}
          onChange={(spec) =>
            setSpecs((specs) => {
              const next = { ...specs };
              if (spec === undefined) delete next[drawn.key];
              else next[drawn.key] = spec;
              return next;
            })
          }
          relation={relation}
          value={specs[drawn.key]}
        />
      </EditingPage>
    </MosaicProvider>
  );
}
