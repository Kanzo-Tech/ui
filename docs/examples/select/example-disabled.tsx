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
    { label: "Restricted", value: "restricted", disabled: true },
  ],
  isItemDisabled: (item) => Boolean(item.disabled),
});

export default function Example() {
  return (
    <div className="flex flex-col items-start gap-3">
      <Select collection={visibility} defaultValue={["private"]} disabled>
        <SelectTrigger className="w-56">
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

      <Select collection={visibility}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="One item disabled" />
        </SelectTrigger>
        <SelectContent>
          {visibility.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
