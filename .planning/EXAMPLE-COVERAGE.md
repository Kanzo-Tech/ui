# The example-coverage audit — 2026-08-21

Angel's point 2 of the AI-layer review: *"tiene que haber ejemplos de todo"*, raised because
`use-inline-completion` documents attaching the hook to any input and `use-suggestions` has no
matching section. The queue item said **produce the list before writing anything**. This is the
list. Nothing here has been acted on.

## Acted on so far — 2026-08-21, same day

The list below is the survey as it was taken. Four items have since been closed and the counts in
them are stale by exactly that much:

- **§1, all three orphans wired.** `charts/example-color-legend` under a new *Two legends, and only
  one of them is a control* in the crossfilter section; `charts/example-stat` **in place of** the
  Dashboards code fence, which was a hand-copy of that file down to its two comments;
  `forms/example-controls` on `forms/index`, where the Anatomy tree says `<control>` is *any of
  them* and never showed one. Unreferenced example files: 3 → 0.
- **§5, `CompleteHint` has an example** — `ai/example-field-hint`, a docked composer whose box the
  layout fixes and whose bottom edge its toolbar owns. `ai` exports with no example: 3 → 2.
- **§5, `use-suggestions` has a second example** — `example-states`, the one section on that page
  that argues hardest and showed nothing: an empty `ready` said out loud, and the `idle` gate
  visible as a disabled Ask.
- **A doc-truth fix that fell out of it.** `use-inline-completion` claimed the hook "lets one hook
  drive an `Input`, a `Textarea`, an `InputGroup` or an inline `Editable`". The single-line half is
  what this repo measured as broken and deleted `CompleteInput` over. The hook is fine; **the
  presenter is the decision**, and the page says that now.

- **§4, one example for all thirty-eight** — `hooks/example-context`, a `Tally` reading
  `useFileUpload()` from inside the root. It counts the files and totals their bytes, which is the
  reason to reach for a context hook at all: one file's size is a part's job, a sum across them is
  not. `hooks/index` had no preview at all.
- **§4's rename is withdrawn and something smaller shipped instead** — `UseTourContextReturn` is
  exported, and the error message stopped naming a hook that does not exist. Read §4: the rename
  would have broken Shark parity, and the repo had already written down why.

- **§3 and §7, forty absent `ui` symbols → two.** Not by allowlisting them: each one is now named
  on the page of the thing it is part of, with what it is. Twelve `Calendar`/`DatePicker` parts as
  *The parts the Anatomy does not show*; the floating layer named on Dialog, Sheet, Popover, Menu
  and Tour; the two render props on Combobox and Select; `TreeViewBranchIndicator`,
  `ColorPickerView`, `ColorPickerSwatchPreview`, `SelectClearTrigger`, `SidebarInput`,
  `safeParseColor`; and the seven `*Variants` in the house's one-sentence shape. **The remaining
  two are `KanzoTheme` and `ThemeNotice`**, and both are in the theming pages the other session
  owns.
- **`ui/analytics` and `ai` are at zero too.** The five Mosaic clause helpers became the charts
  page's **third escape hatch** — the client protocol, for a view that is not a plot — with
  `column`/`fillColumn`/`numbers` beside it as the half that turns the answer back into values.
  `cleanGhost` went where the echo rule is already documented.

Previews: `analytics/charts` 10 → 12, `ai/fields` 2 → 3, `forms/index` 2 → 3,
`ai/use-suggestions` 1 → 2, `hooks/index` 0 → 1.

- **§2, `graph` has the reference it was missing.** `## API Reference` on `graph/index`, grouped
  the way the barrel groups them — the canvas, the slice, identity, the look and the shape channel,
  the simulation, bounded sources, the chrome, colour. **All thirty-six names, checked against the
  built surface: none missing, none invented.** The barrel's own comments were already a reference;
  what was missing was any of it reaching the page. Examples are the layer above this and are still
  owed — `graph` remains 35 of 36 exports with no example.

**Exports named nowhere, per entry: `ui` 40 → 2, `ui/analytics` 5 → 0, `ai` 1 → 0, `graph` 9 → 0.**
Only `KanzoTheme` and `ThemeNotice` are left, both blocked.

**Six things I wrote and had to correct before they shipped**, all caught by reading the source
rather than by a guard: `CalendarTableCellTrigger` is not on our surface (`CalendarTableCell`
renders the cell *and* the trigger, because the states are painted on both and they can never be
composed apart); `DatePickerTimer` is a **time field**, not a countdown; `TreeViewBranchControl`
does not exist — the export is `TreeViewBranchItem`; `Badge` has seven variants, not six; and the
`useTourContext` rename (§4). Nothing checks prose against the surface unless the paragraph
contains the word *export*, which is `documented-exports.test.ts`'s `CLAIMS_EXPORT` heuristic.

**Not started, and blocked rather than skipped:** step 2 of the plan (`layout/preferences` and
`(root)/theming`). Both sit inside the theme refoundation another session is running in this same
checkout — `Preferences.tsx`, `KanzoTheme.tsx`, `theme-context.ts` and `theming.mdx` are all
modified there, `docs/components/kanzo-provider.tsx` does not typecheck against the in-flight
`@kanzo-tech/theme`, and the docs dev server 500s. Nothing written against that surface today would
survive it.

---

## `graph` has its first example that is not the database one

`graph/example-memory` — the `memorySource` half, which the page had as a fenced snippet and
nothing more. It draws the sightings fixture as the graph it already is: **538 reports joined to
the 8 beasts and 6 regions they name, so 552 vertices and 1,076 edges**, with the hubs shared,
which is the one thing a graph shows that the crossfilter charts over the same rows cannot.

It is deliberately the `useGraph` + `GraphRootProvider` shape rather than `GraphCanvas`, because
the count in the corner is read from `useGraphContext()` and a component that renders the root sits
above the provider. That section of the page — *When the shortcut is not enough* — had a snippet
and no running code either, so one example closes both.

**`graph` exports with no example: 35 → 30.** The five are `memorySource`, `useGraph`,
`useGraphContext`, `GraphRootProvider` and `vertexId`.

**Measured, because it was the one thing worth doubting.** A docs preview that computes a force
layout on the main thread at mount is a bad trade if it is slow: `forceLayout` over these 552
vertices and 1,076 edges runs in **43 ms**. It is not a cost worth engineering around, and now
that is a number rather than a hope.

**Not rendered.** The dev server went down mid-check — the whole server, not the route — and before
that the tab was hidden, where `requestAnimationFrame` never fires and a cosmos.gl canvas therefore
never paints. So typecheck, lint and the layout figure are what stand behind it. **The graph page is
the page that most needs a visible window and is the hardest to get one for.**

### What the remaining 30 would take

Most of them are not example-shaped and should not be forced into one: `buffers`, `scaleOf`,
`forces`, `appearance`, `residentOf`, `typeOf`, `denseOf`, `isColour`, `neighboursOf`,
`resolveToken`, `toHex` exist for a host writing its own buffers, and the reference now names each.
Two clusters genuinely want an example and are the next graph work:

- **Overlays and selection** — `useGraphOverlays`, `GRID`, `useGraphSelection`, `cursorChip`. The
  page says these stay out of the canvas because each needs a policy only a product can write,
  which is exactly why a worked one is worth having.
- **The declared axes** — `lookFrom`, `simFrom`, `DEFAULT_LOOK`, `DEFAULT_SIM`, plus `adaptive` and
  `clusterRing`. A picture that changes when a person changes an axis.

---

## What has now been looked at, and what has not

The docs dev server came back late in the session, so the examples written blind were driven in
Chrome. **Two of the four are confirmed against their pages' own claims; two are not, and one of
those cannot be from here.**

**`use-suggestions/example-states` — confirmed, every claim.** *Says nothing* → Ask → `status:
loading` with **Ask disabled**, then `status: ready` with **"Nothing to suggest." said out loud**.
Switching the source back and running *Again* yields `ford` and `nightfall`. Taking one leaves one
and Ask still disabled; **taking the last returns `status: idle` and re-enables Ask**, with both
chips kept. That is the `idle` gate and the spent-answer rule, which the page argued and nothing
showed.

**`ai/example-field-hint` — confirmed, and measured.** The hint sits **6 px below the field**, at
the field's full width (448 px), **wrapping to 61 px** — three lines. It carries **two `<kbd>`**, so
nothing composes `CompleteKeys` beside it. **No `complete-ghost` is in the tree at all**, which is
the "swap, not a companion" sentence as a fact. And the field **stayed 128 px**: it did not grow,
which is the whole premise of choosing this presenter.

**`hooks/example-context` — mounts, contents unverified.** The dropzone and the hidden input render
and **`useFileUpload()` called from a child does not throw**, which was the one real risk. What the
`Tally` prints with files in it is unverified: two attempts at synthetic file injection failed —
assigning `input.files` from a `DataTransfer`, and a synthetic `drop` on the dropzone, one of which
hung the renderer. That is a limitation of driving Chrome, not a finding about the example.

**`charts/example-stat` — unverified, and worth knowing why.** Its plain `StatTile` renders
("Invoiced $12,402"). Its two `ChartStat` tiles did not resolve while watched — and
`document.hidden` was `true` throughout, which is the exact condition
`mosaic-stalls-in-a-hidden-tab` says makes this unreadable. **A new tab reports `hidden` too: the
whole window is behind, so no tab is visible while driving headlessly.** No conclusion either way.

**And a fact that fell out of chasing it: `example-stat` is the only running `ChartStat` in the
entire docs tree.** Every other mention across seven pages is prose. So wiring this orphan in is
the first time that component has been on a page at all — which is also why there was no
known-good call site to compare against.

---

## What was counted, and how

Four scans, all over the tree as it stands (`docs/content/docs`, `docs/examples`, `docs/showcases`,
and each package's built barrel):

1. Every `<ComponentPreview>` on every page, resolved to `examples/<slug>/<fileName>`.
2. Every file under `docs/examples`, and whether any page references it.
3. Every **runtime** export of every public entry (`Object.keys` of the built module, not a parse of
   the `.d.ts` — 593 for `ui`, and a regex over the barrel found 95), against every identifier
   imported from `@kanzo-tech/*` by an example or a showcase.
4. Per page: previews, `##` sections, lines, and whether it carries a prop table.

### What this cannot see

- **A type is invisible.** `Object.keys` of a module lists values, so a type-only export is neither
  counted nor missed. `type Suggestion` in `use-suggestions/example-default.tsx` is skipped on both
  sides, which is right, but it means a page's type surface is unaudited.
- **"Documented" is a word-boundary match over the concatenated pages.** A symbol named only inside
  a prop table cell counts as documented; one named in a comment inside an example does not count as
  demonstrated. Six of the forty in §3 were checked by hand and all six were genuinely absent.
- **It does not read the examples.** An example that imports `Combobox` and uses one prop of it
  counts the same as one that walks the whole surface. Coverage here is *at least one call site*,
  which is the floor, not the goal.
- **A part is not a component.** `MenuPositioner` and `Menu` are one row each below. §2 splits them
  by shape (`*Variants`, `use*`, the rest) and not by whether anybody would ever want an example.

## The numbers

| | |
| --- | --- |
| pages | 138 |
| pages with no preview at all | 24 |
| example files | 350 |
| referenced by a page | 345 |
| **finished examples no page shows** | **3** |
| references pointing at a missing file | 0 |

Per surface, exports with no example anywhere in `docs/examples`:

| entry | exports | no example | nor a showcase | nor named on any page |
| --- | ---: | ---: | ---: | ---: |
| `@kanzo-tech/ui` | 593 | 167 | 143 | **40** |
| `@kanzo-tech/ui/analytics` | 136 | 82 | 77 | 5 |
| `@kanzo-tech/ui/table` | 12 | 0 | 0 | 0 |
| `@kanzo-tech/ui/editor` | 2 | 1 | 1 | 0 |
| `@kanzo-tech/ai` | 41 | 3 | 2 | 1 |
| `@kanzo-tech/graph` | 36 | **35** | 15 | 9 |

## 1. Three finished examples that no page shows

The cheapest item in the file: three `<ComponentPreview>` lines, or three deletions.

- `docs/examples/charts/example-color-legend.tsx` — 99 lines, `ChartColorLegend` + `ChartLegend`.
- `docs/examples/charts/example-stat.tsx` — 63 lines, `ChartStat` + `StatTile` + `ChartPickY`.
- `docs/examples/forms/example-controls.tsx` — 49 lines. `forms/controls.mdx` is a routing page —
  nine sections that each point at another page — so this one is plausibly a delete rather than a
  wire-up. **No legacy** says decide, not leave.

(`charts/mosaic-boot.tsx` and `charts/mosaic-demo.tsx` are also unreferenced and are *not* examples:
they are the one-coordinator-per-page helper `docs/CLAUDE.md` names. Leave them.)

## 2. `@kanzo-tech/graph` — 35 of 36 exports have no example

One example directory (`docs/examples/graph/`), one preview on `graph/index`, and 278 lines of page
around it. Fifteen exports are in neither an example nor a showcase, and nine are not named on any
page at all:

```
SHAPE  SHAPE_ORDER  SHAPE_OTHER  SUPERSEDED  adaptive  clusterRing  isColour
isSuperseded  typeOf
```

Plus six more that a showcase uses and no page mentions: `GraphRootProvider`, `appearance`,
`buffers`, `forces`, `memorySource`, `useGraphContext`.

This is the largest hole in the repository and it is not an example problem in isolation — `graph`
is the newest package and its page was written as an introduction rather than as a reference.

## 3. Forty `ui` exports are named on no page, in no example, in no showcase

Not "under-demonstrated" — **absent**. `documented-exports.test.ts` guards the opposite direction (a
page may not claim a symbol we do not export) and nothing guards this one.

Compound parts, mostly of four components:

```
CalendarContext  CalendarControl  CalendarLabel  CalendarPresetTrigger  CalendarTableBody
CalendarTableCell  CalendarTableHead  CalendarTableHeader  CalendarTableRow  CalendarTrigger
ColorPickerSwatchPreview  ColorPickerView  ComboboxContext  ComboboxPositioner
DatePickerPresetTrigger  DatePickerTimer  DialogPositioner  MenuPositioner  PopoverPositioner
SelectClearTrigger  SelectContext  SheetOverlay  SheetPositioner  TreeViewBranchIndicator
TourActionTrigger  TourOverlay  TourPositioner  TourSpotlight
```

Ten `Calendar*` parts is the whole `Calendar` compound below its root. Five `*Positioner` /
`*Overlay` parts are the Ark layer a caller reaches for only to reposition something — worth a
sentence on the page, not an example each.

And these, which are not parts of anything:

```
KanzoTheme  ThemeNotice  SidebarInput  safeParseColor
alertVariants  badgeVariants  comboboxItemVariants  dialogContentVariants
dialogOverlayVariants  menuContentVariants  nativeSelectVariants  toggleVariants
```

**`KanzoTheme` is the one to look at first.** It is a public component of the theme entry and it
appears nowhere in the documentation — `theming.mdx` is 475 lines with zero previews and does not
name it.

There are twelve `*Variants` exports in all and **not one of the twelve appears in an example**.
Eight of them are not named on a page either, while `buttonVariants`, `checkboxVariants`,
`inputVariants` and `statusVariants` are. That asymmetry looks like drift rather than a decision.

## 4. The thirty-nine `use*` exports have no example between them

```
useAccordion  useAvatar  useCheckbox  useClipboard  useCollapsible  useColorPicker  useCombobox
useDatePicker  useDialog  useEditable  useField  useHighlight  useHoverCard  useListbox  useMenu
useNumberInput  usePasswordInput  usePopover  useProgress  useQuestionnaire  useQuestionnaireItem
useRadioGroup  useRating  useResizable  useScrollArea  useSegmentGroup  useSelect  useSheet
useSlider  useSteps  useSwitch  useTabs  useTagsInput  useTagsInputContext  useToast  useToggle
useToggleGroup  useTooltip  useTreeView
```

Thirty-eight of them are one idea — *the api of the compound you are inside* — so the answer is one
example plus a line on each page, not thirty-nine examples. `hooks/index.mdx` has three sections and
no preview and is where that example belongs. (`useTagsInput` is the thirty-ninth and is a different
thing: Ark's machine hook, for building a controlled root. See below.)

**One thing the list surfaced that is not a doc fix.** `useTagsInput` and `useTagsInputContext` are
both exported, which looks like two spellings and is not: `tags-input.tsx` documents the choice —
the plain name is Ark's **machine** hook, for a controlled root, and the context hook takes the
suffix. Settled, leave it.

**WITHDRAWN — I then said the same thing about `useTourContext` and was wrong twice over.** The
claim was that it is the only context hook carrying the suffix with nothing to disambiguate
against, and that it should be renamed `useTour`. Both halves fail on contact with the repo:

- **It matches Shark exactly.** `shark-surface.json` lists `useTourContext`, and matching the
  reference is the stronger rule. A rename here would put `shark-parity.test.ts` in the red on
  purpose.
- **It is disambiguating, from something I had not looked for.** `@ark-ui/react` exports its own
  `useTourContext`, and ours returns `{ tour, handleStart }` rather than Ark's tour context.
  `shark-parity.divergences.ts` already carries the whole finding, held by
  `decisions/a-house-principle-withholds-no-name.md` and two tests.

**What was actually actionable is a sentence inside that same record: *"whose type is not exported
either"*.** So a consumer could call the hook and had no way to name what came back. Fixed —
`UseTourContextReturn` is exported now, on Ark's own `UseTourReturn` / `UseStepsReturn` pattern. It
was `TourProviderProps`, an unexported name for a `<TourProvider>` component that does not exist.
The error message went with it: it read *"useTour must be used within a TourProvider"*, naming a
hook this package does not export and a component nobody can render.

**The lesson generalises past this row.** Two of the two naming findings in this audit were settled
decisions with their reasoning already written down, and in both cases the file that settled it was
one `grep` away. A shape difference is a question, not a finding.

## 5. `@kanzo-tech/ai` is the flattest group in the documentation

Ten of the eleven `ai/` pages carry **one preview or none**:

| page | previews | sections | lines |
| --- | ---: | ---: | ---: |
| `ai/use-inline-completion` | 1 | 8 | 165 |
| `ai/message` | 1 | 6 | 178 |
| `ai/prompt-input` | 1 | 6 | 132 |
| `ai/conversation` | 1 | 6 | 116 |
| `ai/reasoning` | 1 | 6 | 118 |
| `ai/use-suggestions` | 1 | 6 | 116 |
| `ai/use-ai-stream` | 1 | 6 | 122 |
| `ai/tool` | 1 | 5 | 135 |
| `ai/task` | 1 | 5 | 90 |
| `ai/index` | 0 | 6 | 131 |
| `ai/fields` | 2 | 8 | 309 |

Against the rest of the library that is the low end by a wide margin: `forms/combobox` has 8,
`forms/select` 7, `forms/field` 7, `forms/input-group` 5, `analytics/charts` 10,
`data-display/data-table` 11. **The median page across all 138 is two previews and five sections.**
The `ai/` pages sit at one and six — fewer demonstrations over more ideas, which is that ratio
inverted.

**So Angel's complaint generalises exactly.** It is not that `use-suggestions` is missing a section
`use-inline-completion` has — it is that every `ai/` page documents five or six ideas and
demonstrates one of them. The three `ai` exports with no example are `AiMark`, `CompleteHint` and
`cleanGhost`, and `CompleteHint` is the one that matters: it is half of the answer to the
single-line `Complete` defect (§0b point 1a) and nothing shows it.

## 6. Twenty-four pages have no preview, and seven of them should

The other seventeen are prose by design: nine `(root)/*` pages, the seven `showcases/*` pages —
which embed an iframe rather than a preview — and `forms/controls`, which is a routing page.

| page | sections | lines | why it stands out |
| --- | ---: | ---: | --- |
| `layout/preferences` | 9 | 361 | carries a **prop table** and shows nothing |
| `(root)/theming` | 6 | 475 | the longest page with no preview; `KanzoTheme` lives here |
| `forms/validation` | 9 | 108 | a how-to with no worked case |
| `ai/index` | 6 | 131 | the group's entry point |
| `hooks/index` | 3 | 124 | where the §4 example belongs |
| `analytics/index` | 4 | 76 | the group's entry point |
| `graph/benchmarks` | 4 | 80 | numbers with nothing to run |

`layout/preferences` is the sharpest: a page with an API table and no preview is the shape that says
somebody meant to add one.

## What I would do, in order

1. **The three orphans** (§1) — wire two, decide on the third. Minutes.
2. **`layout/preferences` and `(root)/theming`** (§6, §3) — one preview each, and `KanzoTheme` and
   `ThemeNotice` get named. This is also the pair a consumer hits first.
3. **The `ai/` group** (§5) — this is the actual ask. Roughly three more previews per page; start
   with `CompleteHint`, because it is a live defect's answer.
4. ~~Rename `useTourContext`~~ — **withdrawn, see §4.** What shipped instead is the export of
   `UseTourContextReturn`, which is the gap the divergence record itself named.
5. **One context-hook example on `hooks/index`** (§4), and a line on each of the pages it covers.
6. **`graph`** (§2) — **half done.** The reference it wanted exists now and covers the whole
   surface. What is still owed is the other half of the sentence: examples. One directory, one
   preview, 35 of 36 exports undemonstrated — and unlike the `ui` parts above, these are not
   sub-parts nobody composes by hand. This one still wants its own pass.
7. ~~The forty absent `ui` symbols~~ — **done, 40 → 2.** A sentence or a table row per compound
   page, exactly as predicted, and no examples were needed.

   **The guard is still owed and is now nearly free.** The residue is **two** names —
   `KanzoTheme` and `ThemeNotice`, both blocked on the theme refoundation. Write it the day those
   two land and it needs no allowlist at all, which is the only version worth having: an allowlist
   is the second list `documented-exports.test.ts` argues against.

   **Measured 2026-08-22, and the residue is 13 rather than 2.** The 2 was `ui`'s components; the
   reverse question is asked of every entry point, so it also covers `theme`, `graph` and `ai`, and
   `theme` is where the rest live. Six were closed the same day — `AlertDialogBody`,
   `CalendarTodayTrigger`, `CalendarClearTrigger`, `ColorPickerTransparencyGrid`, `ChartFacetY`,
   `chartSeriesColor` — plus `ToggleGroup`/`ToggleGroupItem`, which had no section anywhere and now
   have one on `actions/toggle.mdx`. What is left is `KanzoTheme`, `ThemeNotice` and eleven of
   `@kanzo-tech/theme`'s own exports: `CORE_NAMESPACE`, `DENSITY_OBLIGATIONS`, `STORAGE_KEY`,
   `checkDensity`, `fallbackChain`, `inkFor`, `resolvePref`, `resolveSectionToken`, `sectionOf`,
   `themeData`, `withSection`. **All thirteen belong to pages the theme refoundation holds open**
   (`(root)/theming.mdx`, `(root)/sections.mdx`, `layout/preferences.mdx`), and the surface moved
   twice during the measurement itself — `inkFor`, `AA`, `contrast`, `hex` and `oklch` appeared in
   `theme`'s `dist` between two runs twenty minutes apart. Waiting is not caution here; the list
   would be wrong by tomorrow.

   **Do not reuse the claim sites for the reverse direction.** They are PascalCase-or-`use[A-Z]` by
   construction, which is right for "is this name real?" and useless for "is this name mentioned?":
   `cn`, `sql`, `min`, `buttonVariants` and 280 others can never be a claim, so the reverse question
   asked that way reports 280 misses of which 267 are the extractor's shape rule. The site that
   works is the flat one — **does the identifier appear anywhere in the corpus at all** — and its
   own weakness has to be written into the guard: `sum`, `mode`, `column` and `forces` pass on any
   page using the English word. That is the honest trade for a question about *absence*, where a
   false pass costs a missing sentence and nothing else.

   Where it goes is settled too: **into `documented-exports.test.ts`, not a second file.** That
   guard already resolves every entry point's real export set through the TypeScript checker and
   already parses every page; the reverse assertion is the same two inputs read the other way, and
   a second file would be a second corpus and a second way to resolve a surface. One thing to
   decide when writing it: `getExportsOfModule` returns types as well as values, and requiring a
   page to name every interface is a much stricter claim than this audit measured.
