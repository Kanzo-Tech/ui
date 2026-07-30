"use client";

import {
  Clipboard,
  ClipboardControl,
  ClipboardInput,
  ClipboardLabel,
  ClipboardTrigger,
} from "@kanzo-tech/ui";

/**
 * A contract's link with a copy button that flips to a check for a moment after copying — the
 * whole flip is Ark's machine, so the timing and the reset are not our concern.
 */
export default function Example() {
  return (
    <Clipboard
      className="w-full max-w-sm"
      timeout={1200}
      value="https://amberhall.example/board/Q-1041"
    >
      <ClipboardLabel>Contract link</ClipboardLabel>
      <ClipboardControl>
        <ClipboardInput readOnly />
        <ClipboardTrigger aria-label="Copy the contract link" />
      </ClipboardControl>
    </Clipboard>
  );
}
