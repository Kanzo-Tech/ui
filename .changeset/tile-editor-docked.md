---
"@kanzo-tech/ui": minor
---

A `Dashboard` edits its tiles in your page's aside instead of in a modal popover over the board, the
way draw.io's Format panel does. The page keeps scrolling while a tile is added or edited, and the
tile being edited is outlined as the preview. A click on the board no longer drops the draft:
*Cancel*, the close button and Escape do.

**Breaking:** a dashboard is now editable only on a page that places the new `TileEditorAside`. Put
it in a `ShellAside` of your own, under the same `MosaicProvider` as the dashboard, keep it mounted,
and show the aside while `useTileEditorOpen()` is `true`:

```tsx
<ShellAside aria-label="Format" side="end" width={352} hidden={!useTileEditorOpen()}>
  <TileEditorAside />
</ShellAside>
```

Without it the dashboard is read-only, even with `onChange`.

If you place `TileEditor` yourself, put it in your own aside, which it fills. `anchor` now only
brings the tile into view as the editor opens. Tests that found the editor by `role="dialog"` find it
by `role="region"` and its title, *Add tile* or *Edit tile*.
