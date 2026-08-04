"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";
import { QUESTS } from "@/example/quests";
import { REGIONS } from "@/example/world";

// The board is filtered to night work, and Coldiron posts none — its count went to zero and it
// dropped out of `items`. It stays in the list because it is still ticked.
const NIGHT_WORK = REGIONS.map((region) => ({
  value: region,
  label: region,
  count: QUESTS.filter(
    (contract) => contract.region === region && contract.tags.includes("night-work")
  ).length,
})).filter((item) => item.count > 0);

export default function Example() {
  const [value, setValue] = useState<string[]>(["Duskfen", "Coldiron"]);

  return (
    <FacetFilter
      items={NIGHT_WORK}
      label="Region"
      note="Filtered to night work."
      onValueChange={setValue}
      value={value}
    />
  );
}
