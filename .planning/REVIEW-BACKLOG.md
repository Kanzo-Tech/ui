# Review backlog

Angel's walkthrough of the docs site, 2026-07-22. Grouped by the kind of work each item is,
because they are not the same job and should not be batched together.

---

## 1. Taxonomy — components sitting in the wrong layer

These are cheap to move (the barrel is flat, so no consumer breaks) but they change how the
library reads.

| Component | Now | Should be | Why |
|---|---|---|---|
| `Link` | composite | **simple** | It is a single-purpose element. Nothing composite about it. |
| `Sidebar` | simple | **composite** | It is an assembly with its own context, provider and ~15 parts. |
| `PageShell` | composite | **layout** | It scaffolds a page. That is the definition of the layout layer. |

Open: the `Sidebar*` sub-parts are exported flat next to unrelated components. Consider a
`sidebar/` directory so the assembly reads as one unit.

## 2. Layout architecture — the part that needs a real decision

Angel's framing, which is worth taking seriously: there should be **`AppShell` and
`EditorShell`, each with optional side panels / asides**. Everything else is either a
specialisation of those two or noise.

Against today's set:

- **`Toolbar` vs `TopBar`** — Angel: "Toolbar no me gusta nada y no tiene sentido si tenemos
  TopBar". They are two thin horizontal strips. Either merge them (one component, a `variant`
  or a position prop) or state plainly what distinguishes them.
- **`TwoPaneLayout`** — not understood, and its internals do not follow Ark's compound shape.
  Candidate for deletion: `WorkspaceLayout` with one panel already is a two-pane layout.
- **`SidePanel`** — is it a real component, or a part of `EditorShell`? Today it is
  free-standing but only ever used by editor-ish shells.
- **`WorkspaceLayout`** — the closest to right, "needs more care". Specifically: semantics,
  behaviour and style are mixed in it, against our own three-layer rule.
- **`AppShell`** — reads as "the metadata view", not as a general shell.

**Do not start this piecemeal.** Design the layout layer as a whole first, then move.

## 3. Component pairs that are not distinguishable from the docs

Every one of these is a docs failure, not a code failure. Each needs its distinction stated in
the first paragraph of both pages, and cross-links.

- `Breadcrumb` vs `Breadcrumbs` (the split "no se entiende claramente")
- `DateField` vs `DatePicker` — and: should `Calendar` just *be* the date input?
- `Input` vs `Field` vs `TextField`
- `Menu` vs `ContextMenu`
- `SecretField` vs `PasswordInput`
- `Select` vs `Combobox` (genuinely different, but the difference must be obvious)
- `Table` vs `DataTable`
- `Tabs` vs `SegmentGroup`

**The forms story is the biggest one.** "With field" reads as a duplicate of the plain example
and explains nothing. Forms need a single guide page that says when to reach for `Field`, what
it adds (label/description/error wiring), and how every input composes with it — instead of a
`example-with-field` repeated across a dozen pages.

## 4. Visual bugs

- **`Breadcrumb` + `Breadcrumbs`**: the number/ellipsis is mis-positioned. Affects both.
- **`Calendar`**: "visualmente totalmente roto".
- **`Tour`**: the close X is *still* mis-positioned inside the dialog. (An earlier fix added
  `pe-8` to the title; something else is wrong.)
- **`ComingSoon`** inline: overlaps and covers the text it decorates.
- **`ColorPicker`**: swatch behaviour on click is confusing; the swatches "se lía".
- **`SuggestMenu`**: its popover is bad — and we own popover primitives it should be built on.
- **`Preferences`**: renders wrong, and does not show all its fields.
- **`StatCard`**: needs a fixed height so a row of them lines up.
- **`Sidebar`**: examples are ugly; the dot on the left is unexplained. Check Shark's sidebar.

## 5. Examples that need more, or better

- **`Alert`** — variants and the colour story.
- **`Card`** — it has more variants than the page shows; they exist, scattered.
- **`CardRadioGroup`** — should the options sit on one row?
- **`Checkbox`** — too thin.
- **`Combobox`** — is there multi-select? If not, should there be?
- **`Text`** — the truncate example does not communicate what it does.
- **`Toggle`** — weak example.
- **`SectionHeader`** — improvable; part of the wider "sections" question.

## 6. Docs infrastructure

- **A components index page**, like Shark's: a card grid of every component linking to its page,
  **generated from the page tree** so there is no second list to maintain. Shark does exactly
  this in `components/mdx-components/components-list.tsx` off `source.pageTree` — except its
  thumbnails are a hand-kept map, which is the part we should NOT copy.
- **Complex components need a different preview.** The 450px framed, centred, dashed-guide box
  is designed for a button. A shell or a panel should render full-bleed, no frame. Add a
  variant to `ComponentPreview` (Shark has `hasMaxHeight` / `showBorders` already — start
  there) or route complex ones through `PreviewIframe`.
- **Blocks probably move out of the docs nav** now that layouts have their own group.

---

## Suggested order

1. **Taxonomy moves** (§1) — an hour, zero risk, makes everything else read better.
2. **Preview variants + components index** (§6) — unblocks judging everything else honestly.
3. **Visual bugs** (§4) — each is small and independent; Tour and Calendar first.
4. **Pair distinctions + the forms guide** (§3) — the largest docs win.
5. **Layout architecture** (§2) — last, deliberately. It needs a design pass, not a patch.
