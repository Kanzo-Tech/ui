"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, ShellAside, Skeleton } from "@kanzo-tech/ui";
import {
  ChartCard,
  FilterBar,
  DashboardStat,
  DetailTable,
  TileEditor,
  useFieldStats,
  type Tile,
} from "@kanzo-tech/ui/analytics";
import { GraphDemo, SIGHTINGS } from "./graph-demo";

// The parts `Dashboard` is made of, arranged by hand: one `useFieldStats` read, the page's
// `FilterBar`, two figures, two charts and the rows. Every part takes the same `relation` and
// `fields`; a part given an `onEdit` shows a pencil, and the host puts `TileEditor` in its own aside
// and draws the draft in the tile's place — here, the bar chart alone.

function Board() {
  const { fields } = useFieldStats(SIGHTINGS);
  const [bar, setBar] = useState<Tile>({ id: "beast", kind: "chart", span: 1, type: "bar", x: "sighting.beast", y: { op: "avg", field: "sighting.bounty" } });
  const [editing, setEditing] = useState<Tile | null>(null);
  const slot = useRef<HTMLDivElement>(null);
  if (!fields) return <Skeleton className="h-96 w-full" />;
  const shown = editing ?? bar;

  return (
    <div className="flex h-[48rem] w-full overflow-hidden rounded-lg border">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <FilterBar rowNoun="sightings" relation={SIGHTINGS} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardStat
            fields={fields}
            stat={{ id: "n", kind: "stat", title: "Sightings", measure: { op: "count" }, trend: "sighting.hour" }}
            relation={SIGHTINGS}
          />
          <DashboardStat
            fields={fields}
            stat={{
              id: "hoax",
              kind: "stat",
              title: "Hoaxes",
              measure: { op: "share", field: "sighting.verdict", equals: "hoax" },
              trend: "sighting.hour",
              goodWhenUp: false,
            }}
            relation={SIGHTINGS}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {shown.kind === "chart" && (
            <ChartCard card={shown} fields={fields} onEdit={() => setEditing(bar)} ref={slot} relation={SIGHTINGS} />
          )}
          <ChartCard
            card={{ id: "hour", kind: "chart", span: 1, type: "histogram", x: "sighting.hour", y: { op: "count" }, color: "sighting.verdict" }}
            fields={fields}
            relation={SIGHTINGS}
          />
        </div>
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="font-medium text-sm">Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailTable columns={["sighting.beast", "sighting.region", "sighting.hour", "sighting.bounty", "sighting.verdict"]} fields={fields} pageSize={8} relation={SIGHTINGS} />
          </CardContent>
        </Card>
      </div>
      {editing && (
        // The editor draws no tile: the bar draws the draft, and the editor fills the page's aside.
        <ShellAside aria-label="Format" className="bg-card" side="end" width={352}>
          <TileEditor
            anchor={() => slot.current}
            fields={fields}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onSave={(tile) => {
              setBar(tile);
              setEditing(null);
            }}
            tile={editing}
            tiles={[bar]}
          />
        </ShellAside>
      )}
    </div>
  );
}

export default function Example() {
  return (
    <GraphDemo name="sightings">
      <Board />
    </GraphDemo>
  );
}
