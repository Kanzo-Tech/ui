"use client";

import { useState } from "react";
import { Dashboard, FilterBar, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { GraphDemo, SIGHTINGS } from "./graph-demo";
import { EditingPage } from "./editing-page";

// No spec yet, so the pattern's stats — what the writer counted — choose one: a filter per kind of field, drawn in the page's
// `FilterBar`, a count and a mean
// per measure, a chart per field and, given two measures, how one moves with the other. Edit any
// card or tile and `spec` holds the whole dashboard from then on — the one thing a host saves. The
// editor draws in the page's aside, shown while a tile is edited.

export default function Example() {
  const [spec, setSpec] = useState<DashboardSpec>();

  return (
    <GraphDemo name="sightings">
      <EditingPage>
        <FilterBar rowNoun="sightings" relation={SIGHTINGS} />
        <Dashboard onChange={setSpec} relation={SIGHTINGS} value={spec} />
      </EditingPage>
    </GraphDemo>
  );
}
