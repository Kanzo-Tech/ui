"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Field,
  FieldDescription,
  FieldLabel,
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
    <Field className="w-72">
      <FieldLabel>Linked dataset</FieldLabel>
      <Combobox
        collection={collection}
        onInputValueChange={(details) => filter(details.inputValue)}
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
      <FieldDescription>The list narrows as you type.</FieldDescription>
    </Field>
  );
}
