"use client";

import { useState } from "react";
import {
  ActionBar,
  ActionBarClose,
  ActionBarContent,
  ActionBarValue,
  Button,
} from "@kanzo-tech/ui";

export default function Example() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setOpen(true)} variant="outline">
        Select three contracts
      </Button>

      <ActionBar
        onOpenChange={setOpen}
        open={open}
        positioning={{ placement: "bottom-end", gutter: "32px" }}
      >
        <ActionBarContent>
          <ActionBarValue count={3} label="3 selected" />
          <ActionBarClose asChild>
            <Button size="sm" variant="ghost">
              Done
            </Button>
          </ActionBarClose>
        </ActionBarContent>
      </ActionBar>
    </div>
  );
}
