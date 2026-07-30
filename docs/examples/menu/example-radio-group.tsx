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
  const [sort, setSort] = useState("posted");

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
          <MenuRadioItem value="posted">Recently posted</MenuRadioItem>
          <MenuRadioItem value="due">Due date</MenuRadioItem>
          <MenuRadioItem value="grade">Grade</MenuRadioItem>
          <MenuRadioItem value="reward">Reward</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
