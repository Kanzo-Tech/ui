"use client";

import { useState } from "react";
import { Dashboard, FilterBar, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// No spec yet, so the relation's stats choose one: a filter per kind of field, drawn in the page's
// `FilterBar`, a count and a mean
// per measure, a chart per field and, given two measures, how one moves with the other. Edit any
// card or tile and `spec` holds the whole dashboard from then on — the one thing a host saves.

export default function Example() {
  const [spec, setSpec] = useState<DashboardSpec>();

  return (
    <MosaicDemo>
      <div className="flex w-full flex-col gap-4">
        <FilterBar rowNoun="sightings" table="sightings" />
        <Dashboard onChange={setSpec} table="sightings" value={spec} />
      </div>
    </MosaicDemo>
  );
}
