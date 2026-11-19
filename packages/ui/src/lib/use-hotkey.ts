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

export interface HotkeyOptions {
  /** Listen in the capture phase, ahead of a part that stops the key on its way down. */
  capture?: boolean;
  /**
   * Claim the key, so the browser and any dismissable layer under it leave it alone — Mantine's
   * option of the same name. `false` for a listener that only observes.
   * @default true
   */
  preventDefault?: boolean;
}

/**
 * Whether a key pressed here types into it. A radio and a checkbox are `<input>` too, and Ark keeps
 * focus on the hidden one, so counting them would switch every bare-key hotkey off the moment a
 * choice is clicked.
 */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio"));

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
 * `CommandDialog`'s, `SidebarProvider`'s, a questionnaire's `1`–`9` and the theme picker's Escape all
 * come through here, so they agree on what a key is and on the rule that a key pressed while typing
 * in a field, a select or an editable region is the field's — Mantine's default, and why ⌘B in a
 * rich-text editor stays bold. `onPress` is handed the hotkey that matched, for a list of several.
 * Nothing is registered while `hotkey` is undefined or empty: a design system claims a key in its
 * host's keymap only when asked.
 */
export function useHotkey(
  hotkey: Hotkey | readonly Hotkey[] | undefined,
  onPress: (hotkey: Hotkey) => void,
  options: HotkeyOptions = {},
) {
  const { capture = false, preventDefault = true } = options;
  const press = React.useRef(onPress);
  React.useEffect(() => {
    press.current = onPress;
  });
  // Joined, so a list written inline in a render does not re-register on every render.
  const keys = hotkey === undefined ? "" : typeof hotkey === "string" ? hotkey : hotkey.join("\n");
  React.useEffect(() => {
    if (!keys) return;
    const list = keys.split("\n");
    const onKey = (event: KeyboardEvent) => {
      const hit = list.find((each) => matchesHotkey(each, event));
      if (hit === undefined || typing(event.target)) return;
      if (preventDefault) event.preventDefault();
      press.current(hit);
    };
    window.addEventListener("keydown", onKey, capture);
    return () => window.removeEventListener("keydown", onKey, capture);
  }, [keys, capture, preventDefault]);
}
