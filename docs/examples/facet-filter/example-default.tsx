"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";

const PROVIDERS = [
  { value: "aemet", label: "AEMET", count: 1284 },
  { value: "copernicus", label: "Copernicus", count: 903 },
  { value: "noaa", label: "NOAA", count: 412 },
  { value: "ecmwf", label: "ECMWF", count: 87 },
];

export default function Example() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <FacetFilter
      items={PROVIDERS}
      label="Provider"
      onValueChange={setValue}
      value={value}
    />
  );
}
