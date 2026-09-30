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
  Spinner,
  useAsyncCollection,
} from "@kanzo-tech/ui";

export default function Example() {
  const { collection, empty, loading, setQuery } = useAsyncCollection({ load: searchTags });

  return (
    <Field className="w-72">
      <FieldLabel>Tag</FieldLabel>
      <Combobox
        collection={collection}
        onInputValueChange={(details) => setQuery(details.inputValue)}
      >
        <ComboboxInput placeholder="Search the archive…" />
        <ComboboxContent>
          {loading && collection.items.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-2 py-1.5 text-muted-foreground text-sm">
              <Spinner /> Searching…
            </div>
          )}
          {empty && <ComboboxEmpty>No tag by that name.</ComboboxEmpty>}
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <FieldHelper>{loading ? "Searching…" : "The list is fetched as you type."}</FieldHelper>
    </Field>
  );
}
