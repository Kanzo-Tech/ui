"use client";

import {
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemGroup,
  ListboxItemIndicator,
  ListboxItemText,
} from "@kanzo-tech/ui";
import { BEASTS } from "@/example/world";

const beasts = createListCollection({
  items: BEASTS.map((beast) => ({ label: beast.label, value: beast.id, kind: beast.kind })),
  groupBy: (item) => item.kind,
});

export default function Example() {
  return (
    <Listbox className="w-56" collection={beasts}>
      <ListboxContent>
        {beasts.group().map(([kind, items]) => (
          <ListboxItemGroup heading={kind} key={kind}>
            {items.map((item) => (
              <ListboxItem item={item} key={item.value}>
                <ListboxItemText>{item.label}</ListboxItemText>
                <ListboxItemIndicator />
              </ListboxItem>
            ))}
          </ListboxItemGroup>
        ))}
      </ListboxContent>
    </Listbox>
  );
}
