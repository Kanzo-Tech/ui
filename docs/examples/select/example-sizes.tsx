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
    <div className="flex flex-col items-start gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Select collection={visibility} defaultValue={["private"]} key={size}>
          <SelectTrigger className="w-56" size={size}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibility.items.map((item) => (
              <SelectItem item={item} key={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
