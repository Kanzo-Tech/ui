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
It is a **sibling-order** disagreement inside `InputGroup`, not a nesting one.

```
<div data-slot="input-group">
  <DatePickerInput asChild data-slot="date-picker-…">
    <p className="flex-1 bg-…" data-scope="date-picker" data-part="input">
      <FieldInput data-slot="input-group-control">
```

**Correction, and the reason this paragraph is worth reading twice.** The first version of this file
read the `<p>` above as a paragraph element and concluded the cause was invalid HTML nesting — a
`<div>` inside a `<p>`, which a parser relocates. That was wrong, and wrong in the way this whole
audit exists to catch: a mechanism asserted from a plausible reading, never checked. **`<p>` here is
a minified *component* name in React's dev stack, not a DOM element.** Its `className="flex-1 bg-…"`
is `InputGroupInput`'s own, character for character (`input-group.tsx`: `flex-1`, `bg-transparent`,
`rounded-none border-0 shadow-none`…), and the same trace shows `<T>` and `<G>` — minified siblings.
The library renders no `<p>` anywhere near this tree; its only `ark.p`s are `FieldDescription`
(`field.tsx:211`) and `ItemDescription` (`item.tsx:171`). **Invalid nesting is ruled out.**

What is left is the real question: `DatePickerInput` puts exactly two children in the group —
`<ArkDatePicker.Input asChild>` wrapping `<InputGroupInput />`, then `<InputGroupAddon>` — and the
server appears to render the addon where the client renders the input. The first hypothesis to test
is that **Ark's `asChild` clone resolves differently during SSR**, so the input child collapses to
nothing on one side and the addon shifts into its slot. Start at `simples/date-picker.tsx:60-90`.

**The directive sweep is not the cause — tested, not reasoned.** The obvious suspect was `a3a5c98`
("57 components opted out of server rendering for nothing"): `date-picker.tsx`, `field.tsx` and
`input.tsx` all carried `"use client"` at `e210a59` and lost it, which would put an `asChild` child
across the RSC boundary, where Ark clones and merges props onto it. The experiment: restore the
directive on **all 51** files that lost one, rebuild, reload. **The mismatch survives unchanged.**
Reverted; the branch is as it was. So the sweep is exonerated and the cause lies elsewhere — most
likely pre-existing, with the `slot` conversion the only other candidate this branch introduces.

Two hypotheses have now died here, both of them mine and both plausible on the evidence available
when they were formed. Whoever picks this up should assume a third will too, and reach for the
experiment earlier than the argument: restoring one directive moved the failure from
`DatePickerInput` to `DatePickerTrigger` without removing it, which was the first real clue that the
boundary was not the variable.

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

- **`Breadcrumb`'s ellipsis is not mis-positioned.** `/docs/navigation/breadcrumb`, the "Long trails"
  section, renders `Kanzo › ⋯ › Datasets › customers` with the ellipsis aligned and centred against
  its separators. **Delete the claim.**

The other two — `ColorPicker`'s swatch click behaviour and `Tour`'s close-button position — remain
unverified. Both need a browser and neither has a commit touching it since the note was written.

**Two of the four were already fixed and nobody closed the note**, which is the same defect class as
a stale comment: a claim that outlived its subject and kept costing attention. Whoever verifies the
last two should delete them from wherever they end up recorded rather than leaving them "open".

Also confirmed working while passing through: the `links.doc` fix renders — the "Ark UI docs" button
is on the page. 55 pages carried those links in frontmatter and showed none of them.
