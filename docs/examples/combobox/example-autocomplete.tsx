"use client";

import { QUESTS } from "@/example/quests";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";

const CONTRACTS = QUESTS.map((contract) => ({
  label: contract.title,
  value: contract.id,
}));

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: CONTRACTS,
    filter: contains,
  });

  return (
    // No trigger and no open-on-click: the popover appears once there is something typed.
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
      openOnClick={false}
    >
      <ComboboxInput className="w-72" placeholder="Search the board…" showTrigger={false} />
      <ComboboxContent>
        <ComboboxEmpty>Nothing on the board says that.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
