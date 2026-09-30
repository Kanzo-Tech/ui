"use client";

import { searchTags } from "@/example/lookup";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useAsyncCollection,
} from "@kanzo-tech/ui";

export default function Example() {
  const { collection, empty, loading, setQuery } = useAsyncCollection({
    debounce: 300,
    load: searchTags,
  });

  return (
    <div className="flex w-72 flex-col gap-2">
      <Combobox
        collection={collection}
        onInputValueChange={(details) => setQuery(details.inputValue)}
      >
        <ComboboxInput placeholder="Search the archive…" />
        <ComboboxContent>
          {empty && <ComboboxEmpty>No tag by that name.</ComboboxEmpty>}
          {collection.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <p className="text-muted-foreground text-sm">
        {loading ? "Searching…" : `${collection.items.length} offered`}
      </p>
    </div>
  );
}
