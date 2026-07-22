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
    { label: "Restricted", value: "restricted" },
  ],
});

export default function Example() {
  return (
    <Select collection={visibility}>
      <SelectTrigger className="w-56">
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
