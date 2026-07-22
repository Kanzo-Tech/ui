"use client";

import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  ActionBar,
  ActionBarClose,
  ActionBarContent,
  ActionBarSeparator,
  ActionBarValue,
  Button,
} from "@kanzo-tech/ui";

export default function Example() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setSelected((n) => n + 1)} variant="outline">
        Select a row
      </Button>
      <span className="text-muted-foreground text-sm">
        {selected} selected — a toolbar floats up from the bottom.
      </span>

      <ActionBar
        onOpenChange={(open) => !open && setSelected(0)}
        open={selected > 0}
      >
        <ActionBarContent>
          <ActionBarValue count={selected} label={`${selected} selected`} />
          <ActionBarSeparator />
          <Button size="sm" variant="ghost">
            <PencilIcon /> Edit
          </Button>
          <Button className="text-destructive" size="sm" variant="ghost">
            <Trash2Icon /> Delete
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
