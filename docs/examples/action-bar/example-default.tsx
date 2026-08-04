"use client";

import { HandIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { openQuests } from "@/example/quests";
import {
  ActionBar,
  ActionBarClose,
  ActionBarContent,
  ActionBarSeparator,
  ActionBarValue,
  Button,
} from "@kanzo-tech/ui";

const OPEN = openQuests();

export default function Example() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        disabled={selected === OPEN.length}
        onClick={() => setSelected((n) => n + 1)}
        variant="outline"
      >
        Select a contract
      </Button>
      <span className="text-muted-foreground text-sm">
        {selected} of {OPEN.length} open — a toolbar floats up from the bottom.
      </span>

      <ActionBar
        onOpenChange={(open) => !open && setSelected(0)}
        open={selected > 0}
      >
        <ActionBarContent>
          <ActionBarValue count={selected} label={`${selected} selected`} />
          <ActionBarSeparator />
          <Button size="sm" variant="ghost">
            <HandIcon /> Claim
          </Button>
          <Button size="sm" variant="ghost">
            <UsersIcon /> Reassign
          </Button>
          <Button className="text-destructive" size="sm" variant="ghost">
            <Trash2Icon /> Abandon
          </Button>
          <ActionBarSeparator />
          <ActionBarClose asChild>
            <Button aria-label="Clear selection" size="icon-xs" variant="ghost">
              <XIcon />
            </Button>
          </ActionBarClose>
        </ActionBarContent>
      </ActionBar>
    </div>
  );
}
