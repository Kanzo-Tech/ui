---
"@kanzo-tech/ui": minor
---

**`ShellDockSwitcher` and `ShellDockItem` switch a dock's panels**, as VS Code's activity bar does:
an icon per panel, named by its `label` as a tooltip and as its accessible name, checked while its
panel is open, and pressed again to collapse it.

```tsx
<ShellDockSwitcher value={panel} onValueChange={setPanel}>
  <ShellDockItem value="info" label="Info" icon={InfoIcon} />
  <ShellDockItem value="ask" label="Ask" icon={MessageCircleIcon} />
</ShellDockSwitcher>
```

`value` is the open panel or `null`, and `onValueChange` hands you either. If you built this from a
single-select `ToggleGroup` of bare icons, or a `Toggle` with an icon and a word, replace it with
these two parts.
