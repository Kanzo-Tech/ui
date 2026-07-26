"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";

// Europe is filtered, so the crossfilter no longer offers NOAA at all — its count went to zero and
// it dropped out of `items`. It stays in the list because it is still ticked.
const IN_EUROPE = [
  { value: "aemet", label: "AEMET", count: 1284 },
  { value: "copernicus", label: "Copernicus", count: 903 },
];

export default function Example() {
  const [value, setValue] = useState<string[]>(["aemet", "noaa"]);

  return (
    <FacetFilter
      items={IN_EUROPE}
      label="Provider"
      note="Filtered to Europe."
      onValueChange={setValue}
      value={value}
    />
  );
}
