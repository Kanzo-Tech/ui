"use client";

import { useState } from "react";
import {
  Button,
  Command,
  CommandContent,
  CommandDialog,
  CommandDialogContent,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Kbd,
  Show,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const COMMANDS = [
  { label: "New dataset", value: "new-dataset", group: "Actions" },
  { label: "Import from URL", value: "import", group: "Actions" },
  { label: "Open settings", value: "settings", group: "Preferences" },
];

export default function Example() {
  const [open, setOpen] = useState(false);
  const [ran, setRan] = useState<string | null>(null);

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: COMMANDS,
    filter: contains,
    groupBy: (item) => item.group,
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setOpen(true)} variant="outline">
        Command palette <Kbd>⌘</Kbd> <Kbd>K</Kbd>
      </Button>
      <Show when={!!ran}>
        <span className="text-muted-foreground text-sm">Ran: {ran}</span>
      </Show>

      <CommandDialog onOpenChange={(e) => setOpen(e.open)} open={open}>
        <CommandDialogContent>
          <Command
            collection={collection}
            onInputValueChange={({ inputValue }) => filter(inputValue)}
            onValueChange={(details) => {
              if (details.value[0]) {
                setRan(details.value[0]);
              }
              setOpen(false);
            }}
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
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </CommandContent>
          </Command>
        </CommandDialogContent>
      </CommandDialog>
    </div>
  );
}
