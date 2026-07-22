"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  createListCollection,
} from "@kanzo-tech/ui";

const datasets = createListCollection({
  items: [
    { label: "customers", value: "customers" },
    { label: "orders", value: "orders" },
  ],
});

export default function Example() {
  return (
    <Combobox collection={datasets} disabled>
      <ComboboxInput className="w-72" placeholder="Search datasets…" />
      <ComboboxContent>
        {datasets.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
