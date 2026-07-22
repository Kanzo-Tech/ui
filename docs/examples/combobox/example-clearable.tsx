"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const DATASETS = [
  { label: "customers", value: "customers" },
  { label: "orders", value: "orders" },
  { label: "products", value: "products" },
];

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: DATASETS,
    filter: contains,
  });

  return (
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
    >
      <ComboboxInput
        className="w-72"
        placeholder="Filter datasets…"
        showClear
        showTrigger={false}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching datasets.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
