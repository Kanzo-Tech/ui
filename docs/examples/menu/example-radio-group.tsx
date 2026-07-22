"use client";

import { useState } from "react";
import {
  Button,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  const [sort, setSort] = useState("recent");

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Sort by</Button>
      </MenuTrigger>

      <MenuContent className="w-44">
        <MenuRadioGroup
          heading="Sort by"
          onValueChange={(details) => setSort(details.value)}
          value={sort}
        >
          <MenuRadioItem value="recent">Most recent</MenuRadioItem>
          <MenuRadioItem value="name">Name</MenuRadioItem>
          <MenuRadioItem value="size">Triple count</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
