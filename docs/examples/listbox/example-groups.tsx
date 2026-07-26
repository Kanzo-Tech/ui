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

const formats = createListCollection({
  items: [
    { label: "Turtle", value: "ttl", family: "Triples" },
    { label: "N-Triples", value: "nt", family: "Triples" },
    { label: "TriG", value: "trig", family: "Quads" },
    { label: "N-Quads", value: "nq", family: "Quads" },
  ],
  groupBy: (item) => item.family,
});

export default function Example() {
  return (
    <Listbox className="w-56" collection={formats}>
      <ListboxContent>
        {formats.group().map(([family, items]) => (
          <ListboxItemGroup heading={family} key={family}>
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
