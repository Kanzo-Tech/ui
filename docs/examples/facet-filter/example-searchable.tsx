"use client";

import { useState } from "react";
import { FacetFilter } from "@kanzo-tech/ui";
import { MEMBERS } from "@/example/people";

// The roster is thirty-five names across five halls and only grows, which is what `searchable` is
// for — the size of the domain, not however many happen to survive the current crossfilter.
const MEMBER_ITEMS = MEMBERS.map((candidate) => ({
  value: candidate.id,
  label: candidate.name,
  count: candidate.settled,
}));

export default function Example() {
  const [value, setValue] = useState<string[]>(["ravenna"]);

  return (
    <FacetFilter
      items={MEMBER_ITEMS}
      label="Member"
      onValueChange={setValue}
      searchEmpty="Nobody by that name."
      searchPlaceholder="Filter the roster…"
      searchable
      value={value}
    />
  );
}
