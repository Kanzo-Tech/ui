"use client";

import { useState } from "react";
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

const providers = createListCollection({
  items: [
    { label: "AEMET", value: "aemet" },
    { label: "Copernicus", value: "copernicus" },
    { label: "NOAA", value: "noaa" },
    { label: "ECMWF", value: "ecmwf" },
  ],
});

export default function Example() {
  const [value, setValue] = useState<string[]>(["aemet", "noaa"]);

  return (
    <div className="flex w-56 flex-col gap-3">
      <Listbox
        collection={providers}
        onValueChange={(details) => setValue(details.value)}
        selectionMode="multiple"
        value={value}
      >
        <ListboxLabel>Providers</ListboxLabel>
        <ListboxContent>
          {providers.items.map((item) => (
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
