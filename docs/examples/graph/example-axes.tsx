"use client";

import { useEffect, useMemo, useState } from "react";
import type { Corpus } from "@fossil-lang/corpus";
import { GraphCanvas, GraphRoot, adaptive, lookFrom, simFrom } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, Switch, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { useArchive } from "./archive";

/**
 * The picture as **declared axes** rather than as props. `lookFrom` and `simFrom` read the same
 * `Record<string, string>` a preferences section produces; the switches stand in for that panel.
 *
 * `adaptive(total)` is the number a person should not be asked: what a corpus of this size wants,
 * from the manifest's vertex count. **Simulate is off by default**, because the positions are the
 * corpus' own layout and the index every tile is culled against: turn the forces on and the points
 * move while the tiles do not.
 */
export default function Example() {
  const corpus = useArchive();
  const [opened, setOpened] = useState<Corpus | null>(null);
  useEffect(() => void corpus?.then(setOpened, () => {}), [corpus]);
  const [failure, setFailure] = useState<string | null>(null);
  const [marks, setMarks] = useState("dense");
  const [bowed, setBowed] = useState(true);
  const [simulate, setSimulate] = useState(false);
  const [fitted, setFitted] = useState(false);

  const total = opened ? Number(opened.types.vertices[0]?.count ?? 0) : 0;
  const fit = useMemo(() => adaptive(total), [total]);
  const values = useMemo(
    () => ({ marks, "bowed-links": String(bowed), links: String(fit.links), labels: "0", grid: "false" }),
    [marks, bowed, fit.links],
  );
  const look = useMemo(() => lookFrom(values), [values]);
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
        <Switch checked={simulate} onCheckedChange={(d) => setSimulate(d.checked)}>
          Simulate
        </Switch>
        <Switch checked={fitted} onCheckedChange={(d) => setFitted(d.checked)}>
          Fit to size
        </Switch>
        <Badge variant="secondary">
          {total || "…"} nodes · repulsion {sim.repulsion.toFixed(2)} · friction {sim.friction.toFixed(2)}
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
        <GraphRoot
          corpus={corpus}
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
