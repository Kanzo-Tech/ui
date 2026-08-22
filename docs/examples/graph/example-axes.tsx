"use client";

import { useMemo, useState } from "react";
import {
  GraphCanvas,
  adaptive,
  lookFrom,
  memorySource,
  simFrom,
} from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, Switch, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { sightingsGraph } from "@/lib/sightings-graph";

/**
 * The picture as **declared axes** rather than as props — and the one number that overrules them.
 *
 * `lookFrom` and `simFrom` read the same `Record<string, string>` a preferences section produces:
 * the values are strings in all three kinds, so an unrecognised key rides through a write untouched
 * and a missing one takes the manifest's answer. Nothing here builds a `Look` or a `Sim` literal,
 * which is the point — a host registers `GRAPH_SECTION`, a panel draws the axes, and this reads what
 * came back. The switches below stand in for that panel.
 *
 * `adaptive(nodes)` is the part a person should not be asked: what a corpus of *this size* wants is
 * computed continuously against node count, and its answer for this graph is printed beside the
 * switch. It is tuning rather than level of detail, and it deliberately leaves the space size alone.
 *
 * Cluster seeding is `clusterRing`, which `GraphCanvas` calls for you the moment `clusters` is
 * passed. Turn it off and the beasts stay tangled: `setPointClusters` alone pulls each node toward
 * its own group's centre of mass, which is a target that moves with the thing it is pulling. The
 * ring turns the same force into a positional constraint the simulation converges onto.
 */
export default function Example() {
  const graph = useMemo(sightingsGraph, []);
  const source = useMemo(() => memorySource(graph), [graph]);
  const [failure, setFailure] = useState<string | null>(null);

  const [marks, setMarks] = useState("dense");
  const [bowed, setBowed] = useState(true);
  const [seeded, setSeeded] = useState(true);
  const [fitted, setFitted] = useState(false);

  const nodes = graph.vertices.length;
  const fit = useMemo(() => adaptive(nodes), [nodes]);

  // What a panel would have written. One record, two readers.
  const values = useMemo(
    () => ({
      marks,
      "bowed-links": String(bowed),
      links: String(fit.links),
      labels: "0",
      grid: "false",
    }),
    [marks, bowed, fit.links],
  );

  const look = useMemo(() => lookFrom(values), [values]);
  // Either the declared coefficients or the ones this size asks for — the same shape from both ends.
  const sim = useMemo(() => (fitted ? fit.sim : simFrom(values)), [fitted, fit.sim, values]);

  return (
    <div className="flex h-96 w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <ToggleGroup
          aria-label="Marks"
          multiple={false}
          onValueChange={(details) => setMarks(details.value[0] ?? "dense")}
          size="sm"
          value={[marks]}
          variant="outline"
        >
          <ToggleGroupItem value="dense">Dense</ToggleGroupItem>
          <ToggleGroupItem value="legible">Legible</ToggleGroupItem>
        </ToggleGroup>
        <Switch checked={bowed} onCheckedChange={(d) => setBowed(d.checked)}>
          Bowed links
        </Switch>
        <Switch checked={seeded} onCheckedChange={(d) => setSeeded(d.checked)}>
          Cluster ring
        </Switch>
        <Switch checked={fitted} onCheckedChange={(d) => setFitted(d.checked)}>
          Fit to size
        </Switch>
        <Badge variant="secondary">
          {nodes} nodes · repulsion {sim.repulsion.toFixed(2)} · friction {sim.friction.toFixed(2)}
        </Badge>
      </div>

      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        }
        when={failure === null}
      >
        <GraphCanvas
          className="flex-1 rounded-lg border"
          clusters={seeded ? graph.clusters : undefined}
          look={look}
          onFailure={setFailure}
          sim={sim}
          simulate
          source={source}
        />
      </Show>
    </div>
  );
}
