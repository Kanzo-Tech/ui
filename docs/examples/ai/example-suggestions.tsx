"use client";

import {
  Badge,
  Field,
  FieldLabel,
  FieldSuggest,
  type Suggestion,
} from "@kanzo-tech/ui";
import { useState } from "react";

const POOL: Suggestion[] = [
  { value: "climate", rationale: "Recurs across every AEMET dataset." },
  { value: "meteorology", rationale: "The domain vocabulary uses this term." },
  { value: "observations", rationale: "Matches the source table name." },
  { value: "spain", rationale: "Every record carries an ES region code." },
  { value: "hourly", rationale: "Sampling interval declared in the schema." },
  { value: "temperature", rationale: "Present in 92% of rows." },
];

// Source-agnostic: any async iterable that honours the signal. A real call site yields straight
// from a streaming model response.
async function* suggest(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    if (signal?.aborted) return;
    yield item;
  }
}

// `suggest` / `existing` / `onPick` are declared once on `Field`; `FieldSuggest` is the ✨ menu
// that reads them from the provider. The hook underneath owns the streaming, the live dedup
// against what's already chosen, and the fixed window that refills as you dismiss rows.
export default function Example() {
  const [keywords, setKeywords] = useState<string[]>(["climate"]);

  return (
    <Field
      className="w-72"
      existing={keywords}
      onPick={(value) => setKeywords((prev) => [...prev, value])}
      suggest={suggest}
    >
      <FieldLabel>
        Keywords
        <FieldSuggest className="ms-auto" label="Suggest keywords" />
      </FieldLabel>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border px-2 py-1">
        {keywords.map((k) => (
          <Badge key={k} size="sm" variant="secondary">
            {k}
          </Badge>
        ))}
      </div>
    </Field>
  );
}
