# Open — two client-side defects, found in a browser

Found by driving the docs app in Chrome against this branch on 2026-07-31, after `build`,
`typecheck`, `lint`, `check:generated`, `test` and `smoke` were all green. **Neither is visible to
any check in the pre-merge sequence**, which is the reason this file exists: the sequence proves the
tree compiles, ships and keeps its guards, and proves nothing about what a browser does with it.

Both are reproducible: `pnpm --filter @kanzo-tech/docs dev`, then read the console.

---

## 1. Hydration mismatch on `DatePicker` — CONFIRMED, cause not yet located

Reproduce: `/docs/forms/dates`. React regenerates the tree on the client, so the page *looks* right;
the cost is a full client re-render of that subtree and a real error in the console.

The server and client disagree about what sits at one position: the client puts the
`<input data-slot="input-group-control">`, the server puts a `<div data-slot="input-group-addon">`.
React's own error text lists the likely causes, and the trace points at the last of them —
**invalid HTML nesting**. The reported ancestry is:

```
<div data-slot="input-group">
  <DatePickerInput asChild data-slot="date-picker-…">
    <p className="flex-1 bg-…" data-scope="date-picker" data-part="input">
      <FieldInput data-slot="input-group-control">
```

A `<div>` inside a `<p>` is not valid HTML. The parser closes the `<p>` before the `<div>`, so the
DOM the browser builds is not the DOM React described, and hydration cannot match. That is a
mechanism, not a guess — but the **source of the `<p>` is not yet identified**, and that is what
anyone picking this up should find first.

What has been ruled out, so nobody repeats it:

- **`InputGroup` does not order or inspect its children.** No `React.Children`, no `sort`, no
  `typeof window` branch — so this is not the group rearranging anything.
- **`InputGroup` renders no `<p>`.** Its root and addon are `ark.div` (`input-group.tsx:50`, `:108`)
  and its text part is `ark.span` (`:189`).
- **The example is not doing anything exotic**: `docs/examples/date-picker/example-default.tsx` is a
  bare `<DatePicker><DatePickerInput /><DatePickerContent>…`.

So the `<p>` comes from `DatePickerInput`'s own composition or from an `asChild` collapse below it.
Start at `simples/date-picker.tsx`, and check what `DatePickerInput` renders when it is given
`asChild` by a parent that also renders an addon.

**Whether this predates the branch is unknown.** It was not looked for before, and settling it means
building `e210a59`'s docs in a scratch worktree and reading the same console — worth doing before
assuming the cut or the `slot` conversion caused it. Note the branch *did* touch this area
(`data-slot` moved past the spread in 428 places), so the honest prior is that it might be ours.

## 2. A missing `key` in the docs app's sidebar — CONFIRMED, cosmetic

`Each child in a list should have a unique "key" prop. Check the render method of 'Sidebar'. It was
passed a child from Layout.` Present on every docs page. It is the docs app's own layout, not the
library's `composites/sidebar.tsx`. Cheap to fix; nothing depends on it.

---

## What this says about the pre-merge sequence

`CLAUDE.md` lists seven commands and the docs build. All eight passed while both of these were live.
The sequence's blind spot is everything that only happens when a browser parses the HTML and React
hydrates it — invalid nesting, mismatches, key warnings, and anything visual.

The cheapest closure is not another guard: it is to **open the app and read the console** as the last
step before calling work done, which is what found these. If that is worth making explicit, it
belongs in `CLAUDE.md`'s "Working here" list next to the build order.

---

## Also verified in the browser, and closed

Four visual defects rescued from the deleted `.planning/` files were re-checked. One is settled:

- **`Calendar` is not "visually totally broken"** — the reported defect that survived longest in the
  planning documents. `/docs/forms/dates` renders a correct month grid: aligned weekday columns,
  working month and year selects, prev/next triggers, today outlined. Whatever it described was
  fixed at some point and nobody closed the note. **Delete the claim.**

The other three (`ColorPicker` swatch behaviour, `Tour`'s close button, `Breadcrumb`'s ellipsis)
were not reached and remain unverified.
