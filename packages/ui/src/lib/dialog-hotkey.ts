"use client";

import { useDialogContext } from "@ark-ui/react/dialog";
import { type Hotkey, useHotkey } from "./use-hotkey.js";

/**
 * Toggles the dialog it sits in through Ark's own machine, so a controlled `open` hears
 * `onOpenChange` — rendered inside the root, because the root's own render cannot read its machine.
 */
export function DialogHotkey({ hotkey }: { hotkey: Hotkey }) {
  const dialog = useDialogContext();
  useHotkey(hotkey, () => dialog.setOpen(!dialog.open));
  return null;
}
