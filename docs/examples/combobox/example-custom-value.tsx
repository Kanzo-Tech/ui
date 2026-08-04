"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Field,
  FieldHelper,
  FieldLabel,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import { useState } from "react";

const TAGS = [
  { label: "escort", value: "escort" },
  { label: "bounty", value: "bounty" },
  { label: "night-work", value: "night-work" },
];

export default function Example() {
  const [inputValue, setInputValue] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: TAGS,
    filter: contains,
  });

  const isCustom = inputValue.length > 0 && !selected.includes(inputValue);

  return (
    <Field className="w-72">
      <FieldLabel>Tag</FieldLabel>
      <Combobox
        allowCustomValue
        collection={collection}
        onInputValueChange={(details) => {
          setInputValue(details.inputValue);
          filter(details.inputValue);
        }}
        onValueChange={(details) => setSelected(details.value)}
      >
        <ComboboxInput placeholder="Pick or invent a tag…" />
        <ComboboxContent>
          <ComboboxEmpty>Not in the list — it will be used as typed.</ComboboxEmpty>
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <FieldHelper>
        {isCustom ? `New tag: ${inputValue}` : "The board takes tags nobody has posted yet."}
      </FieldHelper>
    </Field>
  );
}
