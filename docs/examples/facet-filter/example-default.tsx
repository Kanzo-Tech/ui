"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";
import { countBy } from "@/example/quests";
import { REGIONS } from "@/example/world";

const counts = countBy((contract) => contract.region);

const ITEMS = REGIONS.map((region) => ({
  value: region,
  label: region,
  count: counts[region],
}));

export default function Example() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <FacetFilter
      items={ITEMS}
      label="Region"
      onValueChange={setValue}
      value={value}
    />
  );
}
