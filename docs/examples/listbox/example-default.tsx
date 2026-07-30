"use client";

import { ROLES } from "@/example/world";
import {
  createListCollection,
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
} from "@kanzo-tech/ui";

const roles = createListCollection({
  items: ROLES.map((role) => ({ label: role.label, value: role.id })),
});

export default function Example() {
  return (
    <Listbox className="w-56" collection={roles} defaultValue={["warden"]}>
      <ListboxLabel>Duty on this contract</ListboxLabel>
      <ListboxContent>
        {roles.items.map((item) => (
          <ListboxItem item={item} key={item.value}>
            <ListboxItemText>{item.label}</ListboxItemText>
            <ListboxItemIndicator />
          </ListboxItem>
        ))}
      </ListboxContent>
    </Listbox>
  );
}
