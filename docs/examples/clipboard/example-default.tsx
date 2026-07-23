"use client";

import {
  Clipboard,
  ClipboardControl,
  ClipboardInput,
  ClipboardLabel,
  ClipboardTrigger,
} from "@kanzo-tech/ui";

/**
 * A share link with a copy button that flips to a check for a moment after copying — the
 * whole flip is Ark's machine, so the timing and the reset are not our concern.
 */
export default function Example() {
  return (
    <Clipboard
      className="w-full max-w-sm"
      timeout={1200}
      value="https://kanzo.tech/share/aGVsbG8ta2Fuem8"
    >
      <ClipboardLabel>Share link</ClipboardLabel>
      <ClipboardControl>
        <ClipboardInput readOnly />
        <ClipboardTrigger aria-label="Copy link" />
      </ClipboardControl>
    </Clipboard>
  );
}
