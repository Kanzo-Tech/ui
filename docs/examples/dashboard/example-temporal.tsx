"use client";

import { useState } from "react";
import { Dashboard, FilterBar, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { CONTRACTS, GraphDemo } from "./graph-demo";
import { EditingPage } from "./editing-page";

// A pattern with a time, and the four filter controls the stats choose: `contract.closed` is a
// timeline brush leading the bar, `hall` / `region` / `outcome` are facet filters, `subject` — the
// key the graph declares primary — is a search box, and `reward` is a range slider. The tiles trend
// along `closed`, so each delta compares the last step of time with the one before it.

export default function Example() {
  const [spec, setSpec] = useState<DashboardSpec>();

  return (
    <GraphDemo name="contracts">
      <EditingPage>
        <FilterBar rowNoun="contracts" relation={CONTRACTS} />
        <Dashboard onChange={setSpec} relation={CONTRACTS} value={spec} />
      </EditingPage>
    </GraphDemo>
  );
}
