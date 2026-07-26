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

const TABLES = [
  { label: "customers", value: "customers" },
  { label: "customer_events", value: "customer_events" },
  { label: "orders", value: "orders" },
  { label: "order_lines", value: "order_lines" },
  { label: "products", value: "products" },
  { label: "suppliers", value: "suppliers" },
];

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: TABLES,
    filter: contains,
  });

  return (
    // No trigger and no open-on-click: the popover appears once there is something typed.
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
      openOnClick={false}
    >
      <ComboboxInput className="w-72" placeholder="Search tables…" showTrigger={false} />
      <ComboboxContent>
        <ComboboxEmpty>No tables found.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
