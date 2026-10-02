"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@kanzo-tech/ui";
import {
  ChartCard,
  DashboardFilters,
  DashboardStat,
  DetailTable,
  useFieldStats,
  type DashboardCardSpec,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// The parts `Dashboard` is made of, arranged by hand: one `useFieldStats` read, a filter row, two
// tiles, two cards and the rows. Every part takes the same `table` and `fields`; each one is
// editable only if it is given an `onChange` — here, the bar card alone.

function Board() {
  const { fields } = useFieldStats("sightings");
  const [card, setCard] = useState<DashboardCardSpec>({
    id: "beast",
    type: "bar",
    x: "beast",
    y: { op: "avg", field: "bounty" },
  });
  if (!fields) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex w-full flex-col gap-4">
      <DashboardFilters
        fields={fields}
        filters={[{ field: "region" }, { field: "verdict" }, { field: "leagues" }]}
        rowNoun="sightings"
        table="sightings"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardStat fields={fields} stat={{ id: "n", label: "Sightings", measure: { op: "count" }, trend: "hour" }} table="sightings" />
        <DashboardStat
          fields={fields}
          stat={{ id: "hoax", label: "Hoaxes", measure: { op: "share", field: "verdict", equals: "hoax" }, trend: "hour", goodWhenUp: false }}
          table="sightings"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard card={card} fields={fields} onChange={setCard} table="sightings" />
        <ChartCard
          card={{ id: "hour", type: "histogram", x: "hour", y: { op: "count" }, color: "verdict" }}
          fields={fields}
          table="sightings"
        />
      </div>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="font-medium text-sm">Rows</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailTable columns={["beast", "region", "hour", "bounty", "verdict"]} fields={fields} pageSize={8} table="sightings" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Example() {
  return (
    <MosaicDemo>
      <Board />
    </MosaicDemo>
  );
}
