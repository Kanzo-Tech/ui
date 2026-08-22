"use client";

import { ScrollIcon } from "lucide-react";
import { useState } from "react";
import { Show } from "@kanzo-tech/ui";
import { PaneHeader } from "@/showcases/shared";
import { RULES_SOURCE } from "@/example/rules";

export default function Example() {
  const [open, setOpen] = useState(true);

  return (
    <div className="w-full max-w-md overflow-hidden rounded-lg border bg-card">
      <Show when={open}>
        <PaneHeader
          detail="Amber Hall"
          icon={ScrollIcon}
          onClose={() => setOpen(false)}
          title="Standing orders"
          tone="success"
        />
        <pre className="max-h-40 overflow-auto px-3 py-2 text-muted-foreground text-xs">
          {RULES_SOURCE}
        </pre>
      </Show>
      <Show when={!open}>
        <button
          className="w-full px-3 py-2 text-muted-foreground text-xs"
          onClick={() => setOpen(true)}
          type="button"
        >
          Reopen the panel
        </button>
      </Show>
    </div>
  );
}
