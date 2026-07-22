"use client";

import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const visibility = createListCollection({
  items: [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ],
});

export default function Example() {
  return (
    <Select collection={visibility} defaultValue={["private"]}>
      <SelectTrigger className="w-56" showClear>
        <SelectValue placeholder="Select visibility" />
      </SelectTrigger>
      <SelectContent>
        {visibility.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
