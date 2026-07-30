"use client";

import { useState } from "react";
import { AVAILABILITY } from "@/example/world";
import {
  Badge,
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
  Show,
} from "@kanzo-tech/ui";

const availability = createListCollection({
  items: AVAILABILITY.map((state) => ({ label: state.label, value: state.id })),
});

export default function Example() {
  const [value, setValue] = useState<string[]>(["ready", "resting"]);

  return (
    <div className="flex w-56 flex-col gap-3">
      <Listbox
        collection={availability}
        onValueChange={(details) => setValue(details.value)}
        selectionMode="multiple"
        value={value}
      >
        <ListboxLabel>Availability</ListboxLabel>
        <ListboxContent>
          {availability.items.map((item) => (
            <ListboxItem item={item} key={item.value}>
              <ListboxItemText>{item.label}</ListboxItemText>
              <ListboxItemIndicator />
            </ListboxItem>
          ))}
        </ListboxContent>
      </Listbox>

      <Show when={value.length > 0}>
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} size="xs" variant="secondary">
              {v}
            </Badge>
          ))}
        </div>
      </Show>
    </div>
  );
}
