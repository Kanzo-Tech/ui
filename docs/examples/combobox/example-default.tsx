"use client";

import { MEMBERS } from "@/example/people";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const ROSTER = MEMBERS.map((entry) => ({ label: entry.name, value: entry.id }));

export default function Example() {
  // `useFilter` is locale-aware — "base" sensitivity means accents and case do not
  // block a match, so `miren` finds Mirén Costa.
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: ROSTER,
    filter: contains,
  });

  return (
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
    >
      <ComboboxInput className="w-72" placeholder="Find a member…" />
      <ComboboxContent>
        <ComboboxEmpty>No member by that name.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
