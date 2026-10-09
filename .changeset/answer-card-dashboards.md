---
"@kanzo-tech/ai": minor
---

**`AnswerCard`'s *Add to the dashboard* takes your dashboards and hands back the next document.**
Breaking: `onAdd(key, add)` is gone. Pass `dashboards` — the `Dashboards` document you draw, the
editor's draft — with `onAdd(next, { relation, key })`, which is called with the whole next document
(the tile appended to the answer's relation's spec, or to its automatic dashboard) and the relation it
landed on. The two go together. *✓ On the dashboard* is now read from `dashboards`, so it survives a
remount and comes back as *Add to the dashboard* once the tile is removed and saved. Return your save's
promise and the button is pending until it settles; a rejection is drawn as a `Problem` under it, in
the words of the new `copy` prop. The tile's id on the dashboard is now the answer's, not a fresh one.

What keasy's `ask-panel.tsx` changes:

```tsx
// before
return (key, add) => edit.commit({ ...current, byRelation: { ...current.byRelation, [key]: add(current.byRelation[key]) } });
<AnswerCard graph={graph} onAdd={onAdd} part={part} stopped={stopped} />

// after — with the store's `commit` answering the save (`useDebouncedCommit`'s does now)
<AnswerCard
  copy={problemCopy}
  dashboards={store.current}
  graph={graph}
  onAdd={(next, { relation }) => {
    setRelation(relation); // show the Dashboard view's relation the tile landed on
    return edit.commit(next);
  }}
  part={part}
  stopped={stopped}
/>
```

The card also stays `aria-busy` until the answer's tile, or its failure, is drawn — not only while the
model writes it — so a test can wait on `aria-busy` alone. `AnswerAdded` is exported.
