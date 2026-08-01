"use client";

import { REGIONS } from "@/example/world";
import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const regions = createListCollection({
  items: REGIONS.map((region) => ({ label: region, value: region })),
});

export default function Example() {
  return (
    <Select collection={regions}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a region" />
      </SelectTrigger>
      <SelectContent>
        {regions.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
