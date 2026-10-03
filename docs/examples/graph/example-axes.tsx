"use client";

import { useMemo, useState } from "react";
import { GraphCanvas, GraphRoot, lookFrom, simFrom } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, Switch, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { said, useArchive } from "./archive";

/**
 * The picture as **declared axes** rather than as props. `lookFrom` and `simFrom` read the same
 * `Record<string, string>` a preferences section produces; the switches stand in for that panel.
 * **Simulate is on by default**, because the archive carries no positions and nothing binds `x` and
 * `y`: switch it off and the points stay where they are; on again, the layout runs from there.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const [marks, setMarks] = useState("dense");
  const [curved, setCurved] = useState(true);
  const [simulate, setSimulate] = useState(true);

  const values = useMemo(
    () => ({ marks, edges: curved ? "curved" : "straight", labels: "none", grid: "false" }),
    [marks, curved],
  );
  const look = useMemo(() => lookFrom(values), [values]);
  const sim = useMemo(() => simFrom(values), [values]);

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
        <Switch checked={curved} onCheckedChange={(d) => setCurved(d.checked)}>
          Curved links
        </Switch>
        <Switch checked={simulate} onCheckedChange={(d) => setSimulate(d.checked)}>
          Simulate
        </Switch>
        <Badge variant="secondary">
          repulsion {sim.repulsion.toFixed(2)} · friction {sim.friction.toFixed(2)}
        </Badge>
      </div>
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{said(failure)}</AlertDescription>
          </Alert>
        }
        when={failure === null}
      >
        <GraphRoot
          {...archive}
          fill="kind"
          look={look}
          onFailure={setFailure}
          r="degree"
          sim={sim}
          simulate={simulate}
        >
          <GraphCanvas className="flex-1 rounded-lg border" />
        </GraphRoot>
      </Show>
    </div>
  );
}
