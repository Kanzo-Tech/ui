---
"@kanzo-tech/graph": minor
---

**The legend, the toolbar and the inspector are parts**, and the api is commands with the state read
through a selector.

```tsx
<GraphRoot corpus={opening} fill="kind" categories={{ contract: "Contract", report: "Field report" }} onFailure={setFailure}>
  <GraphCanvas>
    <GraphToolbar className="absolute end-2 top-2" />
    <GraphLegend className="absolute start-2 bottom-2" />
  </GraphCanvas>
  <GraphInspector>{(detail) => <DataListItem>…</DataListItem>}</GraphInspector>
</GraphRoot>
```

- **`GraphLegend`** draws the categorical scale the canvas draws, with what each category's marks
  stand for in view and what is drawn of the whole. **`GraphToolbar`** draws the selection tools,
  the selection, zoom and fit, and — with `simulate` — the layout's transport. **`GraphInspector`**
  reads the focused vertex's row and lays it out; its `children` is a render prop for fields of your
  own. None of them takes a callback: what a click or a lasso means stays `onSelect`, `onFocus` and
  `onFailure` on the root.
- **`categories`** on the root names the categorical channel's values. A column the manifest
  declares ranks by its ordinal; for any other the keys' order is the rank, so a colour no longer
  moves as tiles arrive.
- **`corpus` takes a promise.** Pass the opening and the graph reports `status: "opening"` until it
  settles; `null` is no corpus. `status` is `none`, `opening`, `reading`, `idle` or `failed` — the
  last also when the canvas cannot start a renderer. `reveal` selects and focuses without one.
- **`frameBox(box, { duration, padding })`** frames a box in the corpus's coordinates.

What to edit:

- `useGraphContext()` returns the commands and no state, and its identity no longer changes. Read
  state with `useGraphState((s) => s.drawn)` — `total`, `z`, `pending`, `status`, `drawn`,
  `selection`, `focus`, `hovered`, `pinned`, `tool`, `motion`, `progress`, `declined`, `options` —
  or `api.getState()` inside a callback.
- `api.getGraph()` is gone: move the camera with `fit`, `zoomBy`, `frameBox`, `frameSelection` or
  `reveal`.
- `lucide-react` is a required peer, as it is `@kanzo-tech/ui`'s.
