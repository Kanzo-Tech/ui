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
  { label: "suppliers", value: "suppliers" },
  { label: "invoices", value: "invoices" },
];

export default function Example() {
  // `useFilter` is locale-aware — "base" sensitivity means accents and case do not
  // block a match, which is what a user typing quickly expects.
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
      <ComboboxInput className="w-72" placeholder="Search datasets…" />
      <ComboboxContent>
        <ComboboxEmpty>No datasets found.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
