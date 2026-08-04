"use client";

import { Fragment } from "react";
import { HALLS } from "@/example/world";
import {
  createListCollection,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Show,
} from "@kanzo-tech/ui";

// `groupBy` lets the collection own the grouping, so `collection.group()` returns the
// [heading, items] pairs to render — the component never re-derives them.
const halls = createListCollection({
  items: HALLS.map((entry) => ({
    label: entry.short,
    value: entry.id,
    standing: entry.standing,
  })),
  groupBy: (item) => item.standing,
});

export default function Example() {
  return (
    <Select collection={halls}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a hall" />
      </SelectTrigger>
      <SelectContent>
        {halls.group().map(([standing, items], index) => (
          <Fragment key={standing}>
            <Show when={index > 0}>
              <SelectSeparator />
            </Show>
            <SelectGroup heading={standing}>
              {items.map((item) => (
                <SelectItem item={item} key={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}
