# Docs wave 2 — handoff

Written 2026-07-31 by the docs agent, on branch `ds-component-and-docs-review`, after the
component cut landed. Wave 1's handoff is `handoff-docs-wave1.md`; the cut's own is
`handoff-cut.md`. This file covers the orphan clean-up and the information-architecture merge.

**Verification standard:** `pnpm --filter @kanzo-tech/docs typecheck` is **green (0 errors)**; all
93 pages' internal links and anchors resolve (checked mechanically, 0 broken); every
`<ComponentPreview>` resolves to a file that exists.

---

## 0. THE BLOCKED ITEM — top line, as briefed

**`docs/content/docs/layout/preferences.mdx:40` still says *"Four sections, and none of them is a
hue."*** The identity axis makes both halves false: there are five sections, and the new one is
*specifically* the colour identity. `PreferencesIdentity`, `IdentityNotice`,
`IdentityRetiredCopy`, `KanzoIdentity`, `IdentityOption` and the `data-identity` attribute are all
live code with **zero documentation anywhere on the site**.

It is untouched here because that work is uncommitted in the other session's checkout
(`packages/ui/src/composites/Preferences.tsx`, `theme/prefs-config.ts`,
`packages/theme/src/index.ts`), and writing the correction now would conflict on rebase. It is
still the largest factual defect on the site. It needs:

- a fifth row in the Sections table (`:186-190`), a fifth line in the anatomy tree (`:63-70`);
- the "Colour is not a preference" callout rewritten — an identity chooses among blocks the
  *tenant* published, which is not a user picking a hue, and that distinction is the whole point;
- `(root)/theming.mdx:15-22` gains `data-identity`, making it **five** axes — and
  `docs/app/(home)/page.tsx` says "Four axes" as of `4b56a83`, so that number moves with it;
- prose for `IdentityNotice` somewhere; it has no page and no example.

**Do not move `layout/preferences.mdx` to another group until this lands.** A rename plus a
content edit is the one combination that makes the rebase painful, which is why the
Preferences/AppearanceToggle relocation below is deferred rather than done.

---

## 1. What shipped

| Commit | What |
|---|---|
| `8807275` | nine orphaned pages + example dirs deleted; four salvaged examples written |
| `6128ff0` | the five deleted sidebar composites hand-composed in both showcases |
| `2e3a8e5` | `TextField` / `NumberField` / `DateField` substituted at every call site |
| `60fad39` | the prose fixes, and the two argued relocations |
| `7aafe30` | the four IA merges |

**Deleted:** `navigation/{breadcrumbs,sidebar-user,sidebar-nav,instance-switcher}.mdx`,
`layout/made-with.mdx`, `overlays/{empty-state,ribbon}.mdx`, `forms/{text-field,date-field}.mdx`,
and their nine example directories.

**Value salvaged into examples**, per `handoff-cut.md` §2:

| From | To | What survived |
|---|---|---|
| `Breadcrumbs`' `maxItems` | `examples/breadcrumb/example-collapsed.tsx` | the collapse, plus both hard-won details: the accessible name on the `Button` (the ellipsis is `aria-hidden` decoration and cannot name its own control), and the separator as a **sibling** `li` |
| `Ribbon` | `examples/badge/example-ribbon.tsx` | `Float` + `Badge`, and the `inert`-as-well-as-dim gating |
| `EmptyState` | `examples/item/example-empty.tsx` | `text-center` and `max-w-[420px]`, plus `asChild` for the heading level |
| `DateField`'s adapter | `examples/date-picker/example-iso-value.tsx` | `toDateValues` with the load-bearing `catch` |
| `initials()`, `SidebarNav`'s two policies | both showcases, as local functions | see below |

**Relocations, each argued from the code and not from taste:**
`navigation/segment-group` → `forms/` (its own page says it selects a value and its root renders
`role="radiogroup"`); `data-display/code-editor` → `forms/` (`packages/ui/src/editor.ts` says in
writing: *"It was never a layout: its props are `value` / `onChange` / `extensions` / `readOnly`,
i.e. a control"*).

**Merges:** `calendar` + `date-picker` → **Dates**; `input` + `textarea` → **Text inputs**;
`spinner` + `skeleton` → **Loading**; `show` + `client-only` → **Rendering**.

106 pages before the cut → **93**. See §3 for why not 82.

---

## 2. `packages/**` — not mine to fix

**P-1 — `parseDate` should be re-exported from the root barrel. This is the strongest ask in this
file.** Cutting `DateField` removed the only thing in the library that could *construct* a
`DatePicker` value. `DatePicker`'s public contract is `DateValue[]`; `@internationalized/date` is
a **dependency** of `@kanzo-tech/ui`, not a peer and not re-exported — so no consumer can drive a
date picker from stored data without adding a package the library already ships.

The precedent is in the barrel already: `createListCollection` is re-exported from
`@ark-ui/react/collection` with the stated reason *"surfaced here so downstreams don't need a
direct `@ark-ui/react` dependency"*. `parseDate` is the identical case, and
`@ark-ui/react/date-picker` re-exports it.

Until then, the docs app installs it directly — `docs/package.json` now depends on
`@internationalized/date@^3.12.2` (commit `8807275`, which also touches `pnpm-lock.yaml`). That is
the honest demonstration of what a consumer has to do, and three files rely on it:
`examples/date-picker/example-iso-value.tsx`, `examples/form/tanstack/example-date-field.tsx`, and
a local `IsoDateInput` in each of `showcases/metadata-form/default.tsx` and
`showcases/workspace/graph-view.tsx`. **If the re-export lands, those four get simpler and the
docs dependency goes away.**

**P-2 — `SidebarMenuButton`'s `tooltip` breaks under `CollapsibleTrigger asChild`.** When
`tooltip` is set, the button wraps itself in `<Tooltip><TooltipTrigger asChild>`, so an outer
`asChild` (from `CollapsibleTrigger`) lands on the `Tooltip` root rather than on the button. The
deleted `SidebarNav` had exactly this shape, so the showcases reproduce it verbatim rather than
inventing a fix. `packages/ui/src/composites/sidebar.tsx`.

**P-3 — `ItemMedia` cannot be re-aligned by a plain utility.** It carries
`group-has-data-[slot=item-description]/item:self-start`, which is correct for a row and wrong for
the column an empty state is. A bare `self-center` does **not** win: the variant compiles to a
descendant selector with higher specificity, and `tailwind-merge` treats different modifiers as
different keys, so the override has to carry the same variant prefix. Either the empty-state
column is a supported `Item` shape and the variant should be conditional, or the recipe should
document the escape. `packages/ui/src/simples/item.tsx`.

**P-4 — still open from wave 1:** `packages/ui/src/styles.css:22-25` names `[data-base]` and
`[data-accent]`, which `packages/theme/src/index.test.ts` asserts the absence of, and says *"dark
is next-themes' `.dark`"*, which `docs/app/layout.tsx:36` disproves.
`packages/ui/src/simples/floating-panel.tsx:147` declares `role="separator"` with no keyboard
handler, no `aria-value*`, no ARIA comment and no test, while Ark ships `Splitter`.

**P-5 — `ToggleGroup` / `ToggleGroupItem` still have no page, no example and no prose.** The only
mention on the whole site is an unnarrated fence at `layout/shell.mdx:54-56`. Ark ships
`docs/components/toggle-group`. Whether it gets a page is a component decision.

---

## 3. Where I did not do what the audit said, and why

The brief said to weigh the proposed IA rather than obey it, because it was written before the
cut. Four of the audit's ten merges turned out to be **already done by the cut** (the breadcrumb
pair, the sidebar family, the date trio is now a pair, the text-input quartet is now a pair), and
three should not happen:

**N-1 — `Table` and `DataTable` stay two pages.** Audit §3-4 row 3 says merge. Against it: the
TanStack half is ~300 lines with eight part-level API tables, and a reader looking up "data table"
wants a page called Data table, not a section three screens into a markup page. The audit's actual
complaint — that both pages open by disambiguating themselves — is now fixed differently and
better: the disambiguation is one link each to `/docs/philosophy#the-engine-rule`, which is the
rule that justifies two *components*. Two components with one page each is not the defect; two
components with a paragraph of apology each was.

**N-2 — `Accordion` and `Collapsible` stay two pages.** Audit §3-4 row 7 says merge into
Disclosure. Ark ships two pages (`docs/components/accordion`, `docs/components/collapsible`), and
*match the reference* is a live decision in `decisions/`. They are genuinely two Zag machines, not
one with a switch — unlike Calendar/DatePicker, which is why that one merged and this one did not.

**N-3 — `InputGroup` stays its own page** rather than folding into Text inputs. It is a compound
with five parts and its own API tables, and it is now the answer to "where did `TextField` go", so
burying it is exactly the wrong move.

**N-4 — the `layout/` group re-cut is NOT done, and it needs the owner, not another agent.**
Audit §2-3 is right that `layout/` has no axis a reader can predict: it holds two structural
regions, a positioning primitive, a scroll container, a rule, two disclosure machines, two theming
controls and (now) one rendering-helper page. Two of those moves are blocked or unarguable:

- `preferences` + `appearance-toggle` → a `theming/` group. **Blocked by §0** — moving
  `preferences.mdx` while its content is being rewritten elsewhere is the one change guaranteed to
  conflict. Do it in the same commit that lands the identity section.
- `accordion` + `collapsible` → out of `layout/`. I could not argue a destination from the code.
  They are behaviour machines whose payload is content; `Overlays` is wrong (they are not
  surfaces), `Data display` is a stretch, and inventing a `Disclosure` group for two pages trades
  one unpredictable group for a nearly-empty one. **This is a naming decision, and naming
  decisions made by an agent on a guess are how `layout/` got this way.** I left it and said so
  rather than adding a `---Disclosure---` separator, which would label the mess without fixing it.

**N-5 — page count is 93, not the audit's ~82.** Nine came from the cut, four from merges. The
remaining gap is entirely N-1 through N-4. The brief said the number is not the goal, and I agree
with the reason given: a catalogue cannot be kept true. Every page removed here was one a reader
had to be told the difference between.

---

## 4. Found while doing the work

**F-1 — a third `Show` exception, and it fails silently.** `Show` cannot be the child of an
`asChild`. Ark's factory calls `Children.only()` and clones what it finds; `Show` returns a
Fragment, so every merged prop — including the whole `className` — lands on the Fragment and
disappears with no error and no warning. Documented on `layout/rendering.mdx` beside the other
two. **`docs/CLAUDE.md` states the `Show` rule with only the eager-children caveat and is not
mine to edit — it should gain this one and the chart-descriptor one.**

**F-2 — the naming rule had lost both its examples.** `philosophy.mdx` and `forms/controls.mdx`
both illustrated *kebab primitive / Pascal convenience* with `TextField` → `input` and `DateField`
→ `date-picker`. The cut deleted both conveniences. They now cite `FacetFilter` → `listbox` +
`popover` and `FieldArray` → `field`, which are checkable against the imports. `philosophy.mdx`
also gained the rule's second direction, which the cut is the evidence for: a convenience whose
only content is a fixed arrangement of the primitive's parts is an example, not a component.

**F-3 — an example renders inside the docs page's own `<main>`.** Repeating this from wave 1
because it came up again: advice of the form "put a landmark in the example" is wrong for
`docs/examples/` and right for `docs/showcases/`, which get their own iframe route. Both
showcases now render exactly one `ShellMain`; no example renders any.

**F-4 — `handoff-cut.md` §1e was slightly incomplete.** It lists the prose sites but not
`(root)/philosophy.mdx:106` (the engine rule's "same relationship as `TextField` to `input`"),
`forms/input-group.mdx:26`, `showcases/app-shell.mdx:12`, or the naming-rule callout in F-2. All
are fixed. Its §1b list was otherwise exact.

---

## 5. Deliberately left

**L-1 — `metric-card` is a showcase that is never shown.** `docs/showcases/metric-card/` has no
page and no `/view/showcases/` route, and is imported by four `examples/card/example-metric-*.tsx`
files plus `showcases/app-shell/default.tsx`. Per `docs/CLAUDE.md` a showcase is a routed,
iframe-embedded arrangement; this one is a shared example module in the wrong directory. Under the
minimality rule it should be inlined into one example file. Not done because it is a structural
call, and `forDisplay` (wave 1, `04ea797`) already tells the reader where to copy it from.

**L-2 — `MetricCard` still takes `href` rather than the full `asChild` seam.** `linkComponent`,
`DefaultLink` and `LinkComponent` are gone and the anchor is now produced by `Card`'s own
`asChild` — the anchor *is* the card. Going the last step (drop `href`, extend
`ComponentProps<typeof Card>`) also means rewriting `examples/card/example-metric-link.tsx`. Two
lines, worth doing with L-1.

**L-3 — `llms.txt` still sorts alphabetically within a group**, discarding `meta.json`'s curated
order, so `Controls` and `Building a form` do not lead Forms and the `---Text---` / `---Choice---`
structure is lost. The sort should key off the page tree. Unblocked now that the tree has settled.

**L-4 — `<TypeTable>` is still registered in `mdx-components.tsx:35` and used on 0 pages**, as are
`Accordion`/`Accordions` and `File`/`Files`/`Folder`. Standing decision: adopt and convert, or
delete the three registrations. It blocks the pages with no API section.

**L-5 — `next.config.ts:7-11` still claims the docs consume the library from source.** They
consume `dist`. `docs/CLAUDE.md` now states the dist rule correctly, so the comment contradicts it
in a second place.

**L-6 — `FULL_BLEED_GROUPS` in `docs/lib/component-groups.ts:41` still contains `"sidebar"`,
which is not a group**, and eight pages pass `fullBleed` by hand. Now that the tree has settled
this is a two-line decision: add `layout` and the sidebar page, or delete the derivation.

**L-7 — cross-linking the remaining orphans.** The whole `overlays/` group is still mutually
unlinked; Popover ↔ HoverCard ↔ Tooltip is one question asked three times and no page states the
rule. That is the gap `forms/controls.mdx` closes for the listbox family, and it wants the same
treatment.
