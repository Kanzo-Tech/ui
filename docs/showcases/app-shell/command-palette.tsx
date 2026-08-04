"use client";

import { useEffect, useState } from "react";
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
  toast,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import { SearchIcon } from "lucide-react";
import { COMMANDS } from "@/example/nav";

/** The header search affordance and the ⌘K palette behind it. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: COMMANDS,
    filter: contains,
    groupBy: (item) => item.group,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        className="hidden gap-2 text-muted-foreground sm:flex"
        id="tour-search"
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
      >
        <SearchIcon />
        Search
        <Kbd className="ms-4">⌘</Kbd>
        <Kbd>K</Kbd>
      </Button>

      <CommandDialog onOpenChange={(details) => setOpen(details.open)} open={open}>
        <CommandDialogContent>
          <Command
            collection={collection}
            onInputValueChange={({ inputValue }) => filter(inputValue)}
            onValueChange={(details) => {
              const picked = collection.find(details.value[0] ?? "");
              if (picked) toast.create({ title: picked.label, type: "info" });
              setOpen(false);
            }}
          >
            <CommandInput placeholder="Search contracts, members or commands…" />
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
    </>
  );
}
