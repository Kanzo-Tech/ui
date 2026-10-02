---
"@kanzo-tech/graph": minor
---

**`GraphSelect`, and a selection source that names no host.** `SelectionSource` is the canvas's own
gestures — `"marquee"`, `"lasso"`, `"node"` — and `"external"` for a selection you set through
`select`. `"order"` and `"ask"` are gone, and `select(vertices)` without a source is now
`"external"` (it was `"node"`).

If you passed `"order"`, `"ask"` or any source of your own to `select`, pass `"external"` and keep
the `label`: the label is what tells your selections apart.

`GraphSelect` is the toggle a panel offers — *these vertices, on the canvas*:

```tsx
<GraphSelect label="Contracts past due" load={() => idsOf(rule)}>
  …the body you click…
</GraphSelect>
```

`load` runs when it is pressed; pressed is the live selection being `"external"` with this `label`,
so a lasso elsewhere releases it; a rejected `load` reaches the root's `onFailure` as thrown. If you
built this toggle yourself over `useGraphContext().select` and `useGraphState`, delete it.
