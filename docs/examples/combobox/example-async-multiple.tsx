"use client";

import { searchTags } from "@/example/lookup";
import {
  Badge,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Show,
  useAsyncCollection,
} from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import { useState } from "react";

export default function Example() {
  const [value, setValue] = useState<string[]>([]);
  const { collection, empty, labelOf, setQuery } = useAsyncCollection({ load: searchTags });

  return (
    <div className="flex w-72 flex-col gap-2">
      <Combobox
        collection={collection}
        multiple
        onInputValueChange={(details) => setQuery(details.inputValue)}
        onValueChange={(details) => setValue(details.value)}
        value={value}
      >
        <ComboboxInput placeholder="Tag the contract…" />
        <ComboboxContent>
          {empty && <ComboboxEmpty>No tag by that name.</ComboboxEmpty>}
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>

      {/* `labelOf` is what keeps a chosen tag reading as its label after the next query has
          replaced the batch that offered it. */}
      <Show when={value.length > 0}>
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge asChild key={v} size="sm" variant="secondary">
              <button
                onClick={() => setValue((all) => all.filter((x) => x !== v))}
                type="button"
              >
                {labelOf(v) ?? v}
                <XIcon aria-hidden />
                <span className="sr-only">Remove</span>
              </button>
            </Badge>
          ))}
        </div>
      </Show>
    </div>
  );
}
