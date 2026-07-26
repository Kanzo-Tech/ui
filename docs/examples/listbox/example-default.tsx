"use client";

import {
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
} from "@kanzo-tech/ui";

const formats = createListCollection({
  items: [
    { label: "Turtle", value: "ttl" },
    { label: "N-Triples", value: "nt" },
    { label: "TriG", value: "trig" },
    { label: "N-Quads", value: "nq" },
  ],
});

export default function Example() {
  return (
    <Listbox className="w-56" collection={formats} defaultValue={["ttl"]}>
      <ListboxLabel>Serialisation</ListboxLabel>
      <ListboxContent>
        {formats.items.map((item) => (
          <ListboxItem item={item} key={item.value}>
            <ListboxItemText>{item.label}</ListboxItemText>
            <ListboxItemIndicator />
          </ListboxItem>
        ))}
      </ListboxContent>
    </Listbox>
  );
}
