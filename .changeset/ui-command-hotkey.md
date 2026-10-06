---
"@kanzo-tech/ui": minor
---

**`CommandDialog` opens on a key: `hotkey="mod+k"`** toggles the palette on ⌘K or Ctrl+K, controlled
or not, and leaves a key pressed while typing in a field to the field. There is no default, so a
palette you already wire to ⌘K by hand keeps working; delete your listener and pass `hotkey` instead.

**`CommandInput` draws `children` before its input**, where a palette that filters puts its chips.
`/docs/actions/command` shows the composition with `useTagsInput`.

**Inside `CommandDialogContent` the list fills the dialog** instead of stopping at the inline palette's
height.

**`PreferencesRoot`'s `hotkey` takes the same grammar** — a bare key as before, or a chord such as
`"mod+,"`.

**⌘B no longer toggles the sidebar while you type in a field**, so it stays bold in a rich-text editor.
