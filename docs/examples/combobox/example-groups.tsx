"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const DATASETS = [
  { label: "customers", value: "customers", family: "Core" },
  { label: "orders", value: "orders", family: "Core" },
  { label: "invoices", value: "invoices", family: "Billing" },
  { label: "shipments", value: "shipments", family: "Logistics" },
];

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: DATASETS,
    filter: contains,
    groupBy: (item) => item.family,
  });

  return (
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
    >
      <ComboboxInput className="w-72" placeholder="Search datasets…" />
      <ComboboxContent>
        <ComboboxEmpty>No datasets found.</ComboboxEmpty>
        {collection.group().map(([family, items]) => (
          <ComboboxGroup heading={family} key={family}>
            {items.map((item) => (
              <ComboboxItem item={item} key={item.value}>
                {item.label}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
