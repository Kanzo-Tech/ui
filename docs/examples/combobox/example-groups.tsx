"use client";

import { MEMBERS } from "@/example/people";
import { hall } from "@/example/world";
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

const ROSTER = MEMBERS.map((entry) => ({
  label: entry.name,
  value: entry.id,
  hall: hall(entry.hall).short,
}));

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: ROSTER,
    filter: contains,
    groupBy: (item) => item.hall,
  });

  return (
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
    >
      <ComboboxInput className="w-72" placeholder="Find a member…" />
      <ComboboxContent>
        <ComboboxEmpty>No member by that name.</ComboboxEmpty>
        {collection.group().map(([hallName, items]) => (
          <ComboboxGroup heading={hallName} key={hallName}>
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
