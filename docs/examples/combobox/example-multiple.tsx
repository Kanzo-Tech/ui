"use client";

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

const DATASETS = [
  { label: "customers", value: "customers" },
  { label: "orders", value: "orders" },
  { label: "products", value: "products" },
  { label: "suppliers", value: "suppliers" },
  { label: "invoices", value: "invoices" },
];

export default function Example() {
  const [value, setValue] = useState<string[]>(["orders"]);

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: DATASETS,
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
        <ComboboxInput placeholder="Search datasets…" />
        <ComboboxContent>
          <ComboboxEmpty>No datasets found.</ComboboxEmpty>
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
