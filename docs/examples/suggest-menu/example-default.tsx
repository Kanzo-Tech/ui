"use client";

import { useState } from "react";
import { Badge, SuggestMenu, type Suggestion } from "@kanzo-tech/ui";

const POOL: Suggestion[] = [
  { value: "climate", rationale: "Recurs across every AEMET dataset." },
  { value: "meteorology", rationale: "The domain vocabulary uses this term." },
  { value: "observations", rationale: "Matches the source table name." },
  { value: "spain", rationale: "Every record carries an ES region code." },
  { value: "hourly", rationale: "Sampling interval declared in the schema." },
  { value: "temperature", rationale: "Present in 92% of rows." },
];

// The component is source-agnostic: it consumes any async iterable, so a real call site
// yields straight from a streaming model response.
async function* suggest(): AsyncIterable<Suggestion> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    yield item;
  }
}

export default function Example() {
  const [keywords, setKeywords] = useState(["climate"]);

  return (
    <div className="flex w-72 items-center gap-2">
      <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1 rounded-md border px-2 py-1">
        {keywords.map((k) => (
          <Badge key={k} size="sm" variant="secondary">
            {k}
          </Badge>
        ))}
      </div>
      <SuggestMenu
        existing={keywords}
        suggest={suggest}
        onPick={(value) => setKeywords((prev) => [...prev, value])}
      />
    </div>
  );
}
