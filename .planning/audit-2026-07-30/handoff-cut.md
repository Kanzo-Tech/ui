# Handoff — the component and export cut

Written by the agent that executed the cut, for the `docs/` agent and the guidance agent. Nothing
below is a request for an opinion: the cut is committed. This is the list of what it broke, what it
could not carry, and where I declined the audit's advice.

**Scope I was allowed to write:** `packages/**` and this file. Every `docs/**` consequence below is
therefore *reported*, not fixed.

---

## 0. What was cut, in one table

| Deleted | Where its value went |
|---|---|
| `composites/InstanceSwitcher.tsx` (+ test) | `Menu` + `SidebarIdentity*` + `SidebarMenuButton`, all exported |
| `composites/SidebarUser.tsx` (+ test) | same parts; `initials()` → **an example nobody has written yet** (§2) |
| `composites/SidebarNav.tsx` (+ test) | `SidebarMenu*`; `matchesPath` → **`isActivePath`**, exported from the root barrel, with a test |
| `composites/Breadcrumbs.tsx` (+ test) | `Breadcrumb*` parts; `min-w-0` → **onto `simples/breadcrumb.tsx`'s `Breadcrumb` base** |
| `composites/MadeWith.tsx` | nothing — it hard-coded English and the brand name |
| `composites/link.tsx` (`DefaultLink`, `LinkComponent`) | `asChild` on the part that renders the anchor |
| `simples/EmptyState.tsx` | `Item` + `ItemMedia`/`ItemTitle`/`ItemDescription`/`ItemActions` |
| `simples/Ribbon.tsx` | `Float` + `Badge` |
| `simples/TextField.tsx` (`TextField`, `NumberField`) | `InputGroup` + `InputGroupAddon`; numeric entry is `NumberInput` |
| `simples/DateField.tsx` | `DatePicker` + `Calendar*` parts |
| `table/DataTable.tsx` (+ test) | `DataTableRoot`/`Toolbar`/`Content`/`Pagination` — `docs/examples/data-table/example-complete.tsx` already *is* the composition |
| `theme/prefs-config.ts` | `@kanzo-tech/theme` directly |
| `Preferences`'s `Object.assign` namespace | the flat exports, which were always the API |
| `charts/theme.ts` | split into `lib/token-color.ts` (pure) + `lib/theme-tick.ts` (`"use client"`) |
| `charts/chart-inputs.tsx`'s `MosaicInputClient` | `charts/query-client.ts`, shared with `useChartQuery` |
| `charts/chart-spec.ts`'s `legend` directive kind | the `source: null` decorator mark path |
| `charts/tokenized-plot.tsx`'s `PlotColors` + `colors` arg | nothing; the only caller discarded them |
| `simples/use-is-mobile.tsx` | **moved** to `lib/use-is-mobile.ts`, and it gained `"use client"` |
| `linkRecipe` | **renamed** `linkVariants`, still module-level, now pinned by `index.test.ts` |

Every deletion has a tombstone assertion in `packages/ui/src/index.test.ts`, with the reason inline.
That is the mechanism that made the `CardRadioGroup` cut stick; please do not remove them.

---

## 1. `docs/` orphaned or broken by the cut

### 1a. Pages whose entire subject is gone — delete the page and its example dir

| Page | Example dir to delete with it |
|---|---|
| `docs/content/docs/navigation/instance-switcher.mdx` | `docs/examples/instance-switcher/` (1 file) |
| `docs/content/docs/navigation/sidebar-user.mdx` | `docs/examples/sidebar-user/` (1 file) |
| `docs/content/docs/navigation/sidebar-nav.mdx` | `docs/examples/sidebar-nav/` (2 files) |
| `docs/content/docs/navigation/breadcrumbs.mdx` | `docs/examples/breadcrumbs/` (3 files) |
| `docs/content/docs/layout/made-with.mdx` | `docs/examples/made-with/` (2 files) |
| `docs/content/docs/overlays/empty-state.mdx` | `docs/examples/empty-state/` (2 files) |
| `docs/content/docs/overlays/ribbon.mdx` | `docs/examples/ribbon/` (3 files) |
| `docs/content/docs/forms/text-field.mdx` | `docs/examples/text-field/` (5 files) |
| `docs/content/docs/forms/date-field.mdx` | `docs/examples/date-field/` (5 files) |

`audit-docs-site.md` proposed 106 → ~82 pages independently; nine of those come free here.

### 1b. Broken example files that are NOT in a deleted page's directory

These import a deleted symbol and sit under a page that survives. Each needs rewriting, not deleting.

| File | Deleted symbol | Rewrite as |
|---|---|---|
| `docs/examples/data-table/example-default.tsx` | `DataTable` | the parts, as `example-complete.tsx` already does |
| `docs/examples/data-table/example-empty.tsx` | `DataTable`, `EmptyState` | parts + `Item` composition |
| `docs/examples/data-table/example-footer.tsx` | `DataTable` | the parts |
| `docs/examples/data-table/example-sortable.tsx` | `DataTable` | the parts |
| `docs/examples/form/tanstack/example-date-field.tsx` | `DateField` | `DatePicker` + the ISO adapter inline (§2) |
| `docs/examples/field/example-field-set-messages.tsx` | `TextField` | `InputGroup` + `Input` |
| `docs/examples/sidebar-identity/example-default.tsx` | prose only — names `SidebarUser`/`InstanceSwitcher` in a comment | reword |

### 1c. Broken showcases

| File | Deleted symbols |
|---|---|
| `docs/showcases/app-shell/default.tsx` | `InstanceSwitcher`, `SidebarUser`, `SidebarNav`, `Breadcrumbs`, `MadeWith`, `EmptyState`, `Ribbon` |
| `docs/showcases/app-shell/data.tsx` | types `Instance`, `SidebarNavItem` |
| `docs/showcases/workspace/default.tsx` | `InstanceSwitcher`, `SidebarUser`, `SidebarNav`, `Breadcrumbs` |
| `docs/showcases/workspace/data.tsx` | types `Instance`, `SidebarNavItem` |
| `docs/showcases/workspace/graph-view.tsx` | `TextField`, `NumberField`, `DateField` |
| `docs/showcases/metadata-form/default.tsx` | `TextField`, `NumberField`, `DateField`, `MadeWith` |
| `docs/showcases/metric-card/metric-card.tsx` | `DefaultLink`, `LinkComponent` |
| `docs/showcases/palette-onboarding/panel.tsx` | `EmptyState` |

`app-shell/default.tsx` and `workspace/default.tsx` are the two heaviest. They are also the whole
*point* of the cut: `DESIGN.md:23` says specific arrangements belong in showcases, and these two
showcases are now where the five deleted composites get written out by hand, once, in full view.
That hand-composition is the replacement documentation.

### 1d. Import-path breaks from the `charts/theme.ts` split (§4 of the export audit)

These files import from `@kanzo-tech/ui/analytics` symbols that now live on the **root barrel**.
The fix is a one-word path change — `@kanzo-tech/ui/analytics` → `@kanzo-tech/ui`. Nothing else.

```
docs/lib/css-color.ts:13                       resolveTokenColor
docs/showcases/workspace/use-graph-look.ts:5   useThemeTick
docs/showcases/workspace/graph-model.ts:6      CHART_SLOTS, categoricalCapacity, categoricalColor
docs/showcases/workspace/graph-canvas.tsx:6    useChartCapacity   (also imports useMosaic — SPLIT the import, useMosaic stays on /analytics)
docs/showcases/workspace/graph-view.tsx:63     useChartCapacity   (same: split, the rest stays)
```

`docs/lib/css-color.ts:3` also has a prose comment naming the old subpath.

This is the finding worth telling readers about: a WebGL graph was installing the whole
DuckDB/Mosaic peer set to reach twelve lines of token arithmetic.

### 1e. Prose-only references (page survives, sentence is now false)

- `docs/content/docs/navigation/sidebar.mdx` — `:20`, `:24`, `:28`, `:56`, `:63`, `:77`, `:78`, `:82`
  all name the four deleted composites. This page needs the largest rewrite in the set: it is the
  page that teaches *how a sidebar is assembled*, and the answer is now "from the parts".
- `docs/content/docs/navigation/breadcrumb.mdx` — `:9`, `:13`, `:83` disambiguate against the
  deleted plural. Deleting those three passages makes the page shorter and better; it is one of the
  17 pages `audit-docs-site.md` found opening by explaining how it differs from a sibling.
- `docs/content/docs/forms/controls.mdx` — `:12`, `:23`, `:24`, `:98` (the `TextField`/`NumberField`/
  `DateField` rows of the control table).
- `docs/content/docs/forms/number-input.mdx:47-48` and `docs/content/docs/forms/input-group.mdx:26`.
- `docs/content/docs/forms/tanstack-form.mdx` — `:265`, `:278`, `:391-404`. The `DateField` section
  is substantial and is the only place the ISO-string contract is explained (see §2).
- `docs/content/docs/data-display/data-table.mdx` — `:11`, `:21`, `:41`, `:45`, `:229`.
- `docs/content/docs/data-display/table.mdx:12,57`, `stat-tile.mdx:20`, `charts.mdx:417`.
- `docs/content/docs/layout/float.mdx:30` ("`Ribbon` is built on it").
- `docs/content/docs/showcases/app-shell.mdx:12` (Ribbon), `showcases/metadata-form.mdx:11,38`.
- `docs/content/docs/(root)/philosophy.mdx:57` — cites `SidebarUser` as an example of a fix. The
  *argument* is still right; the example is now a deleted component, so it should cite the cut.
- The five `| linkComponent | LinkComponent | DefaultLink |` prop rows in
  `made-with.mdx`, `breadcrumbs.mdx`, `instance-switcher.mdx`, `sidebar-nav.mdx`, `sidebar-user.mdx`
  — all on pages that are being deleted anyway.

### 1f. A docs claim that was already false, and is now false differently

`docs/content/docs/navigation/link.mdx:36` says "`linkRecipe` is exported for applying the same
treatment to a router link component." It was **never** on the public surface (`index.tsx` exports
`Link` by name, not `export *`), so the sentence was already wrong. The symbol is now
`linkVariants` and is pinned as *not* exported by `index.test.ts`. Correct the sentence; do not add
the export. This is the right page to explain that a router link takes the treatment by spreading
`linkVariants()`, since `asChild` is now the only routing seam.

---

## 2. Value the cut could not carry, because its destination is `docs/`

I could not write these. Each is small and the source is in git history at `e210a59`.

1. **`initials()`** — 8 lines, `composites/SidebarUser.tsx:36-44` at `e210a59`. Splits a name on
   whitespace, takes the first letter of the first two parts, uppercases. It belongs in the
   hand-composed sidebar footer in `docs/showcases/app-shell/default.tsx`, as a local function.
   Do **not** ask for it back in `lib/` unless a second consumer appears.

2. **The breadcrumb collapse** — `composites/Breadcrumbs.tsx:69-71` and `:93-128` at `e210a59`.
   ~25 lines: keep the first entry and the last `maxItems - 1`, put the middle behind a
   `BreadcrumbEllipsis` inside a `Menu`. Wanted as `docs/examples/breadcrumb/example-collapsed.tsx`,
   which is exactly how Shark ships it. Two details worth preserving from the original, because both
   were learned the hard way and the comments say so:
   - the accessible name goes on the `Button`, not the `BreadcrumbEllipsis`, because the ellipsis is
     `aria-hidden` and decoration cannot name its own control;
   - `BreadcrumbSeparator` is a **sibling** of the item, never a child — both render as `li`, and an
     `li` inside an `li` breaks the row count screen readers announce.

3. **The `DateField` ISO-string ↔ `DateValue` adapter** — `simples/DateField.tsx:37-56` at
   `e210a59`, ~20 lines. This is the only genuinely non-obvious code in the deleted file, and
   `docs/content/docs/forms/tanstack-form.mdx:391-404` is built entirely on it ("a plain ISO string
   is what a form library wants; `DatePicker` speaks `DateValue`"). It needs to land in
   `docs/examples/date-picker/example-iso-value.tsx` **and** the tanstack-form page needs rewriting
   around the composition. If a second consumer ever appears, ask for it back as an exported
   `toDateValues` / `splitValue` in `lib/` — that is a real ask, not a convenience.

4. **`SidebarNav`'s two behaviours that were not `isActivePath`** — the active-descendant
   `defaultOpen` derivation (`SidebarNav.tsx:139`) and the mobile-close callback (`:92`), ~15 lines
   between them. Both are per-app policy. They want to be visible in
   `docs/showcases/app-shell/default.tsx`, not exported.

5. **`Ribbon`'s `inert` gating** (`Ribbon.tsx:105`) — one attribute, and `docs/examples/ribbon/`
   `example-disabled.tsx` demonstrated it. Worth keeping as
   `docs/examples/badge/example-ribbon.tsx`, because "dim it *and* make it inert" is the part people
   forget.

6. **`EmptyState`'s two classes** — `text-center` and `max-w-[420px]`. One class each, in whatever
   example replaces it.

---

## 3. What I did NOT cut, and why

Recorded because the standing lesson in this repo is that audit documents have been wrong before —
including, twice below, about their own premises.

### 3a. The 43 chart mark/interactor wrappers — owner's decision, upheld

`audit-exports.md` §2e recommends deleting 46 marks on the grounds that `ChartRaw` covers them
losslessly. **Overruled by the owner and left in place.** All of `chart-marks.tsx` and
`chart-interactors.tsx` is untouched.

### 3b. `chartDescriptor`, `useChart`, `useChartOptional`, `useMosaicInput` — kept exported

`audit-exports.md` tier B/C lists these; `audit-taxonomy.md` cut row 20 lists the first three.
I kept all four, and the reason is consistency with 3a rather than affection.

The owner's argument for the 43 marks is that a **grammar's vocabulary must be closed**: a hole
sends the author to `@uwdata` for the one thing we left out. `chartDescriptor` is the hatch for
writing a directive the vocabulary does not have, `useChart` / `useChartOptional` are how a custom
part reads the chart context, and `useMosaicInput` is the protocol under the three shipped controls
— `analytics.ts:76-79` argues for it in writing, in the same terms that keep `useChartQuery`.
Deleting the extension points while keeping 43 unused conveniences would be exactly backwards.

I *did* un-export the compiler that runs behind them: `compileChartSpec`, `buildChartSpec`,
`chartSpecSignature`, `chartSeriesEntries`, `isColorValue`, `CHART_CAPACITY_PROPERTY`. A descriptor
author never calls any of those.

### 3c. The five "dead" `@uwdata` re-exports — kept. **The audit is wrong here.**

`audit-taxonomy.md` cut row 13 says delete `loadJSON`, `loadParquet`, `loadSpatial`,
`loadExtension` and `clauseIntervals` because they have zero references.

They do have zero references. That is not the test the barrel applies. `analytics.ts:117` states the
rule in writing — *"a set is re-exported when it is **closed and named**, and stays a direct import
when it is open"* — and both sets qualify: the DuckDB loaders are a closed set, and `analytics.ts:158`
literally calls the clause set *"the five clauses"*. Deleting four of six loaders and one of five
clauses leaves a vocabulary with holes, which is the precise failure the owner just endorsed
avoiding for the 43 marks. Same rule, same answer.

The audit's *other* observation on this list is real and is a `docs/` bug, not a barrel bug: the
showcases import `loadCSV` and `clausePoints` **directly** from `@uwdata/*` rather than through us
(`docs/showcases/workspace/analysis-charts.tsx:5`, `graph-state.tsx:13`, `graph-view.tsx:4`), which
defeats the whole point of the re-export. Fix the showcases.

### 3d. The `charts/theme.ts` split is NOT the one the audit proposed

`audit-exports.md` §4b proposes `lib/token-color.ts` (`resolveTokenColor`, `useThemeTick`) +
`lib/categorical.ts` (`CHART_SLOTS`, `categoricalColor`, …, `useChartCapacity`). **That split does
not fix the bug it is filed under.** It puts a hook in each half, so each half still needs
`"use client"` — and `categoricalColor`, the function `chart-config.ts:73,82` actually calls, would
land in the module with `useChartCapacity` in it. The Server Component would still throw.

I split on the **client boundary** instead, which is the thing that was wrong:

- `lib/token-color.ts` — no directive. `resolveTokenColor`, `categoricalColor`,
  `categoricalCapacity`, `CHART_SLOTS`, `CHART_CAPACITY_PROPERTY`.
- `lib/theme-tick.ts` — `"use client"`. `useThemeTick`, `useChartCapacity`.

Both on the root barrel except `CHART_CAPACITY_PROPERTY`, which is tier B. The audit marked its own
file split **SUSPECTED**; this is that suspicion resolved.

Also worth recording: §4b says "two non-chart consumers already pay for it". It is **six** —
`docs/lib/css-color.ts` plus five files under `docs/showcases/workspace/`. The finding is stronger
than the report claims.

### 3e. `SidebarNav`'s missing `"use client"` — fixed by deletion, as the brief anticipated

`audit-exports.md` §5a FINDING 1 is real and I did not repair it: the file is gone. The **second**
half of that finding, `simples/use-is-mobile.tsx`, was real and is fixed — the file moved to
`lib/use-is-mobile.ts` and gained the directive.

### 3f. `ProgressTrack` — the audit's correction is confirmed, and acted on

`simples/progress.tsx:52-54` does render `<ProgressTrack><ProgressRange /></ProgressTrack>`
unconditionally, after `{children}`. Verified by reading it. So `DESIGN.md:239`'s "the ideal case,
not a defect" is wrong twice over: a consumer who follows the export gets **two** troughs, and an
export documented as "never place this yourself" is an export that should not exist. Un-exported,
symbol kept. **The guidance agent should fix `DESIGN.md:239-240`** — that paragraph is the one place
this is argued, and it argues the wrong way.

---

## 4. `theme/prefs-config.ts` — guaranteed rebase conflict

**Read this before merging.**

`packages/ui/src/theme/prefs-config.ts` is **deleted**. It was tagged IN-FLIGHT in both audits: the
parallel identity-axis session in the main checkout at
`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui` has it open, along with `theme/KanzoThemeProvider.tsx`,
`theme/theme-script.ts` and `composites/Preferences.tsx` — all four of which I also edited.

When that session's work meets this branch you will get:

- **`theme/prefs-config.ts`: delete/modify.** Take the delete. The file's entire body was
  `export { AXES, APPEARANCE_KEY, DEFAULT_PREFS, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme"`,
  and its own comment said it existed "so the existing import sites here keep working". Whatever the
  other session added to it belongs in `@kanzo-tech/theme`, which is where the table already lives.
- **`theme/KanzoThemeProvider.tsx` and `theme/theme-script.ts`: content conflict on the import
  block only.** Both now read `from "@kanzo-tech/theme"` instead of `from "./prefs-config.js"`. Keep
  the other session's symbol list, keep my module specifier.
- **`composites/Preferences.tsx`: content conflict around the `Object.assign`.** I deleted the
  namespace object and left `export function Preferences(…)` plus the flat exports. The other
  session is adding an identity section. Keep their section; do not let the `Object.assign` come
  back — `index.test.ts` now fails if it does.

One more, smaller: I moved `simples/use-is-mobile.tsx` → `lib/use-is-mobile.ts`. Any in-flight
branch importing the old path needs the new one.

---

## 5. Numbers

Export census, measured identically before and after with `checker.getExportsOfModule()` over the
four real entry files (`index.tsx`, `analytics.ts`, `table.ts`, `editor.ts`), union of distinct
names — the same method as `audit-exports.md` §1a.

| | Before (`e210a59`) | After | Δ |
|---|---:|---:|---:|
| **Union of the four entries** | **872** | **757** | **−115 (−13%)** |
| — values | 720 | 623 | −97 |
| — types | 152 | 134 | −18 |
| `index.tsx` | 649 | 550 | −99 |
| `analytics.ts` | 192 | 179 | −13 |
| `table.ts` | 28 | 26 | −2 |
| `editor.ts` | 4 | 3 | −1 |

(The audit reported 879/722/157 against the *dirty* main checkout, which carries the identity-axis
work; 872 is the same measurement against the clean base this branch sits on. The audit projected
~690; the remaining gap is the ~35 tier C *parts* — as opposed to aliases — that are still
outstanding, see §6.)

Reproduce with `checker.getExportsOfModule()` over the four entry **source** files, aliases
resolved, union of distinct names. Do not count by grepping the repo: it contains further full
copies of itself under `.claude/worktrees/`, and any census that walks them reports zero dead
exports because every symbol appears to have three consumers.

---

## 6. Not finished — what the next agent inherits

Committed and green (`test`, `typecheck`, `lint`, `build`, `check:generated`):

- **Step 1** — the `charts/theme.ts` client-boundary split, fixing both the RSC break and the
  placement failure.
- **Step 2** — the whole 18-row component cut and both relocations.
- **Step 3** — tier A (32 dead exports, symbol and all), `FieldSeparator`, tier B (36 un-exported,
  symbols kept), and 11 further tier C context aliases. The chart-layer duplication removal and the
  `/analytics` compiler un-export are in here too.
- **Step 5** — the client boundary: 57 surplus directives removed, and the invariant is now a guard
  test (`packages/ui/src/client-boundary.test.ts`) asserting both directions.
- Plus two live defects: `AlertDialogAction`, which was typed to close the dialog and did not, and
  `--font-heading`, which no `[data-font]` rule ever set.

**Outstanding:**

1. **Step 3, the remainder.** What is left of `audit-exports.md` §2b tier C is the ~35 *parts* with
   a doc page and no caller — `ActionBarTrigger`, `ActionBarBody`, `ColorPickerInput`,
   `ComboboxFieldInput`, `CommandSeparator`, `CommandFooter`, `DatePickerPresetTrigger`,
   `ListboxValueText`, `MenuQuickItem`, `NumberInputValueText`, `PopoverAnchor`,
   `RatingHiddenInput`, `SelectEmpty`, `TagsInputClearTrigger`, `TourPreviousStep`, `TourNextStep`,
   `TreeViewLabel`, `TreeViewCheckbox`, `parseColor`, and the three `SidebarGroupAction` /
   `SidebarGroupContent` / `SidebarMenuAction`. Unlike the aliases these are real components, so
   each needs a look rather than a sweep, and each deletion orphans a documented part.

   **The trap, hit twice already:** a mechanical multi-line regex over `export const X = (`
   swallowed the *next* component when `X` was a one-liner — it took out `CalendarPresetTrigger`,
   which `date-picker.tsx` renders. Typecheck caught it. Delete by locating the closing `};` at
   column 0, and read the diff's `-export` lines before committing.

   Also note: under `export *`, a module-level export **is** the public surface. Three tier B
   candidates (`safeParseColor`, `ComboboxTrigger`, `cleanGhost`) stayed exported because their
   sibling tests import them, and un-exporting would have deleted coverage.

2. **Step 4 — the `data-slot` sweep. Read this before starting; it is not the mechanical codemod
   the brief describes.** Moving `data-slot` after `{...rest}` everywhere **breaks the 38 thin
   `data-slot` renames** catalogued in `audit-exports.md` §6f — `AlertDialogTrigger`,
   `AlertDialogClose`, `SheetHeader`, `TourHeader`, `MenuSub`, `CommandGroup` and the rest all work
   *by* overriding the inner component's slot from outside. Flip the order and every one of them
   silently starts emitting the wrapped primitive's slot instead of its own.

   I hit this concretely: `AlertDialogAction` renders `<AlertDialogClose asChild
   data-slot="alert-dialog-action">`, and `alert-dialog.test.tsx:58-60` asserts the resulting slot.
   That test passes today and will fail the moment the order flips.

   The two readings are not equivalent and this needs the owner:
   - **(a) Literal.** Flip all 440 sites. The rename pattern dies structurally — which
     `audit-exports.md` §6f says it *should* ("`DialogHeader` with a `data-slot` override is the
     same thing without an export"). But that is a much larger change than "move an attribute", and
     it silently rewrites the rendered slot of ~38 components that pages and recipes may select on.
   - **(b) Scoped.** Flip only the primitives that a *foreign* caller passes `data-slot` into — the
     three live bugs at `chart-inputs.tsx:565`, `:408`, `:580` — and let an internal rename keep
     overriding. Cheap, fixes the reported breakage, leaves the class of bug open.

   Whichever is chosen, the guard test must be written to match: a test that bans `data-slot` before
   a spread will fail on all 38 renames under (b).

   `simples/combobox.tsx:142` is the single site already in the correct order.

3. **`scripts/smoke-install.mjs`** (`audit-exports.md` §7b) — it guards two symbols that have never
   existed (`EditorShell`, `GhostEditor`, `:63`), so the assertion can never fail; and it never
   checks `"use client"` preservation despite its own header (`:19`) naming that as the first bug
   class it exists to catch. Its `renderToString` assertions cannot substitute — `react-dom/server`
   outside an RSC bundler ignores the directive entirely.

### Two findings from doing the work, for whoever writes the rules down

**The client-boundary rule in CONVENTIONS.md is a shade too strong, and that is what caused the 59
surplus directives.** It says a file gets the directive if it "calls a React hook, registers an
event listener, **or imports a module that does**". The last clause is not how RSC works: the
boundary is established *once*, by the module with the hook in it, and every importer above that
point stays server-renderable. Ark depends on exactly this — it ships the directive on 1,567 of its
own dist files, which is the only reason a hook-free wrapper of an Ark machine can be a Server
Component at all. Suggested wording: *"…or imports a module that does **and lacks the directive**"*,
which is the same rule and cannot be misread. `packages/ui/src/client-boundary.test.ts` now enforces
the corrected form in both directions, so the prose and the test agree.

**`DESIGN.md:239-240` argues the wrong way about `ProgressTrack`** — see §3f. That paragraph is the
only place the "ideal case" framing appears, and the code contradicts it.

**Nobody has run `pnpm --filter @kanzo-tech/docs build` since the cut began.** It will fail, hard,
on every file in §1. That is expected and it is the docs agent's queue, not a regression.
`pnpm --filter @kanzo-tech/ui test` and `typecheck` are green at every commit on this branch.
