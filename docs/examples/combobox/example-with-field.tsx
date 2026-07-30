"use client";

import { availableNow } from "@/example/roster";
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

const READY = availableNow().map((entry) => ({
  label: entry.name,
  value: entry.id,
}));

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: READY,
    filter: contains,
  });

  return (
    <Field className="w-72">
      <FieldLabel>Add to the party</FieldLabel>
      <Combobox
        collection={collection}
        onInputValueChange={(details) => filter(details.inputValue)}
      >
        <ComboboxInput placeholder="Find a member…" />
        <ComboboxContent>
          <ComboboxEmpty>Nobody free by that name.</ComboboxEmpty>
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <FieldDescription>Only members who are ready today.</FieldDescription>
    </Field>
  );
}
