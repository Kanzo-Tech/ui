"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  createListCollection,
} from "@kanzo-tech/ui";

const halls = createListCollection({
  items: [
    { label: "The Amber Hall", value: "amber" },
    { label: "The Order of Salt", value: "salt" },
  ],
});

export default function Example() {
  return (
    <Combobox collection={halls} disabled>
      <ComboboxInput className="w-72" placeholder="Filter by hall…" />
      <ComboboxContent>
        {halls.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
