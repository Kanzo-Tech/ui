"use client";

import { Toggle, ToggleIndicator } from "@kanzo-tech/ui";
import { BellIcon, BellOffIcon } from "lucide-react";
import { useState } from "react";

/** A single stateful toggle that reads as on/off — and swaps its own icon with the state, via
 *  `ToggleIndicator`, so the control shows what it will do rather than what it did. */
export default function Example() {
  const [muted, setMuted] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Toggle
        aria-label={muted ? "Unmute notifications" : "Mute notifications"}
        onPressedChange={setMuted}
        pressed={muted}
        variant="outline"
      >
        <ToggleIndicator fallback={<BellIcon />}>
          <BellOffIcon />
        </ToggleIndicator>
      </Toggle>
      <span className="text-muted-foreground text-sm">
        Notifications {muted ? "muted" : "on"}
      </span>
    </div>
  );
}
