"use client";

import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const statuses = createListCollection({
  items: [
    { label: "Open", value: "open" },
    { label: "Afield", value: "afield" },
  ],
});

export default function Example() {
  return (
    <div className="flex flex-col items-start gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Select collection={statuses} defaultValue={["afield"]} key={size}>
          <SelectTrigger className="w-56" size={size}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.items.map((item) => (
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
