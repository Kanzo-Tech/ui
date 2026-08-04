"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { REGIONS } from "@/example/world";
import {
  Button,
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kanzo-tech/ui";

const regions = createListCollection({
  items: REGIONS.map((region) => ({ label: region, value: region })),
});

export default function Example() {
  const [value, setValue] = useState<string[]>([]);
  const chosen = regions.items.find((item) => item.value === value[0]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-56 justify-between" variant="outline">
          {chosen?.label ?? "Any region"}
          <ChevronsUpDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        <Listbox
          collection={regions}
          deselectable
          onValueChange={(details) => setValue(details.value)}
          value={value}
        >
          <ListboxContent>
            {regions.items.map((item) => (
              <ListboxItem item={item} key={item.value}>
                <ListboxItemText>{item.label}</ListboxItemText>
                <ListboxItemIndicator />
              </ListboxItem>
            ))}
          </ListboxContent>
        </Listbox>
      </PopoverContent>
    </Popover>
  );
}
