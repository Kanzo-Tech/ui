"use client";

import React from "react";

/**
 * A key, as a host writes it: `"p"` is the bare key, `"mod+k"` is ⌘K or Ctrl+K — the spelling of
 * Mantine's `useHotkeys` and react-hotkeys-hook, so nobody learns a second grammar for one idea.
 *
 * `mod` takes ⌘ or Ctrl on every platform rather than sniffing which one this is: the user agent is
 * a guess, and a Windows keyboard on a Mac is not rare. A bare key fires only with no modifier held,
 * so `"p"` never swallows ⌘P.
 */
export type Hotkey = string;

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

/** Whether `event` is `hotkey`. Exported for the test beside it; the hook is the one reader. */
export function matchesHotkey(hotkey: Hotkey, event: KeyboardEvent): boolean {
  const parts = hotkey.toLowerCase().split("+");
  const key = parts.pop();
  const mod = parts.includes("mod");
  if (event.key.toLowerCase() !== key || event.altKey) return false;
  return mod ? event.metaKey || event.ctrlKey : !event.metaKey && !event.ctrlKey;
}

/**
 * **The one keyboard listener a part registers on the window** — `PreferencesRoot`'s `hotkey`,
 * `CommandDialog`'s and the sidebar's ⌘B all come through here, so they agree on what a key is and
 * on the rule that a key pressed while typing in a field, a select or an editable region is the
 * field's — Mantine's default, and why ⌘B in a rich-text editor stays bold. Nothing is registered
 * while `hotkey` is undefined: a design system claims a key in its host's keymap only when asked.
 */
export function useHotkey(hotkey: Hotkey | undefined, onPress: () => void) {
  const press = React.useRef(onPress);
  React.useEffect(() => {
    press.current = onPress;
  });
  React.useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if (!matchesHotkey(hotkey, event) || typing(event.target)) return;
      event.preventDefault();
      press.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);
}
