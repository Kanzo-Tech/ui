---
"@kanzo-tech/ui": minor
---

Fix the two components that claimed a `role` they did not implement, and add `ToggleGroup`.

`StatusBar`'s panel switches were plain `<button>`s inside a hand-written `role="toolbar"`,
with `aria-pressed` wired by hand and a bespoke `data-active`. The role promised a single tab
stop navigated with arrow keys; nothing implemented it. They are now an Ark `ToggleGroup`, so
roving focus, `data-state` and the group semantics come from the machine.

`Toolbar` claimed the same role with the same gap. It holds arbitrary children, so it cannot
provide roving focus generically — it is now a labelled `role="group"`. Compose a `ToggleGroup`
inside when you need a real toolbar of uniform controls.

`SidePanel` decided its whole appearance with ternaries in the function body. It now has a
`tv()` recipe (`sidePanelVariants`), a `data-slot`, and keeps inline `style` only for the
genuinely computed docked width.

New: `ToggleGroup` / `ToggleGroupItem`, vendored from Shark UI.

All composite and layout parts now render through the `ark.*` factory, so `asChild` works on
them — which `Toolbar`'s own doc comment had been promising without delivering.
