"use client";

import { useEffect, useMemo, useState } from "react";
import { readJoinGraph } from "@kanzo-tech/graph";
import { Skeleton } from "@kanzo-tech/ui";
import {
  Dashboard,
  FilterChips,
  MosaicProvider,
  RelationPicker,
  relationIdentities,
  relationKey,
  relationQuery,
  semiJoinOf,
  type DashboardSpec,
  type JoinGraph,
  type Relation,
} from "@kanzo-tech/ui/analytics";
import { FROM, said, useArchive } from "../graph/archive";

// The archive's corpus as a join graph: one type, `Node`, and its `linksTo` edges. Pick "Hop" to
// chart every link as a row — `Node.kind` beside `Node2.kind` — and the dashboard reads the joined
// relation exactly as it reads a table. Each relation keeps its own spec, keyed by `relationKey`.
// `publish` hands the page one semi-join on the root's key for all the tiles' clauses — the chip
// above the picker — which is what a graph beside the dashboard would be filtered by.

export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const { coordinator } = useArchive(setFailure);
  const [graph, setGraph] = useState<JoinGraph | null>(null);
  const [relation, setRelation] = useState<Relation>({ root: "Node", path: [] });
  const [specs, setSpecs] = useState<Record<string, DashboardSpec>>({});

  useEffect(() => {
    if (coordinator) readJoinGraph(coordinator, FROM).then(setGraph, setFailure);
  }, [coordinator]);
  const drawn = useMemo(
    () => {
      if (!graph) return null;
      const key = relationKey(graph, relation);
      const table = relationQuery(graph, relation);
      const identities = relationIdentities(graph, relation);
      return {
        key,
        table,
        // The keys are identity, not data: in the relation, out of the fields.
        exclude: identities.map((i) => i.column),
        publish: semiJoinOf(identities[0]!.column, table, { label: key }),
      };
    },
    [graph, relation],
  );

  if (failure !== null) return <p className="text-muted-foreground text-sm">{said(failure)}</p>;
  if (!coordinator || !graph || !drawn) return <Skeleton className="h-96 w-full" />;
  return (
    <MosaicProvider coordinator={coordinator}>
      <div className="flex w-full flex-col gap-4">
        <FilterChips />
        <RelationPicker graph={graph} onValueChange={setRelation} value={relation} />
        <Dashboard
          exclude={drawn.exclude}
          key={drawn.key}
          onChange={(spec) =>
            setSpecs(({ [drawn.key]: _, ...rest }) => (spec === undefined ? rest : { ...rest, [drawn.key]: spec }))
          }
          publish={drawn.publish}
          rowNoun={relation.path.length ? "paths" : "nodes"}
          table={drawn.table}
          value={specs[drawn.key]}
        />
      </div>
    </MosaicProvider>
  );
}
