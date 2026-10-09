---
"@kanzo-tech/ui": minor
---

**`ShellDockSwitcher` is typed by your panel id and must be named.** Breaking: the `"Panels"` default
is gone, and the type asks for exactly one of `aria-label` or `aria-labelledby` — the group is a
`radiogroup`, which must have a name, and only you know what its panels are. `value` and
`onValueChange` take the type of `value`, so a page whose panel is a union gets that union back.

What keasy changes: Discover's footer drops its `PANELS.find(…)` and names the switcher; the studio
names its one-panel dock after it.

```tsx
// discover/page.tsx
<ShellDockSwitcher
  aria-label="Panels"
  onValueChange={(next) => setDiscover({ panel: next ?? "none" })}
  value={panelOpen ? panel : null}
>

// graph-studio.tsx
<ShellDockSwitcher aria-label="Sources" className="ms-auto" onValueChange={…} value={…}>
```
