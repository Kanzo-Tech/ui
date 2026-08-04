# Kanzo UI — taxonomy, duplication, gaps, surplus

Scope: `packages/ui/src/{simples,composites,layouts,charts,table,theme}`, read against `DESIGN.md`,
`CONVENTIONS.md` and `.planning/*`. Read-only audit, 2026-07-30, branch `ds-ai-and-shark-alignment`.

> ### Rows 12 and 14, and the surplus table's un-export column — added 2026-08-01
>
> **Row 14 and the "un-export, do not delete the symbol" rows of the surplus table were reversed.**
> `decisions/a-house-principle-withholds-no-name.md` (Status live) restored every name Shark UI's
> registry exports, `ProgressTrack`, `ProgressRange`, `CheckboxIndicator`, the `CalendarTable*`
> parts and the `useX` context aliases among them, after reading Shark's own compositions and
> finding them identical to ours. They are pinned by `packages/ui/src/index.test.ts` and
> `packages/ui/src/shark-parity.test.ts`; un-exporting them now fails both.
>
> **Row 12's case-colliding pair was cut**, so its finding is closed rather than wrong.
>
> The taxonomy findings that do not touch the export surface are unaffected.
Every finding is labelled **CONFIRMED** (verified in source) or **SUSPECTED**, and **IN-FLIGHT** where it
lands on one of the 27 uncommitted files.

---

## Executive summary (the ten things that matter)

1. **The library is already smaller than its own spec thinks.** `AppShell`, `WorkspaceLayout`, `TwoPaneLayout`, `SidePanel`, `Toolbar`, `StatusBar`, `TopBarUtility`, `TopBar`, `PageShell`, `TopBarMain`, `CardRadioGroup`, `SectionNav`, `MetricCard`, `SecretField`, `ContextMenu*`, `Fieldset*`, `AiAssist` are all **gone**. DESIGN.md:164-175 and DESIGN.md:264-273 describe a tree that no longer exists. The header merge and the `FacetFilter` merge both **happened**.
2. **The one rule the library keeps breaking is the array/record-of-`ReactNode`s prop.** It is stated, correctly and at length, in a doc comment on `SidebarIdentity.tsx:31-36` — and violated by seven components, two of which hand their record straight back into `SidebarIdentity` itself. It is not in `CONVENTIONS.md`. That is why it keeps being re-lost. Draft rule in §3.
3. **`SidebarUser` and `InstanceSwitcher` are one component with two names**, down to byte-identical JSX and duplicated justification comments. This is the same charge DESIGN.md:172-180 upheld against `SectionHeader`/`PageShell`/`TopBarMain`.
4. **A minimal core of ~78 files is defensible; ~14 files are pure convenience over parts that already exist and ship exported.** Full Keep/Cut queue in §2.
5. **`theme/prefs-config.ts` is a pure re-export shim whose own comment says it exists "so the existing import sites here keep working"** — the exact legacy shape CONVENTIONS.md:67-70 already deleted once (`lib/tv.ts`). IN-FLIGHT.
6. **A live CSS bug: three `data-slot` collisions.** `chart-inputs.tsx:565`/`:408`/`:580` pass a `data-slot` into `Field`/`FacetFilter`/`Combobox`, which write theirs *before* `{...rest}` — so the primitive's slot is erased, and two `field.tsx` recipes that select on `[data-slot=field]` stop matching. §9.1. (Also: `chart-inputs.tsx:523` holds a literal NUL byte, which makes the file binary to `grep` and `file` and silently excluded it from my first three greps.)
7. **71 of 122 in-scope source files have no sibling test**, including the three largest bespoke ones: `composites/sidebar.tsx` (850 lines, 28 parts, a global keydown listener, cookie writes, `Math.random()` in a `useMemo`), `simples/table.tsx` (220 lines, 8 parts) and `composites/SidebarIdentity.tsx`. CONVENTIONS.md:117-119 sets a minimum bar that most of the library does not meet.
8. **`CONVENTIONS.md:90`'s "`ark.*` … with no exemption" is violated in ~24 places**, and worst in `SidebarIdentity.tsx` — the file whose doc comment sells `asChild` as the reason its API takes children, while none of its five parts supports `asChild`.
9. **`NumberField` and `NumberInput` are two numeric inputs with near-identical names**; `NumberField` is `TextField type="number"`, i.e. rung 1 of the ladder minted as a component, and it uses the forbidden `forwardRef`.
10. **`ShellAside` carries `bg-card`** — a surface, in the layer DESIGN.md:126 says "carries no aesthetic. No height, no surface, no typography." The layout layer's own headline rule is broken by the layout layer.

---

## 1. Corrections to the brief before anything else

- **`simples/CardRadioGroup.tsx` does not exist.** It was deleted in `06a3231` and is *kept* deleted by a guard assertion: `packages/ui/src/index.test.ts:95-99` (`expect(surface.CardRadioGroup).toBeUndefined()`), with the reasoning recorded at `packages/ui/src/index.tsx:175-178` and `.changeset/what-the-surface-audit-changed.md:7`. The grid it owned moved onto the primitive as `RadioGroup`'s `columns` prop (`simples/radio-group.tsx:26`, `:51-54`). DESIGN.md:264-273 still argues both sides of a decision that was taken. **CONFIRMED.** Nothing to re-argue: minimality already won here, and this is the model for every other cut in §2.
- **`docs/blocks/` does not exist.** Showcases live in `docs/showcases/` (six of them). DESIGN.md:24, DESIGN.md:349 and the code comment at `layouts/shell.tsx:12` all name a directory that is not there. **CONFIRMED.**
- **`composites/sidebar.tsx` does not hand-roll Separator/Input/Skeleton/Tooltip/Sheet/Button.** All six are imported from `simples/` and delegated to (`sidebar.tsx:8-23`, delegations at `:367-378`, `:406-419`, `:740-772`, `:642-645`, `:194-224`, `:294-308`). It is the best citizen in the audit set on CONVENTIONS.md:86. **CONFIRMED** — the suspicion in my brief was wrong.
- **`--chart-*` is now a real, bounded token family** (`packages/theme/tokens.css:108-115`, eight slots, plus `--chart-capacity` at `:203`). No component in `packages/ui/src` uses a `*-chart-N` utility, so CONVENTIONS.md:79's mention of `chart-*` is accurate but unexercised. **CONFIRMED.**
- **`inset-e-*` / `inset-s-*` are genuine Tailwind v4 utilities**, not typos — `packages/ui/dist/styles.css` compiles `.inset-e-2\.5{inset-inline-end:calc(var(--spacing) * 2.5)}`. But the library uses *both* spellings for one property (`Preferences.tsx:152` `end-4`, `Preferences.tsx:195` `inset-e-3.5`). Cosmetic; pick one. **CONFIRMED.**

---

## 2. THE MINIMAL CORE — Keep / Cut

The criterion applied: **a component earns its place if it supplies behaviour or DOM structure a caller cannot compose from what already ships.** "It has two call sites in our own showcases" is not a reason to keep, because DESIGN.md:23 already says specific arrangements belong in showcases; admission rule 2 was written to stop speculative additions, not to protect conveniences whose only consumers are our own demo pages.

Measured basis (re-derived, do not quote DESIGN.md's numbers): **881 exported names**; **293 with no consumer outside their own file and the barrel**; **150 of those are capitalised (component-shaped) exports**; **108 appear in exactly one `docs/examples/<slug>/` directory and nowhere else**; **38 of 58 `useX` context aliases have no consumer**; **2 of 10 `*Variants` objects have none**. (DESIGN.md:231-237 says 733 / 139 / 122 / 42-of-56 / 14-of-21 — all stale. The `*Variants` figure is stale in the *good* direction: `index.test.ts:106-133` now asserts thirteen of them are *not* exported.)

### 2a. KEEP — the fundamental pieces

**Ark-machine wrappers (47 files).** One machine, one file, no invented behaviour. The system cannot grow without them because Ark owns axis 3 (DESIGN.md:44-47) and re-deriving a machine is the one thing CONVENTIONS.md:88 forbids outright:
`accordion` · `action-bar` · `avatar` · `calendar` · `checkbox` · `client-only` · `clipboard` · `collapsible` · `color-picker` · `combobox` · `date-picker` · `dialog` · `download-trigger` · `editable` · `field` · `file-upload` · `floating-panel` · `highlight` · `hover-card` · `json-tree-view` · `listbox` · `menu` · `number-input` · `pagination` · `password-input` · `pin-input` · `popover` · `progress` · `radio-group` · `rating` · `resizable` (Splitter) · `scroll-area` · `segment-group` · `select` · `slider` · `steps` · `switch` · `tabs` · `tags-input` · `toast` · `toggle` · `toggle-group` · `tooltip` · `tour` · `tree-view` · `native-select` · `alert-dialog`.

**Appearance primitives with no machine but a real theming surface (17 files).** These are where the tokens land; delete one and every consumer re-invents a class list:
`button` · `badge` · `card` · `input` · `input-group` · `button-group` · `textarea` · `table` · `separator` · `skeleton` · `spinner` · `status` · `kbd` · `item` · `swatch` · `float` · `prose`.
Two of these are load-bearing beyond their size: `swatch` is the *only* way to depict a colour without a picker context, argued from Ark's source at `swatch.tsx:16-23` and pinned by `index.test.ts:30-34`; `prose` is deliberately the only typography component, and `prose.tsx:9-18` records the `Heading`/`Text` atoms that were removed to get there.

**Composition utilities (2).** `show` (15 lines, 15 example dirs + 10 showcases — the most-used thing in the library after `Button`) · `breadcrumb` (Shark's compound; Ark ships no breadcrumb machine, verified absent from `@ark-ui/react/dist/components/`).

**Layout (2 files, 15 parts).** `layouts/shell.tsx` (6 regions) · `layouts/section.tsx` (9 parts). This is the merged header vocabulary and it is the right size.

**Bespoke behaviour Ark does not ship and products actually need (5).**
`composites/sidebar.tsx` — CONVENTIONS.md:87 names it explicitly; 850 lines of real state (rail, offcanvas, mobile sheet, cookie persistence, keyboard toggle). Keep, but see §6 for the test debt.
`simples/FacetFilter.tsx` — one surface, two adapters, both shipped. The best-earned component added recently.
`simples/complete.tsx` + `simples/suggest.tsx` + `simples/use-ai.ts` — the AI-assist compounds, kept *off* the primitives on purpose (DESIGN.md:275-284).
`simples/FieldArray.tsx` — repeatable rows with a **render-prop** `children: (index) => ReactNode` (`FieldArray.tsx:19`). This is the correct shape, and it is worth citing as the counter-example in the rule I draft in §3.

**Theme runtime (3).** `theme/KanzoThemeProvider.tsx` · `theme/theme-script.ts` · `composites/Preferences.tsx` (see §6 for its namespace object). `composites/AppearanceToggle.tsx` keeps its place: DESIGN.md's own argument at `Preferences.tsx:55-58` is that appearance has exactly one control, and this is it.

**Engines, thin (11).** `table/{data-table-root,data-table-content,data-table-toolbar,data-table-pagination,use-data-table,select-column,sortableHeader}` and `charts/*` — subject to the charts audit in §9. The engine rule (DESIGN.md:66-89) is genuinely satisfied on the table side: `data-table-content.tsx:6-14` imports and `:66-133` renders `simples/table.tsx`'s parts, with zero raw `<table>`/`<tr>`/`<td>`. **CONFIRMED.**

**`composites/CodeEditor.tsx`** — the only genuinely bespoke surface Ark and Shark do not cover, and correctly isolated on `/editor` (`packages/ui/src/editor.ts:13`).

### 2b. CUT — the work queue, most valuable first

| # | Cut | Evidence | Where its value goes | What is genuinely lost |
|---|---|---|---|---|
| 1 | **`composites/InstanceSwitcher.tsx`** (184 lines) | Byte-identical to `SidebarUser` in trigger, identity row, menu body and comments — see §4.1 for the line-by-line | Nothing: `Menu` + `SidebarIdentity*` + `SidebarMenuButton` are all exported. One showcase (`docs/showcases/app-shell/default.tsx`) | Nothing. The `right-start` vs `right-end` and `min-w-60` vs `min-w-56` differences are call-site classes |
| 2 | **`composites/SidebarUser.tsx`** (136 lines) | Same as above; `user: { name; email?; avatarUrl? }` (`SidebarUser.tsx:30`) is *literally* the record `SidebarIdentity.tsx:31-32` names as the shape it rejects | A hand-composed `docs/showcases/app-shell` footer + a `docs/examples/sidebar-user/` example | `initials()` (`:36-44`) — 8 lines; move to the example, or export as `initials()` from `lib/` if a second consumer appears |
| 3 | **`composites/Breadcrumbs.tsx`** + `BreadcrumbEntry` (153 lines) | §3 case 1. Shark ships one breadcrumb (the compound) and does *Collapsed* by hand; the file admits this at `:57-59`. Zero lib consumers | (a) the `min-w-0` fix onto `simples/breadcrumb.tsx`'s `Breadcrumb` base — it is additive and the file says so at `:131-134`; (b) the `maxItems` collapse as `docs/examples/breadcrumb/example-collapsed.tsx`, mirroring Shark; fold `navigation/breadcrumbs.mdx` into `breadcrumb.mdx` | The collapse *logic* (`:69-71`, `:93-128`) is real. It is ~25 lines and is per-app policy (how many crumbs fit is a layout question), so an example is the honest home |
| 4 | **`composites/SidebarNav.tsx`** (171 lines) | §3 case 2. A **two-deep** layout tree as an attribute (`:29-38` nesting `:20-26`), with `title: string` so a caller cannot even bold a word | (a) export `matchesPath` (`:65-68`) as `isActivePath(activePath, href)` — 4 lines, genuinely reusable; (b) the active-descendant `defaultOpen` derivation (`:139`) and the mobile-close callback (`:92`) into a showcase | `aria-current` was never there to lose (§6.4). The three behaviours are ~15 lines total |
| 5 | **`simples/EmptyState.tsx`** (30 lines) | `icon`/`title`/`description`/`action` as four `ReactNode` props over a raw `<div>` (`:21-26`); no `ark.*`, no `tv()`, hand-declared `ref?: Ref<HTMLDivElement>` (`:14`) instead of `ComponentProps` | `Item` + `ItemMedia`/`ItemTitle`/`ItemDescription`/`ItemActions` already ship (`simples/item.tsx:101`, `:150`, `:167`, `:183`) and compose to exactly this | The `text-center` centring and `max-w-[420px]` — one class each, in the example |
| 6 | **`simples/Ribbon.tsx`** (120 lines) | `Float` + `Badge`, four scalar props. The whole render is `<div className="relative">{children}<Float className="-end-2 -top-2"><Badge/></Float></div>` (`:98-116`). Zero lib consumers | A `docs/examples/badge/example-ribbon.tsx` composition | `inert` gating (`:105`) is a nice idea; it is one attribute and belongs at the call site. `placement="inline"` is `flex` + a sibling |
| 7 | **`composites/MadeWith.tsx`** (40 lines) | A `<p>` with a heart. Hard-codes the English `Made with` / `at` (`:33`, `:35`) and defaults `by = "Kanzo"` (`:20`) — a **brand name** in a library whose admission rule 1 is domain-freedom. Zero lib consumers | A snippet in the app-shell showcase | Nothing |
| 8 | **`simples/TextField.tsx`** → `TextField` *and* `NumberField` (58 lines) | `iconStart`/`iconEnd` (`:19-21`) are the condemned record shape over `InputGroup` + `InputGroupAddon`, both exported. Both components use the forbidden `React.forwardRef` (`:28`, `:55`, vs CONVENTIONS.md:64-66). `NumberField` is `TextField type="number"` (`:56`) — rung 1 minted as a file, and its name collides with the Ark machine `NumberInput` | `InputGroup` composition (3 lines); numeric entry is `NumberInput`, which has steppers, scrubber, format and clamping | Nothing. `type="number"` is the input everybody advises against, so `NumberField` is a *worse* answer than the machine it shadows |
| 9 | **`theme/prefs-config.ts`** (16 lines) | The entire body is `export { AXES, DEFAULT_PREFS, STORAGE_KEY, type ThemePrefs } from "@kanzo-tech/theme"` (`:15`), and `:6-7` says it exists "so the existing import sites here keep working" | Point the ~2 importers at `@kanzo-tech/theme` | Nothing. CONVENTIONS.md:67-70 killed `lib/tv.ts` for precisely this. **IN-FLIGHT** |
| 10 | **`table/DataTable.tsx`** (60 lines) | A preset over `DataTableRoot`/`Toolbar`/`Content`/`Pagination`, all exported; `searchKey`/`searchPlaceholder`/`toolbarActions`/`empty` are the toolbar's tree as four scalars (`:15-24`). The file's own doc comment concedes it (`:27-32`). Zero `data-slot` anywhere in it | `docs/examples/data-table/example-complete.tsx` already *is* the composition | Convenience only. Torn? No — but the fact that would change my mind: a real product outside this repo importing `DataTable` and never the parts |
| 11 | **`simples/DateField.tsx`** (119 lines) | Pre-arranged `DatePicker` + nine `Calendar*` parts (`:87-107`). Takes no `className`, no `ref`, no `...rest`, no `id`/`name`/`aria-*` (`DateFieldProps`, `:53-62`) — so it is *less* capable than the parts. Ark ships an unadopted `date-input` machine (segmented entry) that is the real answer here | A `docs/examples/date-picker/example-date-field.tsx`; the ISO-string ↔ `DateValue` adapter (`:37-56`) is the only real code and is 20 lines | The ISO-string contract is genuinely useful to form libraries. Keep it as an exported helper (`toDateValues`/`splitValue`) if a second consumer appears |
| 12 | **`simples/Link.tsx` *or* `composites/link.tsx`** — pick one | Two files differing only in case, in a repo whose CONVENTIONS.md:93 says "Never rely on case-insensitive resolution — CI is case-sensitive even though macOS is not." Both render an `<a>` emitting the *same* `data-slot="link"` (`Link.tsx:26`, `link.tsx:19`). `DefaultLink` uses the forbidden `forwardRef` (`link.tsx:16`) | Keep `simples/Link.tsx` (it has the recipe and 3 showcases); move `LinkComponent` + `DefaultLink` into it, or into `lib/`. Rename `linkRecipe` → `linkVariants` (`Link.tsx:11`) — it is the only `*Recipe` in a library of ten `*Variants` | Nothing |
| 13 | **`analytics.ts`'s five dead re-exports** | `loadJSON`, `loadParquet`, `loadSpatial`, `loadExtension` (`analytics.ts:142`), `clauseIntervals` (`:167`) — **zero** references anywhere in the repo, not even the barrel | Nothing to relocate | Nothing |
| 14 | **The 150 zero-consumer capitalised exports** | Full list derivable; the concentrations are (a) ~52 chart marks/interactors re-exported from `analytics.ts` with no renderer, (b) Ark `*Positioner`/`*Context` renames (`ComboboxPositioner`, `MenuPositioner`, `PopoverPositioner`, `SheetPositioner`, `TourPositioner`, `SelectContext`, `ListboxContext`, `CalendarContext`, `ComboboxContext`), (c) the 11 `Calendar Table*` parts, (d) `FieldSeparator` and `useField` (still the two Field parts with no consumer — DESIGN.md:229 is the one measurement in that paragraph that still holds) | Delete the export lines. **The trap DESIGN.md:236-240 names is real** — `ProgressTrack`, `CheckboxIndicator` and the `Calendar Table*` parts are *rendered by their own root*, so deleting the symbol breaks the component. Delete the **export**, keep the symbol. There is no compatibility question here: nothing consumes them | Nothing |
| 15 | **`Preferences`'s `Object.assign` namespace** (`Preferences.tsx:515-540`) | The file's own comment at `:542-549` says these statics "do NOT survive React Server Components" and "read back as `undefined`". A broken API kept beside the working one | Nothing — the flat exports at `:551-562` are the API | Nothing. It also makes CONVENTIONS.md:103-104's claim ("no component does today") false. **IN-FLIGHT** |
| 16 | **`simples/use-is-mobile.tsx`** — move, not delete | A hook in a `.tsx` file with no JSX, not exported from the barrel, one consumer (`sidebar.tsx:72`) | `lib/use-is-mobile.ts` | Nothing |
| 17 | **`PlotColors` + `TokenizedPlot`'s `colors` argument** | `tokenized-plot.tsx:11-16`, `:95-98` resolve two tokens per rebuild; the only caller discards them (`chart-root.tsx:253` `render={(_colors, …)}`) | Nothing to relocate | Nothing. Removes one of three parallel token-resolution paths (§9.2) |
| 18 | **`charts/chart-inputs.tsx`'s `MosaicInputClient`** | Byte-for-byte `use-chart-query.ts:35-57`; `useMosaicInput`'s effect (`:129-144`) reimplements `useChartQuery`'s (`use-chart-query.ts:69-75`) | `useMosaicInput` composes `useChartQuery` | Nothing. ~40 lines, and one of two places a Mosaic lifecycle bug can hide (§9.3) |
| 19 | **The `legend` directive kind** (`chart-spec.ts:40-44`, `chart-root.tsx:46`) | The `source === null` decorator path at `chart-marks.tsx:114-116` + `chart-root.tsx:34` already does this; `ChartColorLegend` is `mark("ChartColorLegend", "colorLegend", true)` | Nothing | Nothing (§9.4) |
| 20 | **8 chart internals exported through `analytics.ts`** | `buildChartSpec`, `compileChartSpec`, `chartSpecSignature`, `chartDescriptor` (`analytics.ts:101`), `chartSeriesEntries` (`:24`), `isColorValue` (`:24`), `CHART_CAPACITY_PROPERTY` (`:114`), `useChartOptional` (`:20`) — no consumer outside `charts/` | Un-export; keep the symbols | Nothing. `isColorToken` is already correctly internal, which is the inconsistency (§9.10) |

**Net:** 18 deletions and 2 relocations take the surface from ~122 files to ~104, and from 881 exports to roughly 690 — without losing a single behaviour that is not either (a) four lines of policy, or (b) already composable from exported parts.

**Explicitly NOT cut, against the minimality instinct:** the 43 chart mark/interactor wrappers with no
call site (§9.10). They fail admission rule 2 outright, and I would still keep them — one-line `vg.*`
descriptors, verified en masse by the vocabulary test at `chart-marks.tsx:42-53`, over a grammar where a
mark you have to write yourself is a mark you write wrong. This is the one place where a catalogue is
genuinely cheaper than a curation. But `analytics.ts:148-150` is the only place that argues it, and it
needs to be in `DESIGN.md`, because as written the admission rules condemn it.

**Where I am torn, and the fact that would settle it:** `simples/action-bar.tsx` (359 lines, one example dir, one showcase, zero lib consumers) and `simples/tour.tsx` (420 lines, 15 exports, 8 of them with no consumer). Both wrap real Ark machines, so admission rule 3 protects them; but both are large, and neither has a consumer outside its own demo. I would **keep** both, because deleting an Ark machine wrapper is the one deletion the library cannot cheaply reverse. The single fact that would flip me: a product shipping without either after six months.

---

## 3. The array-prop family — one rule, seven violations

### 3.1 The rule, as the repo already states it

`packages/ui/src/composites/SidebarIdentity.tsx:31-36`, verbatim:

> The content is CHILDREN, not an `IdentityData` object prop. A record of `ReactNode`s
> (`label`/`description`/`avatarUrl`/`fallback`/`icon`) is a layout tree written as an
> attribute: you cannot reorder it, wrap a region, spread props onto one, or use `asChild` —
> and the avatar could only ever be an `<img src>` plus initials, never a badge or a status
> dot. Composition gives all of that back, and matches how every simple in this library
> already works — `CardHeader`, not `<Card header={…} />`.

It is cited as precedent twice (`packages/ui/src/index.tsx:175-178`; `DESIGN.md:269-271`) and it is
in neither normative document. **CONFIRMED.**

### 3.2 The test, applied to each case

The test: *can the caller do with the array what composition would allow — reorder, wrap a region,
spread props onto one entry, use `asChild`, put a badge or a status dot inside one?* If not, and the
parts to compose already exist and are exported, it is the condemned shape.

**1. `composites/Breadcrumbs.tsx:31` — `items: BreadcrumbEntry[]` → CONDEMNED. CONFIRMED.**
Entry is `{ label: ReactNode; href?: string; icon?: ReactNode }` (`:22-28`). Reorder: yes (the array is
the caller's). Wrap a region: no. Spread props onto one crumb: **no** — no `className`, `data-*`,
`onClick` or `aria-*` can reach a single `<li>`. `asChild` on one crumb: **no**. Badge inside one:
partially, via `label: ReactNode`, but you cannot make one crumb a `MenuTrigger`. Every part needed is
exported (`Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`,
`BreadcrumbSeparator`, `BreadcrumbEllipsis` — `simples/breadcrumb.tsx`). The file also had to invent
`BreadcrumbEntry` because `BreadcrumbItem` was taken (`:18-21`) — **a new component that forces a
synonym for an existing concept is evidence against itself.** → Cut #3 above.

**2. `composites/SidebarNav.tsx:51` `items: SidebarNavItem[]` and `:37` `items?: SidebarNavSubItem[]` → CONDEMNED, and the worst instance. CONFIRMED.**
Two levels deep (`:29-38` nesting `:20-26`), and `title: string` — not `ReactNode` — so you cannot bold
a word, add a status dot, or truncate differently. Spread onto one row: no. `asChild` on one row: no,
even though `SidebarMenuButton` *supports* `asChild` and the component uses it internally (`:110`,
`:157`). `SidebarNavSubItem` is not even exported from the barrel (`index.tsx:225` exports only
`SidebarNavProps`, `SidebarNavItem`), so a consumer typing the nested array has no name for its element.
→ Cut #4.

**3. `composites/InstanceSwitcher.tsx:52` `actions?: InstanceSwitcherAction[]` and `:46` `instances: Instance[]` → CONDEMNED, and this is the sharpest single finding in the report. CONFIRMED.**
`Instance` (`:28-35`) is `{ id; label: ReactNode; description?: ReactNode; icon?: ReactNode; avatarUrl?: string }` — the
`label`/`description`/`avatarUrl`/`icon` record that `SidebarIdentity.tsx:31-32` names, **field for
field** — and `InstanceSwitcher.tsx:68-87` unpacks it straight back into `SidebarIdentity`'s children.
The predicted limitation is visible in the code: `:76-78` can only produce initials, via
`typeof inst.label === "string" ? inst.label.slice(0, 2)`, and silently renders nothing when `label` is
a node. `InstanceSwitcherAction` (`:38-43`) is `MenuItem` + `Link` as data; you cannot put a
`MenuSeparator` between two of them, disable one, or `asChild` one. → Cut #1.

**4. `composites/SidebarUser.tsx:30` `user: {…}` and `:32` `menuItems?: SidebarUserMenuItem[]` → CONDEMNED. CONFIRMED.**
The tell is `separatorBefore?: boolean` (`:26`, rendered `:111`): a *separator between children*
expressed as a boolean field on a data object, because there are no children to put one between. → Cut #2.

**5. `simples/CardRadioGroup.tsx` — does not exist.** Already resolved (§1). The `columns` prop that
replaced it (`radio-group.tsx:26`, `:51-54`) is the model outcome: real work moved onto the primitive,
sugar deleted, and the number written to a `--columns` custom property so a caller can override it per
breakpoint — which an attribute could not.

**6. `table/data-table-toolbar.tsx:83` — `options?: DataTableFacetOption[]` → GENUINE DATA. KEEP. CONFIRMED.**
This one passes the test by being exempt from it. The default is `options ?? [...counts.keys()]`
(`:105`), i.e. **omitting it is the normal case**; supplying it only relabels values the column already
has. It feeds `FacetFilterItem[]` (`:106-109`), which feeds `createListCollection` in
`FacetFilter.tsx:136-144` — and an Ark listbox collection *cannot* be built from children, because the
machine navigates the collection, not the DOM (the comment at `FacetFilter.tsx:134-135` says exactly
this). A column's values are data; there is no layout tree here. One caveat: `icon?: ComponentType`
(`:68`) is an item's *renderer* passed as data, which is one step further than needed —
`icon?: ReactNode` would do, since nothing calls it with props.
Same verdict for `simples/FacetFilter.tsx:36` `items`, `simples/tour.tsx:57` `steps`,
`simples/suggest.tsx:21` `items`, `simples/segment-group.tsx:29` `options`,
`table/data-table-pagination.tsx:19` `pageSizes` — all collection inputs to a machine, not markup.

**7. `simples/TextField.tsx:19-21` — `iconStart`/`iconEnd` → CONDEMNED. CONFIRMED.** Named regions as
attributes over `InputGroup` + `InputGroupAddon`, both exported. → Cut #8.
**8. `table/DataTable.tsx:20` `toolbarActions`, `:24` `empty`; `table/data-table-content.tsx:20` `empty` → CONDEMNED (mild).** One-slot cases; the honest form is a `DataTableEmpty` part. → Cut #10.

### 3.3 Yes, it is one rule. Draft, in the repo's voice, for `CONVENTIONS.md`

> ### A layout tree is children, never an attribute
>
> Discovered three times and lost twice, which is why it is here rather than in a doc comment.
>
> > **If a prop's value is markup, it is children. A record or an array of `ReactNode`s is a layout
> > tree written as an attribute.**
>
> What the attribute form takes away, and the caller cannot get back: you cannot reorder the regions,
> wrap one in a container, spread `className` / `data-*` / `aria-*` / a handler onto one of them, or use
> `asChild` on one. `<SidebarIdentity>` states the consequence in full
> (`composites/SidebarIdentity.tsx:31-36`) and it is the canonical statement of this rule: the avatar
> "could only ever be an `<img src>` plus initials, never a badge or a status dot." `CardHeader`, not
> `<Card header={…} />`.
>
> **The line is what the value *is*, not whether it is an array.** A collection a machine navigates is
> data and belongs in a prop — Ark's `createListCollection` cannot be built from children, so
> `FacetFilter`'s `items`, `Tour`'s `steps` and `Select`'s collection are correct. A column's faceted
> values are data (`DataTableFacetFilter`'s `options` defaults to *the column's own values*, which is
> the proof). Numbers, ids and strings are data. **`ReactNode` in the field type is the tell**, and a
> `separatorBefore: boolean` is the confession: a separator between children, in a shape that has no
> children to put one between.
>
> When you need the ergonomics of a list, take a **render prop**, not a record —
> `FieldArray`'s `children: (index) => ReactNode` (`simples/FieldArray.tsx:19`) is the shape that keeps
> composition and still owns the loop.
>
> A convenience that flattens a compound into an array is rung 1 of the ladder wearing rung 5's
> clothes. It goes in `docs/examples/`, where it is a demonstration rather than an API.

---

## 4. Duplicates / two ways to do one thing

### 4.1 `SidebarUser` and `InstanceSwitcher` are one component — SEVERE. CONFIRMED.

Same tree, part for part, with the justification comments copy-pasted:

| Concern | `SidebarUser.tsx` | `InstanceSwitcher.tsx` | Difference |
|---|---|---|---|
| state | `:61-62` | `:104-105` | none (identical two lines) |
| wrapper | `:82-83` `SidebarMenu > SidebarMenuItem` | `:110-111` | none |
| positioning | `:87` `placement: isMobile ? "bottom-end" : "right-end", gutter: 4` | `:115-117` `"bottom-start" : "right-start", gutter: 4` | `-end` vs `-start` |
| comment | `:84-86` | `:112-114` | near-verbatim |
| trigger | `:95-99` | `:125-133` | same class list, one via `cn` |
| chevron | `:101` | `:135` | **byte-identical** |
| `aria-label`-not-`tooltip` comment | `:92-94` | `:121-124` | near-verbatim |
| identity row | `:66-79` | `:58-89` | `+` an `icon` branch |
| content width | `:104` `min-w-56` | `:141` `min-w-60` | a class |
| action loop | `:109-130` | `:163-177` | same `act-${i}` convention, same body |
| separator gate | `:108` | `:162` | same |

**Rule broken.** DESIGN.md:174 ruled on exactly this: *"`PageShell`, `SectionHeader`, `TopBarMain` | merge — one header vocabulary"*, and DESIGN.md:180: *"Same structure, three names."* `index.tsx:243-245` records the same merge already performed for `SectionNav` → `SidebarNav`.
**Action.** Delete both (Cut #1, #2). If a component is wanted at all, it is one — "a `SidebarIdentity` trigger opening a `Menu`" — and the four differences (`placement`, `min-w-*`, whether menu rows are identities, `variant`/`separatorBefore` on items) are props, i.e. rungs 1-3.

### 4.2 The header rule — MERGE HAPPENED. CONFIRMED.

`PageShell`, `TopBarMain` and standalone `SectionHeader` are gone from `packages/ui`. `SectionHeader`
now exists only as a part of the `Section` compound (`layouts/section.tsx:67-76`), with `scale`
(`:47-50`) as the single axis that differed, and the merge is documented in the file at `:12-21`. The
remaining mentions of the old names are in `.planning/*`, `.changeset/*` and doc comments. **DESIGN.md:174 is satisfied; DESIGN.md:176-188 should be rewritten in the past tense.**

### 4.3 The layout table (DESIGN.md:164-175) — ENTIRELY STALE. CONFIRMED.

`AppShell`, `WorkspaceLayout`, `TwoPaneLayout`, `SidePanel`, `Toolbar`, `StatusBar`, `TopBarUtility`,
`TopBar` all return **zero** hits in `packages/ui/src`. `AppShell` and `WorkspaceLayout` exist as the
intended showcases (`docs/showcases/app-shell/`, `docs/showcases/workspace/`). The table describes
work that is finished.

### 4.4 The menu-vs-listbox rule — DONE, ON BOTH SIDES. CONFIRMED.

DESIGN.md:332-334 says `DataTableFacetFilter` and the chart filter "were built as menus anyway". Both
now go through the one listbox surface:
- `table/data-table-toolbar.tsx:94-122` — `DataTableFacetFilter` is a 28-line adapter that renders `FacetFilter` (`:112`).
- `charts/chart-inputs.tsx:325-427` — `ChartFilter` renders the same `FacetFilter` (`:406`), with the string↔raw-value map at `:396-397`.
- `FacetFilter.tsx:199-241` is `Listbox` + `ListboxInput`/`ListboxItem`/`ListboxItemIndicator`, never `Menu`.
- `DataTableViewOptions` (`data-table-toolbar.tsx:136-167`) correctly stays a `Menu` — column visibility is a command.
- Both list rules DESIGN.md:336-339 names are implemented once, in the shared surface: alphabetical sort at `FacetFilter.tsx:117-119`, faceted-away values kept at `:111-113`.
Pinned by `index.test.ts:37-50`. **The spec paragraph is stale; the code is right.**

### 4.5 Colour swatches — CONSOLIDATED. CONFIRMED.

The "three ways to draw a colour" is fixed. `data-slot="swatch"` is emitted from exactly one place
(`simples/swatch.tsx:44`); the other five occurrences are its own test file. `Preferences.tsx:370-373`
uses `SwatchGroup`; `simples/color-picker.tsx:291-401` holds the Ark picker parts for the *choosing*
case; the division of labour is argued from Ark's source at `swatch.tsx:16-23` and pinned by
`index.test.ts:30-34`. **My standing note that Preferences hand-rolls swatches is out of date.**

### 4.6 `simples/Link.tsx` vs `composites/link.tsx` — DUPLICATE `data-slot`, CASE-COLLIDING FILENAMES. CONFIRMED.
Two files one capital letter apart, both emitting `data-slot="link"` (`Link.tsx:26`, `link.tsx:19`),
one styled and one not. CONVENTIONS.md:93 warns about exactly this collision. → Cut #12.

### 4.7 `NumberField` vs `NumberInput` — TWO NUMERIC INPUTS. CONFIRMED.
`simples/TextField.tsx:55-57` `NumberField` is a text input with `type="number"`; `simples/number-input.tsx`
is Ark's machine with steppers, scrubber, format and clamp. Nothing in the API tells them apart, and
the *worse* one has the friendlier name. → Cut #8.

### 4.8 `regionScrolled` written twice — MINOR. CONFIRMED.
`table/data-table-content.tsx:34-35` + `:53` duplicates `simples/table.tsx:60` verbatim, comment
included, and the result is two nested wrapper boxes for one table (`data-table-content.tsx:62-65`
around `simples/table.tsx:63-67`). The border box is the missing `bordered` variant on `Table` —
rung 1.

---

## 5. Missing

Only gaps something in this repo actually asks for (admission rule 2).

**5.1 Ark ships a `drawer` machine; `sheet.tsx` uses `dialog` instead. SUSPECTED (real machine, demand arguable).**
`packages/ui/node_modules/@ark-ui/react/dist/components/drawer/` exists with `drawer-positioner`,
`drawer-backdrop`, `drawer-grabber`, `drawer-swipe-area`, `drawer-stack`, `use-drawer-stack-store`.
`simples/sheet.tsx` is built on our `Dialog` and hand-rolls the side variants; `composites/sidebar.tsx:194-224`
uses it as the mobile drawer. What the machine adds and we do not have: swipe-to-dismiss, a grabber, and
drawer stacking. CONVENTIONS.md:86 ("Adopt, don't rebuild") and admission rule 3 point at it. I would
**not** act on this yet — the demand is one mobile sidebar — but it belongs on the list, because
"Sheet is Dialog" is a decision nobody wrote down.

**5.2 Ark ships a `date-input` machine (segmented entry); nothing adopts it. CONFIRMED (absent), SUSPECTED (demand).**
`.../components/date-input/` ships `date-input-segment`, `date-input-segment-group`,
`date-input-control`, `date-input-hidden-input`. `DateField` instead pairs `DatePickerInput` (a plain
text box) with a raw time input (`DateField.tsx:106-110`). Two consumers exist
(`docs/showcases/metadata-form/default.tsx`, `docs/showcases/workspace/graph-view.tsx`), so demand is
proven for *date entry*; whether it is proven for *segmented* entry is not. Note this in
`forms/date-field.mdx` rather than building it.

**5.3 `RadioGroup` has no plain text part for a card. CONFIRMED.**
`RadioGroupText` (`radio-group.tsx:173-185`) wraps `ArkRadioGroup.ItemText` in a `FieldLabel`, which is
wrong inside a card. So `Preferences.tsx` reaches past the library to Ark three times —
`ArkRadioGroup.ItemText` at `:367`, `:442`, `:499` — losing `data-slot` each time. Either add
`RadioGroupCardText`, or give `RadioGroupText` a variant. **IN-FLIGHT** (`Preferences.tsx`).

**5.4 `DataTableContent` has no `data-table-empty` slot. CONFIRMED.**
The empty state (`data-table-content.tsx:109-116`) inherits `data-slot="table-cell"`, so the one state a
consumer most wants to restyle is untargetable — while CONVENTIONS.md:91 says every targetable part
carries one.

**5.5 `aria-current` is missing from every nav. CONFIRMED.** See §6.4.

**Not gaps, checked and dismissed:** `Autocomplete` is `showTrigger={false}` on `Combobox` and it is
built (`combobox.tsx:84`, `:90`, `:107`; documented `forms/combobox.mdx:9-11`) — DESIGN.md:314-319 is
satisfied. Ark's unadopted `angle-slider`, `carousel`, `image-cropper`, `marquee`, `navigation-menu`,
`qr-code`, `signature-pad`, `swap`, `timer`, `frame`, `focus-trap`, `presence`, `format` have no
consumer asking for them anywhere in this repo.

---

## 6. Broken — components violating their own documented contract

### 6.1 `SidebarIdentity` promises `asChild` and delivers none. SEVERE. CONFIRMED.
`composites/SidebarIdentity.tsx:33` sells composition on the grounds that you can "use `asChild`". All
five exported parts render raw DOM and type props with the form CONVENTIONS.md:90 bans by name:
`:18` `extends ComponentProps<"div">`, `:58` `<div>`, `:78`+`:81`, `:105`+`:108`, `:121`+`:123`
`<span>`, `:132`+`:134`. So `asChild` does not work on any of them. This is the same defect
CONVENTIONS.md:90 records for `Toolbar` — *"which let `Toolbar` ship a doc comment promising `asChild`
support it did not have"* — reintroduced in the file that argues hardest for composition.
**Action.** Convert all five to `ark.div` / `ark.span` and `ComponentProps<typeof ark.div>`.

### 6.2 `ShellAside` carries a surface, in the layer that forbids surfaces. CONFIRMED.
`layouts/shell.tsx:116` — `shellAsideVariants` base is `"flex flex-col bg-card"`.
**Rule broken.** DESIGN.md:126-128: *"**The regions carry no aesthetic.** No height, no surface, no
typography, no font size. A region places its children and separates itself from its neighbour."* And
DESIGN.md:130-134 recounts rejecting `ShellBar` for keeping `bg-card`. `ShellHeader` (`:41`) and
`ShellFooter` (`:53`) obey the rule (border only); `ShellAside` does not.
**Action.** Drop `bg-card`; the caller paints the aside. **CONFIRMED.**

### 6.3 `ark.*` violations — ~24 elements. CONFIRMED.
CONVENTIONS.md:90: *"`ark.*` on every part that renders a DOM element — simples, composites **and**
layouts, with no exemption … Type props as `React.ComponentProps<typeof ark.div>`, never as
`ComponentProps<"div">`."*

Raw elements: `simples/table.tsx:63` (`table-wrapper` — the only `Table` part without `asChild`) ·
`table/data-table-content.tsx:62` (the component **root**) · `table/data-table-pagination.tsx:40`,
`:45`, `:47`, `:48` · `table/DataTable.tsx:50` · `table/sortableHeader.tsx:59-65` (a raw `<button>`,
neither `ark.button` nor `Button`) · `composites/SidebarNav.tsx:95` (root `<nav>`), `:46`, `:113`,
`:146`, `:159` · `composites/SidebarUser.tsx:105` · `composites/SidebarIdentity.tsx:58`, `:81`, `:108`,
`:123`, `:134` · `layouts/section.tsx:123-131` (`SectionTitle` renders a raw `h${level}` and types
`Omit<ComponentProps<"h2">, "ref">` at `:115`).

Banned prop type, 13 sites: `sidebar.tsx:45`, `:421` (both spread onto `ark.div` at `:133`/`:437`, so
the type *understates* the component) · `SidebarIdentity.tsx:18`, `:78`, `:105`, `:121`, `:132` ·
`Link.tsx:23` · `spinner.tsx:6` · `floating-panel.tsx:31`, `:113` · `command.tsx:226`, `:242`.

### 6.3b `data-slot` erased by a caller — a live CSS bug. SEVERE. CONFIRMED. → full detail in §9.1
Three chart wrappers pass a `data-slot` into a primitive that writes its own *before* `{...rest}`, so the
primitive's slot is overwritten and two `field.tsx` recipes stop matching. `chart-inputs.tsx:565` →
`field.tsx:66-67`; `chart-inputs.tsx:408` → `FacetFilter.tsx:174-177`; `chart-inputs.tsx:580` →
`combobox.tsx:36-40`. The fix that ends the whole class: put `data-slot` **after** `{...rest}` in every
primitive.

### 6.4 Composite roles and roving focus. CONFIRMED (no literal violation, two real weaknesses).
Grepped every `role=` in scope. **Nothing declares `toolbar`, `listbox`, `grid`, `tablist` or `tree`
without the machine behind it.** Notably `DataTableToolbar` (`data-table-toolbar.tsx:20-30`) is named
"Toolbar" and correctly declares **no** role — CONVENTIONS.md:89 is honoured by omission. The declared
roles are all document-structure or single-widget roles delegated to Ark:
`item.tsx:17` `list` / `:73` `listitem`, `breadcrumb.tsx:34` `list`, `button-group.tsx:55` /
`input-group.tsx:54`,`:118` `group`, `separator.tsx:30` / `floating-panel.tsx:147` `separator`,
`spinner.tsx:14` `status`, `checkbox.tsx:56` `checkbox`, `alert-dialog.tsx:17` `alertdialog`,
`action-bar.tsx:252` `toolbar` (Ark's ActionBar machine owns it).

Two genuine defects in the same neighbourhood:
- **`Item` claims `role="listitem"` unconditionally** (`item.tsx:73`) — including inside a menu, which
  the file itself anticipates (`:42` `in-data-[slot=menu-content]:p-0`). A `listitem` inside a
  `role="menu"` is invalid: a menu's required children are `menuitem*`. **CONFIRMED.** Make the role
  conditional, or drop it and let `ItemGroup`'s `role="list"` be opt-in.
- **`DataTableContent` makes every row a tab stop** (`data-table-content.tsx:99` `tabIndex={onRowClick ? 0 : undefined}`,
  handler `:89-98`) with **no role at all**. The ARIA contract *is* documented (`:37-42`) and *is*
  tested (`data-table-content.test.tsx:112`, `:121`, `:124`), so both CONVENTIONS.md:89 clauses pass —
  but AT announces a focusable `<tr>` with no interactive semantics, an N-row table adds N tab stops,
  and Space is ambiguous on a non-button. Structurally the same complaint the rule makes about a
  non-roving `toolbar`, reached from the other side. **CONFIRMED.**
- **No `aria-current` anywhere.** `SidebarNav.tsx:110`, `:157` pass `isActive` → `data-active` only
  (`sidebar.tsx:622`, `:833`). Active nav state is styling-only; a screen-reader user cannot tell which
  item is current. **CONFIRMED.**
- **`sortableHeader` has no `aria-sort`** (`sortableHeader.tsx:53-70`); direction is icon-only
  (`:34-39`), and its test asserts no ARIA. **CONFIRMED.**
- **`SidebarRail` is `tabIndex={-1}`** (`sidebar.tsx:339`) with an `aria-label` and `title` — a labelled
  control removed from the tab order, with no comment saying why and no test. **CONFIRMED.**

### 6.5 Tests — 71 of 122 in-scope files have no sibling test. CONFIRMED.
CONVENTIONS.md:117-119: *"The minimum bar for a component is a test that renders it and asserts the
behaviour its recipe depends on."*
Worst, because they are the most bespoke: **`composites/sidebar.tsx`** (850 lines; a global
`Cmd/Ctrl+B` listener `:30`,`:100-114`; `document.cookie` written inside a `useCallback` `:86-87`;
`Math.random()` in a `useMemo` `:743-746`, an SSR hydration-mismatch risk; a controlled/uncontrolled
merge `:75-90` where `setOpen` closes over `open` `:89` and `toggleSidebar` `:92-98` omits `openMobile`
from its deps) · **`simples/table.tsx`** (8 parts, two variant axes) ·
**`composites/SidebarIdentity.tsx`** · **`layouts/section.tsx`** (9 parts, 4 recipes; `shell.tsx` has a
test, `section.tsx` does not) · **`charts/mosaic-provider.tsx`**, `chart-legend.tsx`,
`chart-interactors.tsx`, `chart-axes.tsx`, `tokenized-plot.tsx`, `use-chart-query.ts` ·
**`table/data-table-root.tsx`** · **`composites/identity-notice.tsx`** (**IN-FLIGHT**) ·
plus 55 of the ~90 `simples/`.

### 6.6 A type bug in the sidebar. CONFIRMED.
`composites/sidebar.tsx:155` types `SidebarProps extends React.ComponentProps<typeof Sheet>` (Ark's
Dialog root), but two of three branches spread onto `ark.aside` (`:186`) / `ark.div` (`:269`). At
`:194-198` the mobile branch spreads **`{...props}` rather than `{...rest}`** onto `Sheet`, leaking
`collapsible`, `placement`, `variant`, `className` and `children` into an Ark Dialog root — while
`className` is simultaneously *dropped*, because `SheetContent` (`:200-206`) hard-codes its class list
and never merges it.

### 6.7 `StatTile` hard-codes a locale. CONFIRMED.
`simples/stat-tile.tsx:8` — `new Intl.NumberFormat("en-US", …)`, not overridable, inside a library that
lists locale/direction among its cross-cutting concerns (DESIGN.md:261). A French consumer gets US
grouping and no way out. Take a `format?: (n: number) => string`, or read the ambient locale.

### 6.8 `forwardRef`, forbidden, in three places. CONFIRMED.
`simples/TextField.tsx:28`, `:55`, `composites/link.tsx:16`, against CONVENTIONS.md:64-66 (*"Do **not**
use `forwardRef` — it still works, but it is redundant"*). All three files are Cut candidates anyway.

### 6.9 A NUL byte in the source. CONFIRMED.
`packages/ui/src/charts/chart-inputs.tsx:523` — `items.map(…).join("U+0000")`. The file is
`file(1)`-detected as `data`, so plain `grep` skips it entirely and reports nothing; `grep -a` is
required. Whatever the intent (a delimiter that cannot occur in a value is defensible), an invisible
control character in source silently exempts the library's largest chart file from every shell-based
search and any future grep-based lint. Write it as the two-character escape (backslash + `0`), or use
`\x1f`, or `JSON.stringify`. **Note:** this very report was originally written with the raw byte copied
through, and `file(1)` reported the report itself as `data` until it was replaced — which is the clearest
possible demonstration of the problem.

### 6.10 Themeable values outside `tv()` — pervasive, and the rule as written cannot be met. CONFIRMED.
CONVENTIONS.md:75 says themeable values (colour, radius, typography, **spacing scale**, borders,
shadows, animation) *"**must** live in a `tv()` recipe, including when it is conditional"*, and names
the ternary case: *"A ternary assembling `border-r border-border` in the function body is the same
violation as an inline `style`."*

Measured: **only ~24 of 122 in-scope files define a `tv()` at all**; `charts/`, `table/` (except
`sortableHeader.tsx:11-22`) and most of `composites/` have none. The clearest true violations, where a
**declared prop** is implemented as body ternaries instead of a variant key:
- `composites/sidebar.tsx:237-251` and `:252-270` — the `variant` prop (`:159`, `:166`) implemented as
  two ternaries picking widths, `p-2`, `border-s`/`border-e`, plus `transition-[width] duration-200`;
  `SidebarMenuButton:595-618` — 21 inline lines covering `size`, `variant` and `isActive`, all three
  already declared props (`:565-589`); `SidebarMenuAction:674-675` `!showOnHover && "…opacity…"`.
- `composites/SidebarIdentity.tsx:59-66`, `:82-86`, `:109-113` — `responsive`/`collapsed` are declared
  props (`:20`, `:22`) driving conditional themeable strings.
- `simples/table.tsx:69-89`, `:150-165` — `variant: "plain" | "striped"` (`:19`) and `isHoverable`
  (`:13`) as `data-*` plus descendant selectors, with 12 lines of ΔE measurement comment proving these
  are the most theme-sensitive strings in the file.
- `layouts/section.tsx:191-201` — `SectionFooter`'s `border-t border-border bg-card px-4 py-3` inline,
  in a file that has four recipes for its siblings.
- `composites/sidebar.tsx:142-148`, `:211-215` — `SIDEBAR_WIDTH = "16rem"`, `SIDEBAR_WIDTH_ICON = "3rem"`,
  `SIDEBAR_WIDTH_MOBILE = "18rem"` (`:27-29`) written into inline `style`. A rail width is a theme axis
  frozen in a JS constant no token override can reach — CONVENTIONS.md:78's *"a hard-coded constant is
  not"*. (`--skeleton-width` at `:764-768` is genuinely computed, so it is sanctioned.)

**But the rule as written is unmeetable**, and that is itself a defect. Under the letter of
CONVENTIONS.md:75, `SectionDescription`'s `"mt-0.5 text-muted-foreground text-sm"`
(`section.tsx:139`) is a violation, and so is nearly every `cn()` in the library — while
CONVENTIONS.md:76 says *"a `tv()` with a base and no variants is a string with extra steps."* The two
clauses contradict each other. Pick one and say it: **a recipe is owed wherever a *variant axis*
exists** (a prop, a `data-*` the component sets, a ternary); a single unconditional token-backed
utility string may sit inline, because a token override still re-skins it. That version is meetable and
still catches every case above.

### 6.11 Hard-coded English, no i18n seam. CONFIRMED.
`data-table-content.tsx:46` `"No results."` · `data-table-toolbar.tsx:40` `"Search…"`, `:127`/`:137`
`"View"`, `:151` `heading="Toggle columns"` · `data-table-pagination.tsx:41` `"row(s) selected."`,
`:48`/`:50` `"Rows per page"` · `select-column.tsx:24`, `:26` · `sidebar.tsx:217-221`
(`title="Sidebar"`, `description="Displays the mobile sidebar."`), `:307` + `:319` (two untranslatable
strings for one control) · `SidebarNav.tsx:95` (`"Sidebar"` landmark fallback) · `FacetFilter.tsx:85-88`,
`:264` `"Clear filter"` · `MadeWith.tsx:33`,`:35`.
The library already has the right pattern for this — `AppearanceToggle`'s `formatName` and
`identity-notice.tsx:18-30`'s `formatDescription`, whose comment (`:12-16`) states the principle
exactly. It is applied in two places out of a dozen.

---

## 7. Surplus — deletion candidates, decided

Beyond the Cut queue in §2b:

| Item | Evidence | Verdict |
|---|---|---|
| 5 dead `analytics.ts` re-exports | `analytics.ts:142`, `:167` — zero references anywhere | **Delete** |
| ~52 chart marks/interactors with no renderer | e.g. `ChartVoronoiMesh`, `ChartDelaunayLink`, `ChartGraticule`, `ChartRasterTile`, `ChartDenseLine` — mentioned only in `data-display/chart-gallery.mdx` | **Keep** — they are one-line `plot.*` descriptors over a vgplot grammar, so the marginal cost is a line each and the gallery *is* the contract. This is the one place a catalogue is cheaper than a curation |
| 9 Ark `*Positioner` / `*Context` renames with no consumer | `ComboboxPositioner`, `MenuPositioner`, `PopoverPositioner`, `SheetPositioner`, `TourPositioner`, `SelectContext`, `ListboxContext`, `CalendarContext`, `ComboboxContext` | **Delete the exports.** A positioner our own root already renders is not API; a `*Context` alias nobody imports is DESIGN.md:234's "`data-slot` rename" in another costume |
| 38 of 58 `useX` context aliases with no consumer | `useAvatar`, `useCheckbox`, `useDialog`, `useMenu`, `usePopover`, `useSelect`, `useSwitch`, `useToggle`, `useTooltip`, `useTreeView`, … | **Delete the unused ones.** They are one-line `export const useX = useXContext` re-exports of a symbol the consumer can import from Ark. Keep the ones with a consumer (`useSidebar`, `useKanzoTheme`, `useChart`, `useMosaic`, `useColorPicker`, `useDataTableContext`) |
| `FieldSeparator`, `useField` | `field.tsx` — still the two Field parts with no consumer, exactly as DESIGN.md:229 says | **Delete.** The one live claim in that paragraph |
| `sectionVariants` (`section.tsx:27`), `swatchVariants` (`swatch.tsx:24`) | The 2 of 10 `*Variants` still exported with no cross-module consumer; `index.test.ts:113-129` already un-exports thirteen others | **Un-export both** (keep the symbols) |
| `ProgressTrack`, `ProgressRange`, `CheckboxIndicator`, the 11 `Calendar Table*` parts, `RatingHiddenInput`, `TagsInputClearTrigger`, `SegmentGroupIndicator` | Zero *export* consumers because their own root renders them | **Un-export, do not delete the symbol.** `data-display/progress.mdx` documents that you never place `ProgressTrack` yourself — DESIGN.md:239 is right that this is the ideal case, not a defect. There is no compatibility question: nothing imports them |
| `PlotColors`, `isColorValue`, 7 `analytics.ts` internals | §9.2, §9.10 | **Delete / un-export** |
| `~140` extensionless relative imports | `simples/*` use `"./badge"`, the barrel and `composites/`/`table/`/`charts/` use `"./badge.js"` — two dialects, e.g. `FacetFilter.tsx:8` `"../lib/cn"` vs `data-table-toolbar.tsx:7` `"../lib/cn.js"` | **Normalise to `.js`.** Not a bug under the current bundler, but it means a grep for an import path silently misses half the library |

---

## 8. Admission-rule violations (DESIGN.md:209-215)

| Component | 1 domain-free | 2 ≥2 real call sites | 3 wraps, doesn't reinvent | 4 single axis | Verdict |
|---|---|---|---|---|---|
| `composites/MadeWith.tsx` | **FAIL** — defaults `by = "Kanzo"` (`:20`), a brand in the library | fail (2 showcases only) | n/a | pass | Cut #7 |
| `composites/Breadcrumbs.tsx` | pass | fail — 2 showcases + its own example dir | **FAIL** — reinvents Shark's hand-composed collapse | **FAIL** — content (labels) + structure (collapse policy) | Cut #3 |
| `composites/SidebarUser.tsx` / `InstanceSwitcher.tsx` | pass | fail — showcases only | **FAIL** — reinvent each other | pass | Cut #1, #2 |
| `composites/SidebarNav.tsx` | pass | fail — showcases only | pass (composes sidebar parts) | **FAIL** — content + routing policy | Cut #4 |
| `simples/EmptyState.tsx` | pass | fail | **FAIL** — `Item` is this | pass | Cut #5 |
| `simples/Ribbon.tsx` | pass | fail — 1 example + 1 showcase | **FAIL** — 4 lines of `Float` + `Badge` | pass | Cut #6 |
| `simples/TextField.tsx` (`NumberField`) | pass | pass | **FAIL** — `NumberInput` is the machine | pass | Cut #8 |
| `table/DataTable.tsx` | pass | pass | **FAIL** — the compound is this | **FAIL** — layout + engine config | Cut #10 |
| `simples/DateField.tsx` | pass | pass | borderline — Ark's `date-input` unadopted | pass | Cut #11 |
| `theme/prefs-config.ts` | pass | fail | n/a | n/a | Cut #9 |
| `simples/FacetFilter.tsx` | pass | **pass** — both shipped the day it was written | pass (Ark Listbox) | pass | **Keep** — the model addition |
| `simples/FieldArray.tsx` | pass | pass | pass (nothing to wrap) | pass | **Keep** |
| `composites/sidebar.tsx` | pass | pass | pass — Ark ships no sidebar | **borderline** — structure + appearance in one file (§6.10) | **Keep**, fix the recipes and add a test |

---

## 9. Charts — the layer's own findings

### 9.1 SEVERE, and a live bug: three `data-slot` collisions erase a primitive's slot. CONFIRMED.

`Field`, `FacetFilter` and `Combobox` all write their `data-slot` **before** `{...rest}`, so a
caller-supplied one overwrites it. `chart-inputs.tsx` supplies one in all three cases:

- `chart-inputs.tsx:565` passes `data-slot="chart-search"` to `Field`, erasing `data-slot="field"`
  (`simples/field.tsx:66-67`). **Two recipes depend on that exact slot** — `field.tsx:164`
  (`has-[>[data-slot=field]]:…`) and `field.tsx:226` (`in-[[data-slot=field]:has(…)]:…`) — so
  `ChartSearch`'s own `FieldLabel` (`chart-inputs.tsx:570`) is styled against a selector that no longer
  matches. This is not a naming nit; it is broken CSS.
- `chart-inputs.tsx:408` passes `data-slot="chart-filter-trigger"` to `FacetFilter`, erasing
  `data-slot="facet-filter"` (`FacetFilter.tsx:174-177`).
- `chart-inputs.tsx:580` passes `data-slot="chart-search-list"` to `Combobox`, erasing
  `data-slot="combobox"` (`combobox.tsx:36-40`) — and it names the *root*, not the list.

**Rule broken.** CONVENTIONS.md:91: *"It is not decoration: our own recipes depend on it
(`in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3`)."* The doc anticipated the
mechanism and the library still lost a slot to it three times.
**Action.** Put `data-slot` **after** `{...rest}` in every primitive (a one-line reorder that makes the
slot un-overwritable), or stop passing one from the chart wrappers. The first is better: it turns a
class of bug into an impossibility.

Related, same file: `ChartSearchProps` declares its root as `React.ComponentProps<typeof ark.div>`
(`chart-inputs.tsx:432`) while the element rendered is an `ArkField.Root` (`:563`) — the declared
surface and the real element disagree.

### 9.2 `TokenizedPlot` does dead work on every rebuild. CONFIRMED.
`tokenized-plot.tsx:95-98` resolves `--primary` and `--muted-foreground` (two DOM probes) and hands them
to `render(colors, …)`; its only caller discards them — `chart-root.tsx:253`
`render={(_colors, width, plotHost) => …}`. `PlotColors` (`tokenized-plot.tsx:11-16`) has no consumer
outside its own file, and `TokenizedPlot` is not exported from `analytics.ts` at all.
**Action.** Delete `PlotColors`, the `colors` argument and the two probes. Three token-resolution paths
currently coexist (`chart-root.tsx:195-200` uncached, `chart-root.tsx:260-267` cached, this one unused);
that becomes two, and only the cached one survives in the hot path.
Its doc comment is also stale: `tokenized-plot.tsx:37-38` names `Histogram` and `BarChart` as its
consumers; both were deleted (`analytics.ts:187-189`).

### 9.3 `MosaicInputClient` and `ChartQueryClient` are the same class. CONFIRMED.
`chart-inputs.tsx:58-80` and `use-chart-query.ts:35-57` are the same 23-line `MosaicClient` subclass —
same two private fields, same `super(filterBy)`, same `query()` returning `this.#build(filter ?? [])`,
same `queryResult()` doing `Array.from(…)`. Only the row alias differs (`QueryRow`
`chart-inputs.tsx:55` vs `ChartQueryRow` `use-chart-query.ts:17`). Likewise `useMosaicInput`
(`chart-inputs.tsx:129-144`) reimplements `useChartQuery`'s connect/disconnect effect
(`use-chart-query.ts:69-75`), including the identical `latest`-ref trick (`:122-123` vs `:65-66`) and
`setRows(null)` reset. `useMosaicInput` **is** `useChartQuery` + publish/activate/decode.
**Action.** `useMosaicInput` composes `useChartQuery`; delete `MosaicInputClient`. Removes ~40 lines and
one of the two places a Mosaic lifecycle bug can hide.

Smaller repetitions in the same vein: the default-resolution idiom
`filterBy === undefined ? crossfilter : filterBy` appears five times (`chart-root.tsx:177`,
`chart-inputs.tsx:348`, `:486`, `:693`, `use-chart-query.ts:62`) with `as === undefined ? …` three more
(`chart-inputs.tsx:347`, `:485`, `:692`) — one `resolveSelections(as, filterBy)` helper.

### 9.4 `ChartColorLegend` invents a directive kind the mark factory already has. CONFIRMED.
`chart-legend.tsx:82-85` emits a bespoke `kind: "legend"` directive (`chart-spec.ts:40-44`), dispatched
at `chart-root.tsx:46` as `directives[\`${directive.channel}Legend\`](options)` — which is exactly the
`source === null` decorator path already implemented at `chart-marks.tsx:114-116` + `chart-root.tsx:34`
and used by `chart-marks.tsx:182-187`. `ChartColorLegend` is expressible as
`mark("ChartColorLegend", "colorLegend", true)`.
**Action.** Delete the `legend` directive kind, its `switch` arm and its type; three fewer moving parts.
Also `chart-legend.tsx:20-22` assigns `categoricalColor(i)` per index, which `chart-config.ts:73`
re-derives as its fallback — drop the first.
(`ChartLegend` (our DOM) vs `ChartColorLegend` (vgplot's) as two legends is *declared* at
`chart-legend.tsx:77-81` and `analytics.ts:83`; recorded as sanctioned, not a defect.)

### 9.5 `ChartStat`'s deps are identity-unstable, and the docs' own example trips it. CONFIRMED.
`chart-stat.tsx:36` — `deps: [relation, value]` where `value` is an `ExprValue` **object**, and
`docs/examples/charts/example-stat.tsx:47-48` passes it inline (`value={count()}`). Any parent re-render
mints a new expression, so `use-chart-query.ts:69-75` disconnects the client, reconnects it and re-runs
the query. `ChartRoot` solves precisely this with a spec fingerprint (`chart-root.tsx:212-216`, reasoned
at `:209-211`); `ChartStat` and `useChartQuery` do not. Untested.
Also `chart-stat.tsx:43` — `<Skeleton className="h-24 w-full" />` hard-codes a *guess* at `StatTile`'s
rendered height: a second source of truth for the tile's box.

### 9.6 `simples/stat-tile.tsx` is the worst single file in scope for the appearance rules. CONFIRMED.
Not one `ark.*` (no factory import; raw `<svg>` `:51`, `<path>` `:54`, `<circle>` `:63`, `<div>` `:80`,
`<span>` `:84`, `<div>` `:85`, `<span>` `:86`, `:92`, `:102`). `StatTileProps` (`:28-38`) extends
nothing — `className?: string` and no `ref`, no spread, no `asChild`. `data-slot` on the root only
(`:82`); missing on the value (`:86`), the single most likely styling target. No `tv()`. And
`stat-tile.tsx:93-96` is **the exact violation CONVENTIONS.md:75 names by example** — a ternary
assembling colour classes in the body: `good ? "text-success" : "text-destructive dark:text-destructive-foreground"`.
Plus hard-coded geometry a class cannot override (`:41-42` `w = 72`, `h = 22`; `:61` `strokeWidth={1.5}`;
`:63` `r={2.5}`) against CONVENTIONS.md:78, and the locale bug in §6.7. Its test
(`stat-tile.test.tsx`, 4 cases) never renders `trend`, so `Sparkline` (`:40-66`) is untested.
**Action.** This is a *keep* — it is the presentational half of the engine rule and `ChartStat` renders
it correctly (`chart-stat.tsx:47`, no reimplemented markup, DESIGN.md:83-85 satisfied) — but it needs a
`statTileVariants` recipe, `ark.*` parts, per-part `data-slot`, a `format` prop and a `trend` test.

### 9.7 The plot surface has no accessibility contract at all. CONFIRMED.
`tokenized-plot.tsx:105` is a bare `<div>` — no `role`, no `aria-label`, no `aria-describedby`, no
`tabIndex`, no text alternative — into which an SVG is imperatively mounted (`:99`). With interactors
attached that surface **is** interactive: `ChartIntervalX/Y/XY` drag-brush
(`chart-interactors.tsx:27-29`), `ChartToggleX/Y/Color` click-select (`:30-32`), `ChartRegion` (`:35`),
`ChartPanZoom` (`:94-98`). There is no keyboard path to any of them, and `charts.mdx` has no
accessibility section (grep for `aria|role=|accessib|keyboard` yields only `:552`, about the legend
swatch). `ChartColorLegend` is documented as *interactive* (`chart-legend.tsx:78-81`) while its DOM is
vgplot's raw HTML that we neither own, document, nor assert.
**Rule broken.** CONVENTIONS.md:89: *"Where Ark has none, the bespoke part must document its ARIA
contract in a comment and be covered by a test."*
**Action.** This is the largest a11y gap in the library. It cannot be fixed by a role — a brushable plot
needs a keyboard story. The minimum honest move is to *document the deferral* in `charts.mdx` and give
`ChartRoot` a required `aria-label` plus an optional `summary` slot (a table or a sentence) so a chart is
never the only carrier of its data.
Also `warmUpHandlers` (`chart-inputs.tsx:181-195`) attaches focus- and pointer-triggered side effects to
all three inputs (`:404`, `:568`, `:776`) with no ARIA note and no test — `chart-inputs.test.tsx` never
mentions `activate`, `pointerEnter` or a focus-triggered publish.

### 9.8 Zero `tv()` in the whole directory; the axis colour of every chart is an inline class. CONFIRMED.
No file under `charts/` imports `tailwind-variants`. The worst consequence:
`tokenized-plot.tsx:105`'s `"w-full text-foreground"`, where `text-foreground` is load-bearing — its own
comment (`:40-43`) explains that Plot draws every tick with `currentColor`. So the axis colour of every
chart in the system is a hard-coded class in a function body. Other inline offenders:
`chart-inputs.tsx:603` (`"border-t px-2 py-1.5 text-muted-foreground text-xs"` — four themeable axes at
once, and no `data-slot`, and a raw `<p>`), `chart-legend.tsx:41`, `:48`, `chart-inputs.tsx:795`
(`rounded-full`), `chart-stat.tsx:43`.
Raw DOM instead of `ark.*` in charts/: `tokenized-plot.tsx:105` (the plot host — the most-targeted node
in the layer), `chart-inputs.tsx:603`, `:788`, `chart-legend.tsx:47`.
`data-slot` naming violation: `tokenized-plot.tsx:105` uses `data-slot="chart"`, but there is no `Chart`
component — the root is `ChartRoot` with `data-slot="chart-root"` (`chart-root.tsx:230`). The wrong name
is already frozen in `chart-root.test.tsx:35`.

### 9.9 Colour literals: charts/ is clean, but the guard has four holes. CONFIRMED.
`charts/` and `stat-tile.tsx` contain no hex, no `oklch(` literal and no raw palette utility; colour
comes from tokens throughout (`theme.ts:158` `var(--chart-${i+1})`, `:155`, `:48`;
`tokenized-plot.tsx:96-97`). `charts/` **is** in `no-literal-hues.test.ts`'s scope (`:22` + the recursive
walk at `:35-41`, and nothing in charts/ is in `ALLOWED` at `:25`). What the guard cannot see:
1. **Test files are skipped** (`:39`), and charts' fixtures do carry chromatic literals —
   `chart-root.test.tsx:20` `#123456`, `:46` `rgb(18, 52, 86)`; `chart-marks.test.tsx:108` `#ff0000`;
   `theme.test.ts:35` `rgb(37, 99, 235)`, which is Tailwind blue-600 — the very hue the rule's own
   self-check uses at `no-literal-hues.test.ts:81`. Benign as fixtures; invisible to the rule.
2. **Named CSS colours in a string are invisible to all three regexes.** `chart-config.ts:36-38` embeds
   all 148 CSS named colours as one literal — legitimate (a parser table, justified at `:31-35`), but a
   palette written that way would pass.
3. **The regex set is incomplete**: `HEX`/`RGB`/`OKLCH` only (`:27-29`). `hsl(…)`, `lab(…)`, `lch(…)`
   and `color(srgb …)` would sail through — and `color(srgb …)` is a form **this very layer parses** at
   `theme.ts:20-27` and asserts at `theme.test.ts:39`, `:45`, `:46`.
4. **Tailwind palette class names are not checked at all** — `bg-slate-700`, CONVENTIONS.md:79's own
   example, matches none of the three regexes. Nothing violates it today; nothing would catch it.
Scope is also `packages/ui/src` only; I grepped `docs/examples/charts/` anyway — clean.

### 9.10 Charts surplus, decided.
- **Delete:** the five dead `@uwdata` re-exports (§7). Also worth noting from the same scan: the
  re-exports that *are* used are mostly used **around** the barrel, not through it — `loadCSV` is
  imported straight from `@uwdata/mosaic-sql` at `docs/showcases/workspace/analysis-charts.tsx:5` and
  `graph-state.tsx:13`; `clausePoints` straight from `@uwdata/mosaic-core` at
  `docs/showcases/workspace/graph-view.tsx:4`. Only `loadObjects` goes through us
  (`docs/examples/charts/mosaic-boot.tsx:4`). So the stated rationale at `analytics.ts:126-136` — that
  re-exporting removes a direct `@uwdata` import — is **not** borne out by the consumers. Either fix the
  showcases to import through the barrel, or drop the re-export list.
- **Delete `PlotColors`** and the `colors` render argument (§9.2).
- **Un-export `isColorValue`** (`analytics.ts:24`) — no consumer, while its sibling `isColorToken` is
  correctly internal. An inconsistent seam.
- **Un-export the seven internals** exported through `analytics.ts` with no consumer outside `charts/`:
  `buildChartSpec`, `compileChartSpec`, `chartSpecSignature`, `chartDescriptor` (`analytics.ts:101`),
  `chartSeriesEntries` (`:24`), `CHART_CAPACITY_PROPERTY` (`:114`), `useChartOptional` (`:20`).
- **Keep the 43 mark/interactor wrappers with no call site** (`ChartArea`, `ChartVoronoiMesh`,
  `ChartGraticule`, … — defined `chart-marks.tsx:118-187`, `chart-interactors.tsx:27-81`, re-exported
  `analytics.ts:27-58`). They are one-line `vg.*` descriptors, the vocabulary test at
  `chart-marks.tsx:42-53` proves every one names a real directive, and `analytics.ts:148-150` argues the
  completeness case explicitly. This is a **declared** trade, not an oversight, and it is the one place
  in the library where a catalogue is cheaper than a curation: a mark you have to add yourself is a mark
  you add wrong. **Keep — but say so in DESIGN.md**, because as it stands it is the largest block of
  admission-rule-2 failures in the repo and nothing normative excuses it.

### 9.11 Charts files with no sibling test: 7 of 14. CONFIRMED.
`tokenized-plot.tsx` (**no coverage at all** — `chart-root.test.tsx:11-15` states that under jsdom width
stays 0 and "the plot is never built here", so the `ResizeObserver` debounce `:70-89`, the theme-tick
re-resolve `:92-103` and the `replaceChildren()` cleanup `:100` are untested, and the file's comments
describe three separately-debugged failures none of which is pinned) · `mosaic-provider.tsx` (its
`_relay` private-API dependence `:85-90` has no test that would fail loudly on a mosaic-core upgrade) ·
`chart-legend.tsx` (icon branch `:46-49` untested) · `chart-axes.tsx` · `chart-interactors.tsx`
(`ChartPick*`/`ChartBrush*` aliases `:76-81` untested) · `chart-config.ts` (`colorTokenName` `:61-66`,
`chartColorScale` `:90-94` untested) · `use-chart-query.ts` (the reconnect in §9.5 untested).

---

## 10. "Spec is stale here" — where the docs describe a tree that no longer exists

| Doc line | What it says | What the code says |
|---|---|---|
| DESIGN.md:164-175 | `AppShell`, `WorkspaceLayout`, `TwoPaneLayout`, `SidePanel`, `Toolbar`, `StatusBar`, `TopBarUtility`, `TopBar`, `PageShell`, `SectionHeader`, `TopBarMain` "become" showcases / deleted / merged | **All done.** Zero hits in `packages/ui/src`. Rewrite in the past tense or delete the table |
| DESIGN.md:176-188 ("The header rule") | "Three vocabularies describe one row **today**" | One vocabulary, `layouts/section.tsx`, since the merge documented at `section.tsx:12-21` |
| DESIGN.md:264-273 (`CardRadioGroup`) | Argues both sides of whether to unwind it | It was unwound. `index.test.ts:98` keeps it deleted; `radio-group.tsx:26` holds the `columns` prop that replaced it |
| DESIGN.md:332-334 | `DataTableFacetFilter` and the chart filter "were built as menus anyway" | Both are `FacetFilter` → `Listbox`. `data-table-toolbar.tsx:112`, `chart-inputs.tsx:406`, pinned by `index.test.ts:37-50` |
| DESIGN.md:231-240 | "733 exported values, 139 referenced nowhere, **122** in exactly one `docs/examples/` dir, 42 of 56 `useX`, **14 of 21** `*Variants`, 29 `data-slot` renames" | Re-derived: **881** exports, **293** with no consumer, **108** single-example-only, **38 of 58** `useX`, **2 of 10** `*Variants` (thirteen were un-exported and `index.test.ts:106-133` now guards it). Also DESIGN.md:238's hedge — *"Deleting those exports is a compatibility question"* — is void: the packages are unpublished |
| DESIGN.md:24, :349; `layouts/shell.tsx:12` | Showcases live in `docs/blocks/` | The directory does not exist. They live in `docs/showcases/` |
| DESIGN.md:60; CONVENTIONS.md:15 | `composites/` holds "SidebarUser, **StatCard**, CodeEditor" | No `StatCard` anywhere. `StatTile` is a *simple*, and `MetricCard` was deleted (`index.test.ts:63`) |
| CONVENTIONS.md:86 | "The only bespoke code is the CodeMirror editors (`CodeEditor`/**`GhostEditor`**)" | `GhostEditor` does not exist (`editor.ts:13` exports `CodeEditor` only). And the claim is false regardless: `composites/sidebar.tsx` is 850 lines of bespoke behaviour |
| CONVENTIONS.md:103-104 | "A component may only export dot-notation if it also exports the flat names; **no component does today**" | `Preferences` does, at `Preferences.tsx:515-540`. **IN-FLIGHT** |
| CONVENTIONS.md:75 vs :76 | ":75 themeable *must* live in a `tv()`" vs ":76 a variant-less `tv()` is ceremony" | Mutually unsatisfiable; ~98 of 122 files have no `tv()` at all. Restate as "a recipe is owed wherever a variant axis exists" (§6.10) |
| DESIGN.md:126-128 | "The regions carry no aesthetic. No height, no surface…" | `shell.tsx:116` `ShellAside` base is `"flex flex-col bg-card"` |
| DESIGN.md:219-229 | "Do not add a model before the existing parts have a consumer" + the `Field` measurement | The *rule* is sound and the `FieldSeparator`/`useField` claim (`:229`) still checks out. The paragraph is 11 lines of history; move it to a changelog and leave the one-line rule |
| `SidebarIdentity.tsx:31-36` | The array-prop rule, in a doc comment on an unrelated composite | Belongs in `CONVENTIONS.md`. Draft in §3.3 |
| DESIGN.md:275-284 | AI-assist "composes *over* the pure inputs", explicitly not a `complete` prop | True for `Input`/`Textarea`, but `editor.ts:11-12` records that `CodeEditor` takes `complete` as a **prop**. Defensible (a composite, on a subpath, already importing an engine) but undocumented as an exception |
| `charts/tokenized-plot.tsx:8-16`, `:37-38` | "The shared frame under `Histogram` and `BarChart`" · "the two tokenised colours a crossfilter chart paints with" | Both components were deleted (`analytics.ts:187-189`); the two colours are computed and discarded (§9.2) |
| `charts/tokenized-plot.tsx:105` | `data-slot="chart"` | There is no `Chart` component; the root is `ChartRoot` / `data-slot="chart-root"` (`chart-root.tsx:230`). The wrong name is already frozen by `chart-root.test.tsx:35` |
| `analytics.ts:126-136` | The re-export list exists so consumers need no direct `@uwdata` import | The showcases import `loadCSV` and `clausePoints` **directly** from `@uwdata/*` anyway (`docs/showcases/workspace/analysis-charts.tsx:5`, `graph-state.tsx:13`, `graph-view.tsx:4`); only `loadObjects` goes through the barrel |
| `analytics.ts:148-150` | Argues that marks with no example stay for completeness | Correct, and the only place it is argued. It is the largest block of admission-rule-2 failures in the repo (43 exports) and nothing normative excuses it — put the argument in `DESIGN.md` |
| `no-literal-hues.test.ts:27-29` | "No hue is written by hand" | The guard checks `#hex`, `rgb()` and `oklch()` only. `hsl()`, `lab()`, `lch()` and `color(srgb …)` pass — and `color(srgb …)` is a form `theme.ts:20-27` parses and `theme.test.ts:39` asserts. Tailwind palette classes (`bg-slate-700`, CONVENTIONS.md:79's own example) are not checked at all |
| CONVENTIONS.md:89 | Bespoke parts must document their ARIA contract and be tested | The plot surface (`tokenized-plot.tsx:105`) has no role, label, keyboard path or test, while carrying brush/toggle/pan interactors; `charts.mdx` has no accessibility section (§9.7) |
