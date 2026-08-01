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
import { COMMANDS } from "@/example/nav";

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
