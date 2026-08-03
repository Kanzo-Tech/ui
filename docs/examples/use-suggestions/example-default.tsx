"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  Show,
  Spinner,
  type Suggestion,
  useSuggestions,
} from "@kanzo-tech/ui";
import { useState } from "react";

// A stub `suggest`. It yields whole candidates — and deliberately repeats one already chosen,
// to show the dedup dropping it before it is ever rendered.
const POOL: Suggestion[] = [
  { value: "climate", rationale: "Already chosen — dropped by the dedup." },
  { value: "meteorology", rationale: "The domain vocabulary uses this term." },
  { value: "observations", rationale: "Matches the source table name." },
  { value: "hourly", rationale: "Sampling interval declared in the schema." },
  { value: "temperature", rationale: "Present in 92% of rows." },
  { value: "spain", rationale: "Every record carries an ES region code." },
];

async function* suggest(signal?: AbortSignal) {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 260));
    if (signal?.aborted) return;
    yield item;
  }
}

export default function Example() {
  const [chosen, setChosen] = useState<string[]>(["climate"]);
  const suggestions = useSuggestions({ suggest, existing: chosen, window: 3 });

  const pick = (index: number, value: string) => {
    setChosen((prev) => [...prev, value]);
    suggestions.dismiss(index);
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
          </Badge>
        ))}
      </div>

      <ButtonGroup aria-label="Suggestion controls">
        <Button onClick={suggestions.start} size="sm" variant="outline">
          Suggest keywords
        </Button>
        <Button onClick={suggestions.cancel} size="sm" variant="outline">
          Cancel
        </Button>
      </ButtonGroup>

      <ul className="flex flex-col gap-2">
        {suggestions.items.map((item, index) => (
          <li
            className="flex items-center gap-3 rounded-md border p-2"
            key={item.value}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-sm">{item.label ?? item.value}</span>
              <Show when={Boolean(item.rationale)}>
                <span className="block text-muted-foreground text-xs">{item.rationale}</span>
              </Show>
            </span>
            <ButtonGroup aria-label={`Actions for ${item.value}`}>
              <Button onClick={() => pick(index, item.value)} size="sm" variant="outline">
                Add
              </Button>
              <Button onClick={() => suggestions.dismiss(index)} size="sm" variant="outline">
                Skip
              </Button>
            </ButtonGroup>
          </li>
        ))}
      </ul>

      <Show when={suggestions.loading}>
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner className="size-4" /> Streaming candidates…
        </span>
      </Show>

      <Show when={suggestions.error !== null}>
        <p className="text-destructive text-xs">{suggestions.error}</p>
      </Show>
    </div>
  );
}
