"use client";

import { useState } from "react";
import { Dashboard, FilterBar, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { CONTRACTS, ContractsDemo } from "./contracts";
import { EditingPage } from "./editing-page";

// A relation with a time, and the four filter controls the stats choose: `closed` is a timeline
// brush leading the bar, `hall` / `region` / `outcome` are facet filters, `id` — a value nearly
// every row has its own of — is a search box, and `reward` is a range slider. The tiles trend along
// `closed`, so each delta compares the last step of time with the one before it.

export default function Example() {
  const [spec, setSpec] = useState<DashboardSpec>();

  return (
    <ContractsDemo table={CONTRACTS}>
      <EditingPage>
        <FilterBar rowNoun="contracts" table={CONTRACTS} />
        <Dashboard onChange={setSpec} table={CONTRACTS} value={spec} />
      </EditingPage>
    </ContractsDemo>
  );
}
