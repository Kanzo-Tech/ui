"use client";

import { Dashboard, FilterBar } from "@kanzo-tech/ui/analytics";
import { CONTRACTS_LAYOUT, ContractsDemo } from "./contracts";

// The same contracts as a fossil corpus hands them over: `dense_id`, and a layout's `x` and `y`
// beside the data. Mosaic aliases a mark's outputs `x` and `y` and groups by those names, so on this
// relation a line over `closed` would group by the layout instead — the dashboard reads it without
// the channel-named columns, and the line over time draws. `dense_id` is the host's key, excluded
// the way a host excludes its bookkeeping.

export default function Example() {
  return (
    <ContractsDemo table={CONTRACTS_LAYOUT}>
      <div className="flex w-full flex-col gap-4">
        <FilterBar rowNoun="contracts" table={CONTRACTS_LAYOUT} />
        <Dashboard exclude={["dense_id"]} table={CONTRACTS_LAYOUT} />
      </div>
    </ContractsDemo>
  );
}
