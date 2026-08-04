"use client";

import { useMemo, useState } from "react";
import { MEMBERS } from "@/example/people";
import {
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxEmpty,
  ListboxInput,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
  useFilter,
} from "@kanzo-tech/ui";

const ROSTER = MEMBERS.map((entry) => ({ label: entry.name, value: entry.id }));

// Hoisted, not inlined: `useFilter` memoises on the options object by identity, so a literal
// hands back a fresh `contains` on every render — and here that rebuilds the collection on
// every render too.
const SENSITIVITY = { sensitivity: "base" } as const;

export default function Example() {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<string[]>([]);
  const { contains } = useFilter(SENSITIVITY);

  // `Listbox.Input` filters nothing by itself — the machine holds no input value. It wires the
  // ARIA and forwards the arrows and Enter to the list; narrowing the collection is yours, as
  // it is with `Combobox`.
  const collection = useMemo(
    () =>
      createListCollection({
        items: ROSTER.filter((item) => contains(item.label, query)),
      }),
    [contains, query]
  );

  return (
    <Listbox
      className="w-72"
      collection={collection}
      onValueChange={(details) => setValue(details.value)}
      selectionMode="multiple"
      value={value}
    >
      <ListboxLabel>Roster</ListboxLabel>

      {/* `autoHighlight` re-aims at the first surviving row on every keystroke, so Enter takes
          the top match without an ArrowDown first. */}
      <ListboxInput
        autoHighlight
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter the roster…"
        value={query}
      />

      <ListboxContent className="max-h-56 overflow-y-auto">
        {collection.items.map((item) => (
          <ListboxItem item={item} key={item.value}>
            <ListboxItemText>{item.label}</ListboxItemText>

            <ListboxItemIndicator />
          </ListboxItem>
        ))}

        <ListboxEmpty>No member by that name.</ListboxEmpty>
      </ListboxContent>
    </Listbox>
  );
}
