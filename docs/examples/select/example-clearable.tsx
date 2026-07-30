"use client";

import { BOARD_FILTERS } from "@/example/nav";
import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const statuses = createListCollection({ items: BOARD_FILTERS.status });

export default function Example() {
  return (
    <Select collection={statuses} defaultValue={["afield"]}>
      <SelectTrigger className="w-56" showClear>
        <SelectValue placeholder="Any status" />
      </SelectTrigger>
      <SelectContent>
        {statuses.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
