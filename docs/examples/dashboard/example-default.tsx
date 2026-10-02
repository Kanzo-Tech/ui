"use client";

import { useState } from "react";
import { Dashboard, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// No spec yet, so the relation's stats choose one: a filter per kind of field, a count and a mean
// per measure, a chart per field and, given two measures, how one moves with the other. Edit any
// card or tile and `spec` holds the whole dashboard from then on — the one thing a host saves.

export default function Example() {
  const [spec, setSpec] = useState<DashboardSpec>();

  return (
    <MosaicDemo>
      <Dashboard className="w-full" onChange={setSpec} rowNoun="sightings" table="sightings" value={spec} />
    </MosaicDemo>
  );
}
