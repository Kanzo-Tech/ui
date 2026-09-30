"use client";

import { searchTags } from "@/example/lookup";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Field,
  FieldHelper,
  FieldLabel,
  useAsyncCollection,
  useDebouncedCommit,
} from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  // The board this writes to revalidates on every write, so a tag typed by hand is committed once
  // the typing pauses — and at once on blur or on a pick, never a letter at a time.
  const [tag, setTag] = useState<string | null>(null);
  const { change, commit, flush } = useDebouncedCommit(tag, setTag);
  const { collection, empty, setQuery } = useAsyncCollection({ load: searchTags });

  return (
    <Field className="w-72">
      <FieldLabel>Tag</FieldLabel>
      <Combobox
        allowCustomValue
        collection={collection}
        onInputValueChange={(details) => {
          setQuery(details.inputValue);
          change(details.inputValue || null);
        }}
        onValueChange={(details) => commit(details.value[0] ?? null)}
      >
        <ComboboxInput onBlur={flush} placeholder="Pick or invent a tag…" showTrigger={false} />
        <ComboboxContent>
          {empty && <ComboboxEmpty>Not in the archive — it will be used as typed.</ComboboxEmpty>}
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <FieldHelper>
        Committed: <code>{tag ?? "nothing yet"}</code>
      </FieldHelper>
    </Field>
  );
}
