"use client";

import { useState } from "react";
import { ModelList, ModelListItem } from "@kanzo-tech/ai";
import {
  Badge,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  createListCollection,
} from "@kanzo-tech/ui";

/**
 * The list, and the thing it exists for: pick a model, and it is still picked afterwards.
 *
 * Swap `ModelList` for `Command` and the tick disappears the moment you click — the query survives
 * and the value does not, which is a palette behaving correctly and a picker behaving like a bug.
 * The badge below reads the state back so the difference is visible without a devtools panel.
 */
const MODELS = [
  { value: "opus", label: "Opus", note: "The one that reads the whole board" },
  { value: "sonnet", label: "Sonnet", note: "Everyday work" },
  { value: "haiku", label: "Haiku", note: "Fast, and cheap enough to loop" },
  { value: "local", label: "Local", note: "Runs on the hall's own machine" },
];

const collection = createListCollection({ items: MODELS });

export default function Example() {
  const [model, setModel] = useState("sonnet");
  const chosen = MODELS.find((m) => m.value === model);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <ModelList
        className="max-h-72"
        collection={collection}
        onValueChange={(details) => setModel(details.value[0] ?? model)}
        value={[model]}
      >
        <CommandInput placeholder="Search models" />
        <CommandList>
          <CommandEmpty>No model by that name.</CommandEmpty>
          <CommandGroup>
            {MODELS.map((entry) => (
              <ModelListItem item={entry} key={entry.value}>
                <span className="flex min-w-0 flex-col">
                  <span>{entry.label}</span>
                  <span className="truncate text-muted-foreground text-xs">{entry.note}</span>
                </span>
              </ModelListItem>
            ))}
          </CommandGroup>
        </CommandList>
      </ModelList>

      <Badge variant="secondary">Answering with {chosen?.label}</Badge>
    </div>
  );
}
