"use client";

import {
  Command,
  CommandContent,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Show,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const COMMANDS = [
  { label: "New dataset", value: "new-dataset", group: "Actions", shortcut: "⌘N" },
  { label: "Search datasets", value: "search", group: "Actions", shortcut: "⌘F" },
  { label: "Import from URL", value: "import", group: "Actions" },
  { label: "Toggle theme", value: "theme", group: "Preferences", shortcut: "T" },
  { label: "Open settings", value: "settings", group: "Preferences", shortcut: "⌘," },
];

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: COMMANDS,
    filter: contains,
    groupBy: (item) => item.group,
  });

  return (
    <div className="flex h-80 w-full max-w-md flex-col">
      <Command
        collection={collection}
        onInputValueChange={({ inputValue }) => filter(inputValue)}
      >
        <CommandInput placeholder="Type a command or search…" />
        <CommandContent>
          <CommandEmpty />
          <CommandList>
            {collection.group().map(([group, items]) => (
              <CommandGroup heading={group} key={group}>
                {items.map((item) => (
                  <CommandItem item={item} key={item.value}>
                    {item.label}
                    <Show when={!!item.shortcut}>
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    </Show>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandContent>
      </Command>
    </div>
  );
}
