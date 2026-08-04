"use client";

import { ROLES } from "@/example/world";
import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const roles = createListCollection({
  items: ROLES.map((role) => ({ label: role.label, value: role.id })),
});

export default function Example() {
  return (
    <Select collection={roles} defaultValue={["warden", "cantor"]} multiple>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Roles the party must carry" />
      </SelectTrigger>
      <SelectContent>
        {roles.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
