"use client";

import { useState } from "react";
import {
  Button,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuTrigger,
} from "@kanzo-tech/ui";

const COLUMNS = ["subject", "predicate", "object", "graph"];

export default function Example() {
  const [hidden, setHidden] = useState<string[]>(["graph"]);

  return (
    <Menu closeOnSelect={false}>
      <MenuTrigger asChild>
        <Button variant="outline">Columns</Button>
      </MenuTrigger>

      <MenuContent className="w-44">
        <MenuGroup heading="Visible columns">
          {COLUMNS.map((column) => (
            <MenuCheckboxItem
              checked={!hidden.includes(column)}
              key={column}
              onCheckedChange={(checked) =>
                setHidden((current) =>
                  checked
                    ? current.filter((c) => c !== column)
                    : [...current, column]
                )
              }
              value={column}
            >
              {column}
            </MenuCheckboxItem>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
