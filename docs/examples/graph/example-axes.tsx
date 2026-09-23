"use client";

import { useEffect, useMemo, useState } from "react";
import { GraphCanvas, adaptive, lookFrom, simFrom } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, Switch, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { useArchive } from "@/lib/archive-corpus";

/**
 * The picture as **declared axes** rather than as props — and the one number nobody should be asked.
 *
 * `lookFrom` and `simFrom` read the same `Record<string, string>` a preferences section produces:
 * the values are strings in all three kinds, so an unrecognised key rides through a write untouched
 * and a missing one takes the manifest's answer. Nothing here builds a `Look` or a `Sim` literal,
 * which is the point — a host registers `GRAPH_SECTION`, a panel draws the axes, and this reads what
 * came back. The switches below stand in for that panel.
 *
 * `adaptive(total)` is the part a person should not be asked: what a corpus of *this size* wants is
 * computed continuously against vertex count, and its answer for the archive is printed beside the
 * switch. It is tuning rather than level of detail, and it deliberately leaves the space size alone.
 *
 * **Simulate is a switch here and off by default, which is the rule made visible.** The positions
 * are the corpus' own layout, written once by fossil, and they are the index every spatial query is
 * expressed in. Turn the forces on and the points move while the index does not: the camera drifts
 * away from the corpus within a frame, and a pan then asks about a rectangle nothing is in any more.
 * That is worth *seeing* once, which is why the switch exists rather than the prop being absent.
 *
 * **There is no cluster ring here and there used to be.** `clusters` is one group per **buffer
 * position**, and a slice carries positions, identities and category ordinals — the archive's own
 * `cluster_id` is a column of the relation, not of the answer. Seeding it would mean a second query
 * per camera move to colour a force. The ring is still what `GraphCanvas` calls the moment
 * `clusters` is passed; what changed is that a corpus is not the host that has one in hand.
 */
export default function Example() {
  const { opened, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);

  const [marks, setMarks] = useState("dense");
  const [bowed, setBowed] = useState(true);
  const [simulate, setSimulate] = useState(false);
  const [fitted, setFitted] = useState(false);

  /**
   * What the *corpus* holds, not what this window drew — `adaptive` is a question about the whole.
   *
   * Free to ask: `vertex_count` is in the manifest `openCorpus` already read, so `total()` answers
   * without a query. The query loop asks it too, for its own reason — under `limit` it takes one
   * slice covering everything and stops watching the camera.
   */
  const [total, setTotal] = useState<number | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void opened?.source.total?.().then((count) => {
      if (live) setTotal(count);
    });
    return () => {
      live = false;
    };
  }, [opened]);
  const fit = useMemo(() => adaptive(total ?? 0), [total]);

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
        <Switch checked={simulate} onCheckedChange={(d) => setSimulate(d.checked)}>
          Simulate
        </Switch>
        <Switch checked={fitted} onCheckedChange={(d) => setFitted(d.checked)}>
          Fit to size
        </Switch>
        <Badge variant="secondary">
          {total ?? "…"} nodes · repulsion {sim.repulsion.toFixed(2)} · friction {sim.friction.toFixed(2)}
        </Badge>
      </div>

      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{unopened ?? failure}</AlertDescription>
          </Alert>
        }
        when={unopened === null && failure === null}
      >
        <GraphCanvas
          className="flex-1 rounded-lg border"
          fill="kind"
          look={look}
          onFailure={setFailure}
          r="degree"
          sim={sim}
          simulate={simulate}
          source={opened?.source ?? null}
        />
      </Show>
    </div>
  );
}
