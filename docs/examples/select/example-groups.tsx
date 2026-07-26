"use client";

import { Fragment } from "react";
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
const formats = createListCollection({
  items: [
    { label: "Turtle", value: "ttl", family: "Triples" },
    { label: "N-Triples", value: "nt", family: "Triples" },
    { label: "TriG", value: "trig", family: "Quads" },
    { label: "N-Quads", value: "nq", family: "Quads" },
  ],
  groupBy: (item) => item.family,
});

export default function Example() {
  return (
    <Select collection={formats}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a format" />
      </SelectTrigger>
      <SelectContent>
        {formats.group().map(([family, items], index) => (
          <Fragment key={family}>
            <Show when={index > 0}>
              <SelectSeparator />
            </Show>
            <SelectGroup heading={family}>
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
