---
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": patch
---

`useHotkey` is exported from `@kanzo-tech/ui`, with its `Hotkey` and `HotkeyOptions` types: the hook
every Kanzo part registers its keys through, so a key of yours agrees with theirs on what `"mod+k"`
means and leaves a key pressed while typing in a field to the field.

The graph canvas's Escape goes through it. An Escape pressed in a text field — the search box, a
filter input — no longer also drops the drawing tool or clears the canvas's pick; pressed anywhere
else it backs out in the same layers as before.
