"use client";

import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

// Lanternwood is only invited, so it cannot sign for a contract yet.
const halls = createListCollection({
  items: [
    { label: "The Amber Hall", value: "amber" },
    { label: "The Order of Salt", value: "salt" },
    { label: "The Lanternwood Compact", value: "lanternwood", disabled: true },
  ],
  isItemDisabled: (item) => Boolean(item.disabled),
});

export default function Example() {
  return (
    <div className="flex flex-col items-start gap-3">
      <Select collection={halls} defaultValue={["amber"]} disabled>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {halls.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select collection={halls}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="One item disabled" />
        </SelectTrigger>
        <SelectContent>
          {halls.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
