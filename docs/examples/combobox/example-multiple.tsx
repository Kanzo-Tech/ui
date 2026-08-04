"use client";

import { TAGS } from "@/example/world";
import {
  Badge,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Show,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import { useState } from "react";

const TAG_ITEMS = TAGS.map((tag) => ({ label: tag, value: tag }));

export default function Example() {
  const [value, setValue] = useState<string[]>(["night-work"]);

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: TAG_ITEMS,
    filter: contains,
  });

  return (
    <div className="flex w-72 flex-col gap-2">
      <Combobox
        collection={collection}
        multiple
        onInputValueChange={(details) => filter(details.inputValue)}
        onValueChange={(details) => setValue(details.value)}
        value={value}
      >
        <ComboboxInput placeholder="Tag the contract…" />
        <ComboboxContent>
          <ComboboxEmpty>No tag by that name.</ComboboxEmpty>
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>

      <Show when={value.length > 0}>
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} size="xs" variant="secondary">
              {v}
            </Badge>
          ))}
        </div>
      </Show>
    </div>
  );
}
