"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";

// The column this stands in for has a few hundred values, which is what `searchable` is for — not
// however many happen to survive the current crossfilter.
const STATIONS = [
  { count: 412, label: "A Coruña", value: "leco" },
  { count: 388, label: "Alacant", value: "lealc" },
  { count: 901, label: "Bilbao", value: "lebb" },
  { count: 1284, label: "Madrid", value: "lemd" },
  { count: 640, label: "Málaga", value: "lega" },
  { count: 233, label: "Santiago", value: "lest" },
];

export default function Example() {
  const [value, setValue] = useState<string[]>(["lemd"]);

  return (
    <FacetFilter
      items={STATIONS}
      label="Station"
      onValueChange={setValue}
      searchEmpty="No station by that name."
      searchPlaceholder="Filter stations…"
      searchable
      value={value}
    />
  );
}
