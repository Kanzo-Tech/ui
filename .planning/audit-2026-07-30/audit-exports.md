# Kanzo UI — public surface & contract conformance audit

Scope: `packages/ui` export surface, barrel coherence, optional-peer isolation, client boundary,
per-rule conformance, guard-rail tests. Read-only. Method: TypeScript 5.9 compiler API
(`getExportsOfModule` from the four real entry files + symbol-resolved reference walk over
`packages/ui/src`), plus a whole-repo textual reference scan over 826 files with
`node_modules`, `.next`, `dist` and **`.claude/worktrees/`** excluded. That last exclusion matters:
the repo contains two full working copies at `.claude/worktrees/graph-bench` and
`.claude/worktrees/guild-example`, and any census that walks the repo without excluding them reports
**zero** dead exports, because every symbol appears to have three "consumers".

`git status --short` now lists **54** dirty paths, not the 27 in my brief. IN-FLIGHT tags below
reflect the current list.

---

## Executive summary (10 lines)

1. Every number in DESIGN.md:231-240 is now wrong. The real figures are in §1; the biggest error is `14 of 21 *Variants`, which a completed sweep already reduced to **1 of 9**.
2. Of **683** exported values declared in `packages/`, **164 (24%)** have no consumer anywhere outside the barrel, and a further **102** appear in exactly one `docs/examples/<slug>/`.
3. **Delete 119 exports outright and un-export 45 more** (§2). That is 164 barrel entries, ~24% of the value surface, with no consumer to break.
4. **Optional-peer isolation from the root entry HOLDS** — traced statically, 99 reachable modules, zero `@codemirror/*`, `@tanstack/*`, `@uwdata/*`, `@duckdb/*`. This is the one contract the library keeps cleanly.
5. But the placement test fails: `charts/theme.ts` imports **no engine** and its `resolveTokenColor` / `useThemeTick` already have two non-chart consumers who must install DuckDB/Mosaic to reach them (§4).
6. **Two runtime breaks in the client boundary** (§5): `SidebarNav.tsx` calls `useSidebar()` with no `"use client"`, and `chart-config.ts` *calls* a function imported from a `"use client"` module — that throws in a Server Component.
7. **59 files carry `"use client"` and need none** — the repo's own CI comment (`.github/workflows/ci.yml`) states why they are redundant.
8. `pnpm smoke` guards two symbols (`EditorShell`, `GhostEditor`) that no longer exist, and **never checks `"use client"` preservation** despite its own header claiming that is its first job (§7).
9. Conformance: 25 exported components root on a raw intrinsic element instead of `ark.*`; 14 use `ComponentProps<"div">`; 3 use `forwardRef`; 19 filenames are not kebab-case; 12 focus rings diverge from the mandated solid `ring-[3px] ring-ring`; three trough fills use three different tokens and none of them is `bg-field`.
10. 44 modules contributing public exports have **zero** test reference of any kind.

---

## 1. The export census, re-derived

### 1a. What the surface actually is

| Entry | Total exports | Values | Types |
|---|---:|---:|---:|
| `packages/ui/src/index.tsx` (root barrel) | **656** | 559 | 97 |
| `packages/ui/src/analytics.ts` | 192 | 147 | 45 |
| `packages/ui/src/table.ts` | 28 | 13 | 15 |
| `packages/ui/src/editor.ts` | 4 | 3 | 1 |
| **Union of all four (distinct names)** | **879** | **722** | **157** |
| — of which declared in `packages/` (ours) | 832 | **683** | 149 |
| — of which re-exported straight from `node_modules` | 47 | 39 | 8 |

Source: `exp-census-ts.mjs` → `exp-census.json`. The 47 foreign re-exports are the deliberate
`@uwdata/*` / `@ark-ui/react/collection` pass-throughs argued at `analytics.ts:151-160` and
`index.tsx:73-82`.

### 1b. DESIGN.md:231-240 vs measurement

| DESIGN.md claim (line) | Doc value | Measured | Verdict |
|---|---|---|---|
| "of 733 exported values" (231) | 733 | **722** union / **683** ours / **559** on the root barrel | **WRONG** — no scope produces 733 |
| "139 are referenced nowhere in the repo" (231-232) | 139 | **164** values with no consumer outside the barrel; **119** with no reference in `src` at all; **32** with no reference, no test, no docs prose | **WRONG (understated)** |
| "122 appear in exactly one `docs/examples/<slug>/`" (232-233) | 122 | **102** | **WRONG (overstated)** |
| "42 of 56 exported `useX` context aliases" (234) | 42 of 56 | **33 of 56** (54 ours + `useFilter` + `useListCollection`) | **WRONG** — but the *denominator* 56 reconciles exactly, confirming the doc's method |
| "14 of 21 `*Variants` objects" (234) | 14 of 21 | **1 of 9** public (`swatchVariants`); 10 exported at module level; 47 `tv()` recipes exist | **BADLY STALE** — `index.test.ts:112-131` already guards 13 as removed |
| "pure `data-slot` renames … 29 of them, floor not ceiling" (234-236) | 29 | **38** thin wrappers; **13** are strictly data-slot-only | **floor confirmed, understated** |
| "69 exports have no *export* consumer because their own root renders them" (236-238) | 69 | **45** | **WRONG (overstated)** |
| "`ProgressTrack` is the ideal case, not a defect" (239-240) | — | **Contradicted** — see §2c | **WRONG** |
| "deleting those exports is a compatibility question" (238-239) | — | void by owner's instruction | **delete** |

**Confidence: CONFIRMED** for every measured figure. All are reproducible from
`exp-census.json` + `exp-usage2.json` + `exp-internal.json` in this scratchpad.

### 1c. Reconciliation with the taxonomy agent

The taxonomy agent reported 881 / 293 / 108 / 38-of-58 / 2-of-10. Where we differ:

| Metric | Mine | Theirs | Explanation | Which to trust |
|---|---:|---:|---|---|
| Total exports | 879 | 881 | Within noise (2). Mine is `checker.getExportsOfModule()` on the four entry source files, so it is exactly what a consumer sees. | **Mine**, marginally; the delta is immaterial |
| Unreferenced | 164 (values) | 293 | **They almost certainly counted values + types.** My values-with-no-consumer (164) + my types-with-no-reference (103) = **267**; add the 26 values whose only mention is docs prose being counted as unreferenced and you land at 293. | **Both** — report as "164 values / 103 types" |
| Single-example | 102 | 108 | Same cause: types have no "example" but a `*Props` named in an example counts. Mine is values-only. | **Mine** for the deletion decision |
| `useX` | 33 of 54 (ours) / 33 of 56 (incl. Ark re-exports) | 38 of 58 | Their 58 likely adds the two Ark re-exports **and** two internal non-public hooks (`useIsMobile` at `simples/use-is-mobile.tsx:5`, `useMosaicInput`). My 56 denominator **exactly reproduces DESIGN.md's own 56**, which is strong evidence the doc used the public-entry scope. | **Mine**, because it reconciles with the doc's denominator |
| `*Variants` | 1 of 9 public | 2 of 10 | Both correct at different scopes. `sectionVariants` (`layouts/section.tsx:27`) is exported at *module* level but is **not** in the barrel — `index.tsx:199-215` lists section exports explicitly and omits it. So: 10 module-level, 9 public, 1 public-unused (`swatchVariants`), 2 unused if you count `sectionVariants`. | **Both** — state the scope |

**Also note `linkRecipe` (`simples/Link.tsx:11`)**: a `tv()` recipe exported at module level, *not* in
the barrel, yet `docs/content/docs/navigation/link.mdx:36` tells readers "`linkRecipe` is exported for
applying the same treatment to a router link component." **The docs promise an export that does not
exist on the public surface.** CONFIRMED. Fix: either add it to `index.tsx` or correct the mdx.

### 1d. Corroborations requested

- **`simples/CardRadioGroup.tsx` does not exist** — CONFIRMED. Not in the file tree; `index.tsx:175-178` documents its removal; `index.test.ts:98` (`expect(surface.CardRadioGroup).toBeUndefined()`) keeps it deleted. DESIGN.md:264-273 argues both sides of a settled decision and should be cut to a one-line history note.
- **NUL byte at `charts/chart-inputs.tsx:523`** — CONFIRMED (byte offset 19149, line 523 of 805). **My census is unaffected**: `fs.readFileSync(…, "utf8")` and the TS parser both handle it, and the census captured all 10 exports from that file (`ChartFilter`, `ChartFilterOption`, `ChartFilterProps`, `ChartSearch`, `ChartSearchProps`, `ChartSlider`, `ChartSliderProps`, `MosaicInputOptions`, `MosaicInputState`, `useMosaicInput`). Any `grep`-based count of that file *is* wrong; mine is not. The byte should still be removed.
- **`data-slot` before `{...rest}`** — CONFIRMED and quantified in §6g. It is **440 of 535** sites (82%), i.e. the house style, not an outlier set.

---

## 2. Classification of the unreferenced exports, and the delete list

Definitions used. A value has a **consumer** if it is named in any `packages/ui/src` non-test module
other than its own, any `docs/examples/**`, `docs/lib/**`, `docs/showcases/**`, `playground/**`, or
another package. Mentions in `.md`, `.changeset/`, `.planning/` and `docs/content/**.mdx` are **prose,
not consumption**. Internal use inside the declaring module is resolved by the TypeScript symbol
walker keyed on absolute declaration position (name-keying gives false negatives for aliased exports
such as `PrefFieldSet as PreferencesFieldSet`; position-keying alone collides with same-line
parameters — both traps were hit and corrected).

**683 exported values partition as:**

| Bucket | Count | Action |
|---|---:|---|
| Has ≥2 real consumers | 417 | keep |
| **(c′)** exactly one `docs/examples/<slug>/` and nothing else | 102 | keep the machine parts; see §2d |
| **(b)** no external consumer, **rendered/used by its own module** | **45** | **keep symbol, drop export** |
| **(c)** no consumer in code, documented in prose only | **87** | **delete export; delete symbol unless the prose is a promise you intend to keep** |
| **(a)** no consumer, no test, no prose — nothing, anywhere | **32** | **delete outright** |

### 2a. DELETE LIST — tier A (32): genuinely dead, no reference of any kind

Delete symbol **and** export. Every one is a one-line Ark context alias or a part nothing renders.

```
packages/ui/src/composites/sidebar.tsx:367      SidebarInput
packages/ui/src/simples/avatar.tsx:13           useAvatar
packages/ui/src/simples/calendar.tsx:31         CalendarControl
packages/ui/src/simples/calendar.tsx:41         CalendarLabel
packages/ui/src/simples/calendar.tsx:51         CalendarTrigger
packages/ui/src/simples/checkbox.tsx:12         useCheckbox
packages/ui/src/simples/color-picker.tsx:126    ColorPickerLabel
packages/ui/src/simples/color-picker.tsx:209    ColorPickerView
packages/ui/src/simples/color-picker.tsx:491    ColorPickerFormatTrigger
packages/ui/src/simples/color-picker.tsx:509    ColorPickerFormatSelect
packages/ui/src/simples/color-picker.tsx:534    ColorPickerSwatchPreview
packages/ui/src/simples/combobox.tsx:24         ComboboxContext
packages/ui/src/simples/date-picker.tsx:24      useDatePicker
packages/ui/src/simples/dialog.tsx:13           useDialog
packages/ui/src/simples/field.tsx:14            useField
packages/ui/src/simples/hover-card.tsx:11       useHoverCard
packages/ui/src/simples/listbox.tsx:13          useListbox
packages/ui/src/simples/listbox.tsx:15          ListboxContext
packages/ui/src/simples/number-input.tsx:13     useNumberInput
packages/ui/src/simples/password-input.tsx:18   usePasswordInput
packages/ui/src/simples/popover.tsx:14          usePopover
packages/ui/src/simples/rating.tsx:12           useRating
packages/ui/src/simples/segment-group.tsx:10    useSegmentGroup
packages/ui/src/simples/select.tsx:13           useSelect
packages/ui/src/simples/select.tsx:15           SelectContext
packages/ui/src/simples/sheet.tsx:18            useSheet
packages/ui/src/simples/switch.tsx:7            useSwitch
packages/ui/src/simples/tags-input.tsx:13       useTagsInput
packages/ui/src/simples/toast.tsx:23            useToast
packages/ui/src/simples/toggle-group.tsx:12     useToggleGroup
packages/ui/src/simples/toggle.tsx:9            useToggle
packages/ui/src/simples/tooltip.tsx:11          useTooltip
```

**Which rule.** DESIGN.md:211-215 admission rule 2: *"Proven demand. It appears in ≥2 real call
sites, not in a hypothesis."* `useField` and `FieldSeparator` are named at DESIGN.md:229 as "the two
parts still without a consumer" — that is still true of `useField` (below, tier C, for
`FieldSeparator`). **Confidence: CONFIRMED.**

### 2b. DELETE LIST — tier C (87): no consumer in code, prose only

Delete the export. Delete the symbol too unless you are keeping the doc promise. **52 of the 87 are
chart marks** — treat those as one decision (§2e), not 52.

```
# charts/chart-marks.tsx — 46 marks nothing draws (see §2e before acting)
ChartWaffleX ChartLine ChartLineX ChartArea ChartAreaX ChartDotX ChartDotY ChartCircle
ChartHexagon ChartImage ChartRect ChartRectX ChartCellX ChartCellY ChartRuleY ChartTickX
ChartText ChartTextX ChartTextY ChartVector ChartVectorX ChartVectorY ChartSpike ChartArrow
ChartLink ChartHeatmap ChartRaster ChartRasterTile ChartDenseLine ChartDensity ChartDensityY
ChartDensityX ChartErrorbarY ChartErrorbarX ChartVoronoi ChartVoronoiMesh ChartDelaunayLink
ChartDelaunayMesh ChartHull ChartGeo ChartFrame ChartGridX ChartGridY ChartSphere ChartGraticule
# charts/chart-interactors.tsx
packages/ui/src/charts/chart-interactors.tsx:33   ChartNearestX
packages/ui/src/charts/chart-interactors.tsx:34   ChartNearestY
packages/ui/src/charts/chart-interactors.tsx:35   ChartRegion
packages/ui/src/charts/chart-interactors.tsx:78   ChartPickColor
packages/ui/src/charts/chart-interactors.tsx:80   ChartBrushY
packages/ui/src/charts/chart-interactors.tsx:94   ChartPanZoom
packages/ui/src/charts/chart-root.tsx:87          useChart
# composites
packages/ui/src/composites/sidebar.tsx:493        SidebarGroupAction
packages/ui/src/composites/sidebar.tsx:524        SidebarGroupContent
packages/ui/src/composites/sidebar.tsx:654        SidebarMenuAction
# simples — Ark context aliases with a doc page and no caller
packages/ui/src/simples/accordion.tsx:11          useAccordion
packages/ui/src/simples/clipboard.tsx:14          useClipboard
packages/ui/src/simples/collapsible.tsx:11        useCollapsible
packages/ui/src/simples/color-picker.tsx:19       useColorPicker
packages/ui/src/simples/editable.tsx:8            useEditable
packages/ui/src/simples/pin-input.tsx:12          usePinInput
packages/ui/src/simples/progress.tsx:11           useProgress
packages/ui/src/simples/resizable.tsx:11          useResizable
packages/ui/src/simples/scroll-area.tsx:11        useScrollArea
packages/ui/src/simples/steps.tsx:9               useSteps
packages/ui/src/simples/tabs.tsx:8                useTabs
packages/ui/src/simples/tree-view.tsx:23          useTreeView
# simples — parts with a doc page and no caller
packages/ui/src/simples/action-bar.tsx:169        ActionBarTrigger
packages/ui/src/simples/action-bar.tsx:335        ActionBarBody
packages/ui/src/simples/color-picker.tsx:18       parseColor
packages/ui/src/simples/color-picker.tsx:470      ColorPickerInput
packages/ui/src/simples/combobox.tsx:159          ComboboxFieldInput
packages/ui/src/simples/command.tsx:226           CommandSeparator
packages/ui/src/simples/command.tsx:242           CommandFooter
packages/ui/src/simples/date-picker.tsx:166       DatePickerPresetTrigger
packages/ui/src/simples/field.tsx:236             FieldSeparator
packages/ui/src/simples/listbox.tsx:55            ListboxValueText
packages/ui/src/simples/menu.tsx:199              MenuQuickItem
packages/ui/src/simples/number-input.tsx:176      NumberInputValueText
packages/ui/src/simples/popover.tsx:41            PopoverAnchor
packages/ui/src/simples/rating.tsx:111            RatingHiddenInput
packages/ui/src/simples/select.tsx:305            SelectEmpty
packages/ui/src/simples/tags-input.tsx:225        TagsInputClearTrigger
packages/ui/src/simples/tour.tsx:343              TourPreviousStep
packages/ui/src/simples/tour.tsx:374              TourNextStep
packages/ui/src/simples/tree-view.tsx:88          TreeViewLabel
packages/ui/src/simples/tree-view.tsx:402         TreeViewCheckbox
```

`FieldSeparator` is the second of the two parts DESIGN.md:229 already names as consumer-less. It has
been documented twice and used zero times. **Delete it and delete the sentence.**

### 2c. UN-EXPORT LIST — tier B (45): the symbol stays, the export goes

These are rendered by their own module. Removing the export cannot break the component; keeping it
advertises a composition the root does not allow.

```
packages/ui/src/charts/chart-inputs.tsx:116       useMosaicInput
packages/ui/src/charts/chart-interactors.tsx:28   ChartIntervalY
packages/ui/src/charts/theme.ts:103               CHART_CAPACITY_PROPERTY
packages/ui/src/composites/CodeEditor.tsx:56      kanzoHighlightStyle
packages/ui/src/composites/CodeEditor.tsx:92      kanzoHighlighting
packages/ui/src/composites/Preferences.tsx:304    PreferencesFieldSet          # IN-FLIGHT
packages/ui/src/simples/calendar.tsx:171          CalendarContext
packages/ui/src/simples/calendar.tsx:326          CalendarTableHead
packages/ui/src/simples/calendar.tsx:330          CalendarTableRow
packages/ui/src/simples/calendar.tsx:343          CalendarTableHeader
packages/ui/src/simples/calendar.tsx:363          CalendarTableBody
packages/ui/src/simples/calendar.tsx:367          CalendarTableCell
packages/ui/src/simples/checkbox.tsx:74           CheckboxIndicator
packages/ui/src/simples/clipboard.tsx:70          ClipboardIndicator
packages/ui/src/simples/color-picker.tsx:24       safeParseColor
packages/ui/src/simples/combobox.tsx:22           useCombobox
packages/ui/src/simples/combobox.tsx:130          ComboboxTrigger
packages/ui/src/simples/combobox.tsx:154          ComboboxClear
packages/ui/src/simples/combobox.tsx:163          ComboboxPositioner
packages/ui/src/simples/combobox.tsx:226          ComboboxGroupLabel
packages/ui/src/simples/listbox.tsx:276           ListboxItemGroupLabel
packages/ui/src/simples/menu.tsx:59               MenuPositioner
packages/ui/src/simples/password-input.tsx:122    PasswordInputIndicator
packages/ui/src/simples/popover.tsx:45            PopoverPositioner
packages/ui/src/simples/popover.tsx:174           PopoverDescription
packages/ui/src/simples/popover.tsx:227           PopoverClose
packages/ui/src/simples/progress.tsx:61           ProgressTrack
packages/ui/src/simples/progress.tsx:77           ProgressRange
packages/ui/src/simples/scroll-area.tsx:68        ScrollAreaScrollbar
packages/ui/src/simples/segment-group.tsx:134     SegmentGroupIndicator
packages/ui/src/simples/select.tsx:282            SelectClearTrigger
packages/ui/src/simples/sheet.tsx:28              SheetOverlay
packages/ui/src/simples/sheet.tsx:67              SheetPositioner
packages/ui/src/simples/suggest.tsx:116           SuggestItem
packages/ui/src/simples/swatch.tsx:24             swatchVariants
packages/ui/src/simples/toast.tsx:79              ToastItem
packages/ui/src/simples/tour.tsx:119              TourActionTrigger
packages/ui/src/simples/tour.tsx:123              TourOverlay
packages/ui/src/simples/tour.tsx:136              TourPositioner
packages/ui/src/simples/tour.tsx:222              TourSpotlight
packages/ui/src/simples/tour.tsx:297              TourClose
packages/ui/src/simples/tour.tsx:411              useTourContext
packages/ui/src/simples/tree-view.tsx:241         TreeViewBranchIndicator
packages/ui/src/simples/use-ai.ts:18              cleanGhost
packages/ui/src/simples/use-ai.ts:48              useAiStream
```

**Two exceptions to argue with, not to apply blindly:**

- `useAiStream` (`use-ai.ts:48`) is asserted by `index.test.ts:16` and documented as the headless
  engine under `Complete`/`Suggest` (DESIGN.md:277-284, "the engine stays in the two headless hooks,
  **exposed for custom surfaces**"). **Keep it exported.** Same argument, weaker, for
  `kanzoHighlighting` (documented as reusable CodeMirror highlighting).
- `swatchVariants` is the only public `*Variants` with no importer. `index.test.ts:112-131` states the
  keep-rule precisely: *"The exceptions stay because a **different** module imports them."* No module
  imports `swatchVariants`. **Un-export it and add it to that test's `toBeUndefined()` list**, which is
  where the other 13 already live.

**`ProgressTrack` — DESIGN.md:239 is wrong, CONFIRMED.**
`Progress` (`simples/progress.tsx:29`) unconditionally renders `<ProgressTrack><ProgressRange /></ProgressTrack>`
at `progress.tsx:52-54`, *after* `{children}`. A consumer who follows the export and places a
`ProgressTrack` gets **two** troughs. DESIGN.md:239-240 calls this "the ideal case, not a defect"
because `data-display/progress.mdx` documents that you never place it yourself. That is the defect
restated: an export whose documentation is "do not use this" is an export that should not exist.
The ideal case is the symbol existing and the export not. **Un-export both.**

### 2d. The 102 single-example exports — do NOT blanket-delete

DESIGN.md:232-233 frames these as "the page proving the part exists, not the second call site rule 2
asks for". That framing is right for *renames* and wrong for *machine parts*. 90 of the 102 are not
rendered internally either, but the list includes `AccordionItem`, `SheetTrigger`, `CardFooter`,
`TreeViewItem`, `MenuSubTrigger`, `PasswordInput` — parts a compound is unusable without. Ark's
machine *is* the component (CONVENTIONS.md:97-99), and its parts are the API whether or not our own
examples happen to use each one twice.

The defensible cut from this set is the **thin renames** (§6f) and the near-duplicate spellings, not
the parts. Concretely, from the 102: `MenuSub` (`menu.tsx:310`, a `data-slot` rename of `Menu`),
`SheetTrigger`/`SheetBody`/`SheetFooter` (renames of the `Dialog` parts),
`AlertDialogTrigger`/`Header`/`Footer`/`Body` (ditto), `SelectSeparator`, `SidebarSeparator`,
`DownloadTrigger`. **Confidence: SUSPECTED** on the exact boundary — this one needs the owner's call,
which is why it is not in the copy-pasteable list above.

### 2e. The 52 chart marks — one decision, not 52

`analytics.ts:151-160` argues the vocabulary must be closed: *"a vocabulary with holes sends the
author to `@uwdata` for the one aggregate we left out, which is precisely the import the rest of this
barrel exists to remove."* That argument is sound for the **aggregates** (`min`/`max`/`mode`/`stddev`
are one line each and there is no substitute). It is **not** sound for the marks, because
`ChartRaw` exists (`chart-marks.tsx:204`, exported, with two doc pages and a test) and
`analytics.ts:167-171` already describes it as the hatch for exactly this: *"they are what `ChartRaw`
was built for."*

So: 46 marks with no call site anywhere, against a documented lossless escape hatch. **Recommend
deleting the 46 and keeping the ~14 with a call site plus `ChartRaw`.** That is one edit to
`chart-marks.tsx` and one to `analytics.ts:28-45`. **Confidence: CONFIRMED** on the counts,
**SUSPECTED** on the recommendation — it reverses a written decision, so it is the owner's.

### 2f. Types

**103 of 149** exported types are referenced by nothing (no code, no test, no prose). Types cost zero
runtime bytes and a `FooProps` export is the conventional way for a consumer to type a wrapper, so
this is *not* the same finding as the values. The ones worth deleting are the internal shapes that
leak an implementation:

```
packages/ui/src/charts/chart-inputs.tsx:82    MosaicInputOptions
packages/ui/src/charts/chart-inputs.tsx:98    MosaicInputState
packages/ui/src/charts/chart-spec.ts:40       ChartLegendDirective
packages/ui/src/charts/chart-spec.ts:47       ChartRawDirective
packages/ui/src/charts/chart-spec.ts:71       ChartCompile
packages/ui/src/simples/tree-view.tsx:123     NodeProviderProps
```

Every other unreferenced type is the `Props` of a component; delete them **with** their component or
not at all.

### 2g. Prop-level surplus

- **13 of 165** `tv()` variant *values* have no call site anywhere (`exp-variants.mjs`):
  `buttonVariants.size="icon-xl"` (`simples/button.tsx:78`);
  `dialogContentVariants.size` ∈ {`2xl`,`3xl`,`4xl`,`5xl`,`6xl`,`fullscreen`} (`simples/dialog.tsx:124`) — **7 sizes nobody asks for is a catalogue**;
  `fieldVariants.orientation="responsive"` (`simples/field.tsx:25`);
  `floatVariants.placement` ∈ {`top-center`,`middle-start`,`middle-end`,`bottom-center`} (`simples/float.tsx:15`) — this one is a closed 3×3 grid and the holes would be arbitrary, **keep**;
  `inputGroupAddonVariants.align="block-start"` (`simples/input-group.tsx:72`).
- **43 of 461** members of exported `*Props` interfaces are never passed by any call site. Notable:
  `ButtonProps.isLoading` (`simples/button.tsx:138`), `DateFieldProps.withTime` (`simples/DateField.tsx:59`),
  `ActionBarProps.closeOnEscape` (`simples/action-bar.tsx:70`),
  `CodeEditorProps.lineNumbers` + `.onView` (`composites/CodeEditor.tsx:333,349`),
  `BreadcrumbsProps.collapsedLabel` (`composites/Breadcrumbs.tsx:45`),
  `MosaicContextValue.reset` + `.registerSelection` (`charts/mosaic-provider.tsx:40,46` — public API on
  `useMosaic()` that nothing calls), and four `UseDataTableOptions.initial*`
  (`table/use-data-table.ts:41-46`). **Confidence: CONFIRMED** on absence, **SUSPECTED** on each being
  dead rather than merely undemonstrated.

---

## 3. Barrel coherence

**What holds.**

- **Flat, no dot-notation.** Zero `Foo.Bar =` static assignments anywhere in `src`. CONVENTIONS.md:103-104
  (*"A component may only export dot-notation if it also exports the flat names; no component does today"*)
  is still true. CONFIRMED.
- **No component exported under two names.** Zero declarations reachable under >1 public name. CONFIRMED.
- **No orphan modules.** Every non-entry module under `src` is reachable from a public entry. Only
  three contribute no public export, all correctly internal:
  `charts/tokenized-plot.tsx`, `simples/use-is-mobile.tsx`, `theme/prefs-config.ts`.
- **`package.json` `exports` map matches the four entries** and adds `./styles.css` + `./package.json`.
  `publint` runs in CI (`.github/workflows/ci.yml`). No finding.

**What has accreted.**

1. **The block comment lies about seven entries.** `index.tsx:84` labels the `export *` block
   *"Level 1 — primitives (Shark UI, vendored as-is)"*, then lists seven modules that are ours, not
   Shark's: `show.js` (136), `stat-tile.js` (140), `swatch.js` (141), `json-tree-view.js` (116),
   `complete.js` (155), `suggest.js` (156), `use-ai.js` (157). `index.test.ts:32-34` says so in
   writing about `Swatch` (*"The one primitive Ark cannot supply"*), and DESIGN.md:76-77 lists
   `StatTile` as ours. Meanwhile `index.tsx:159` opens a block explicitly headed *"bespoke atoms (no
   Shark equivalent; token-native, ours)"* that these seven belong in. **Action:** move the seven, or
   drop the provenance claim from the comment. CONFIRMED.
2. **Alphabetical ordering breaks six times** inside the `export *` block, which is otherwise sorted:
   `index.tsx:99-101` (`download-trigger`, `color-picker`, `collapsible`),
   `:130-132` (`segment-group`, `resizable`, `scroll-area`),
   `:134-135` (`sheet`, `separator`),
   `:141-143` (`swatch`, `status`, `steps`),
   `:155-157` (`complete`, `suggest`, `use-ai` appended after `tree-view`).
   Each break marks where something was added without re-sorting. Low severity, trivially fixed.
   CONFIRMED.
3. **`linkRecipe` is documented as public and is not** — §1c. CONFIRMED.
4. **Two link components, one `data-slot`.** `Link` (`simples/Link.tsx:24`) and `DefaultLink`
   (`composites/link.tsx:16`) both render a raw `<a data-slot="link">`. They differ in that `Link`
   takes a `variant` and `DefaultLink` takes none. Under CONVENTIONS.md:91 (*"our own recipes depend
   on it"*) two components must not emit one slot. Under DESIGN.md:242-259 rung 3, `DefaultLink` is
   `<Link variant="plain" />`. **Action: delete `DefaultLink`, keep the `LinkComponent` type, default
   `linkComponent` to `Link`.** CONFIRMED (the duplication), SUSPECTED (the exact fix).

---

## 4. Optional-peer isolation and the placement test

### 4a. Isolation from the root entry — HOLDS

Traced statically from `packages/ui/src/index.tsx` following every value-level relative import
(`exp-graph.mjs`; full module list in `reach-index.tsx.txt`):

| Entry | Runtime-reachable modules | Optional-peer imports |
|---|---:|---|
| `index.tsx` | 99 | **none** |
| `table.ts` | 26 | `@tanstack/react-table` (7 type-only, 2 value) |
| `analytics.ts` | 34 | `@uwdata/mosaic-core`, `@uwdata/mosaic-sql`, `@uwdata/vgplot` |
| `editor.ts` | 3 | six `@codemirror/*` + `@lezer/highlight` |

CONVENTIONS.md:113 (*"A static import of an optional peer from the root entry breaks
`import { Button }` for everyone who did not install it"*) is **satisfied**. `index.tsx:164-167`
warns about the CodeMirror case and the warning is being honoured. **CONFIRMED.**

### 4b. Placement test — `charts/theme.ts` FAILS it

DESIGN.md:88-89: *"a part belongs on a subpath only if it imports that subpath's engine. Thematic
neighbourhood is not a reason."*

`packages/ui/src/charts/theme.ts` imports **zero** `@uwdata/*` / `@duckdb/*`. Its only imports are
`react` and `@kanzo-tech/theme` (`theme.ts:3-4`). Everything it exports is a token/DOM utility:
`resolveTokenColor` (`:44`), `useThemeTick` (`:65`), `CHART_SLOTS` (`:88` re-export),
`CHART_CAPACITY_PROPERTY` (`:103`), `categoricalCapacity` (`:113`), `useChartCapacity` (`:132`),
`categoricalColor` (`:153` — pure string arithmetic, `return \`var(--chart-${i + 1})\``).

**This is not hypothetical.** Two non-chart consumers already pay for it:

```
docs/showcases/workspace/use-graph-look.ts:5   import { useThemeTick }     from "@kanzo-tech/ui/analytics";
docs/lib/css-color.ts:13                        import { resolveTokenColor } from "@kanzo-tech/ui/analytics";
```

Neither is a plot. `@kanzo-tech/ui/analytics` statically re-exports `@uwdata/mosaic-core`,
`@uwdata/mosaic-sql` and `@uwdata/vgplot` (`analytics.ts:162-206`), so **a WebGL graph that wants a
12-line token resolver must install the DuckDB/Mosaic stack.** That is verbatim the failure
DESIGN.md:79-81 describes for `StatTile`. `theme.ts` even documents the demand itself
(`analytics.ts:118-121`: *"any surface painting from tokens onto a canvas needs both … every consumer
that re-invented them got one of the two subtly wrong"*).

**Action:** split `charts/theme.ts` into
`src/lib/token-color.ts` (`resolveTokenColor`, `useThemeTick`) + `src/lib/categorical.ts`
(`CHART_SLOTS`, `categoricalColor`, `categoricalCapacity`, `useChartCapacity`,
`CHART_CAPACITY_PROPERTY`), export both from the **root barrel**, and have `/analytics` re-export
nothing but what actually imports vgplot. **Confidence: CONFIRMED** (the placement violation and the
two consumers), **SUSPECTED** (the exact file split).

### 4c. Other engine-free files under `charts/` and `table/` — all pass

| File | Imports an engine? | Verdict |
|---|---|---|
| `charts/chart-axes.tsx` | transitively, via `chart-spec.ts` → `@uwdata/mosaic-sql` (value) | pass — inert descriptors for the compiler |
| `charts/chart-config.ts` | no | pass on placement (it *is* the chart colour config), **fails the client boundary** — §5b |
| `charts/arrow.ts` | no | pass — `column`/`numbers` only ever see a Mosaic `queryResult`; useless without the engine |
| `table/data-table-pagination.tsx` | no `@tanstack` import, but calls `useDataTableContext()` at `:24` and `table.getState()`/`getPageCount()`/`setPageIndex()` at `:26-71` | pass — engine-coupled through context; a grep-only test would have false-positived here |

### 4d. `StatTile` — the cited failure is FIXED

DESIGN.md:86-89 says `StatTile` *"failed it for a while by living under `/charts` without importing a
single line of Mosaic."* It now lives at `packages/ui/src/simples/stat-tile.tsx`, is exported from the
root barrel at `index.tsx:140`, imports no `@uwdata`, and its connected half `ChartStat`
(`charts/chart-stat.tsx:47`) renders `<StatTile>` — so DESIGN.md:83-85's "not duplication" claim
holds too. **CONFIRMED fixed.** The doc should say so in the past tense.

---

## 5. Client boundary

CONVENTIONS.md:110-111: *"A file gets `"use client"` **iff** it calls a React hook, registers an event
listener, or imports a module that does. Hook-free presentational components must **not** have it, so
they stay server-renderable."*

Corpus: 127 non-test source files, **96** carry the directive.

### 5a. Missing the directive and needing it — 2 real, 1 false positive

**FINDING 1 — `packages/ui/src/composites/SidebarNav.tsx:1` has no `"use client"` and calls
`useSidebar()` at `:91`.** `useSidebar` is `composites/sidebar.tsx:841`, a `useContext` wrapper.
`sidebar.tsx` *is* a client module, so in an RSC graph `useSidebar` resolves to a **client reference**
— calling it from a Server Component throws. Severity: **runtime break**.

Why CI does not catch it: `.github/workflows/ci.yml` says so honestly — *"removing `"use client"` from
a thin Ark wrapper does NOT fail this build, because Ark ships the directive on 341 of its own files"*
— and both docs fixtures that render it,
`docs/examples/sidebar-nav/example-default.tsx:1` and `example-active-path.tsx:1`, carry
`"use client"` themselves, so the library's omission is masked. **CONFIRMED. Action: add the directive.**

**FINDING 2 — `packages/ui/src/simples/use-is-mobile.tsx:1` has no `"use client"`** and calls
`React.useState` (`:6`), `React.useEffect` (`:10`), `window.matchMedia` (`:11`) and
`mql.addEventListener` (`:17`). Contained today because its only importer,
`composites/sidebar.tsx:23`, is a client module — but the file is one import away from breaking.
**CONFIRMED. Action: add the directive.**

Same line, second defect: `sidebar.tsx:23` reads `from "../simples/use-is-mobile"` — **the only
extensionless import of that module**, in a repo where the convention is `.js`. See §6h.

**False positive:** `theme/theme-script.ts` and `index.tsx` trip a `document.`/`window.` scan, but in
`theme-script.ts` those characters live inside the template string that *is* the injected script
(`theme-script.ts:1-20` documents this), and in `index.tsx` inside a comment (`:12-13`). Both are
correctly directive-free. No finding.

### 5b. **The worst one: a Server Component calling into a client module**

`packages/ui/src/charts/chart-config.ts` has **no** `"use client"` (line 1 is
`import type { ComponentType, ReactNode } from "react";`). At `:2` it imports
`categoricalColor` from `./theme.js` — and `charts/theme.ts:1` **is** `"use client"`. It then
**calls** it, twice:

```
packages/ui/src/charts/chart-config.ts:73     color: series.color ?? categoricalColor(i),
packages/ui/src/charts/chart-config.ts:82     return config[key]?.color ?? categoricalColor(index);
```

In an RSC graph an import from a `"use client"` module yields a client *reference*, not the function.
Both call sites sit inside `chartSeriesEntries` and `chartSeriesColor`, which are **public exports of
`@kanzo-tech/ui/analytics`** (`analytics.ts:24`). A Server Component that calls either one throws.
`charts/chart-spec.ts` inherits the same taint (it imports `chart-config.ts` and also has no directive).

Root cause: `theme.ts` mixes four pure functions with two hooks in one module, so the hooks force the
directive onto the pure half. **This is the same defect as §4b and the same fix resolves both.**
**CONFIRMED. Severity: runtime break.**

### 5c. Carrying the directive and not needing it — 59 files

These call no hook, register no listener, and every module they import that does is **itself** a
client module (Ark's dist carries `"use client"` on 1567 files; our own hook-bearing modules all carry
it). Per CONVENTIONS.md:111 they *"must not have it, so they stay server-renderable"*, and per the
repo's own CI comment the boundary is already established one level down.

```
charts/chart-axes.tsx  charts/chart-interactors.tsx  charts/chart-marks.tsx
simples/DateField.tsx  simples/FieldArray.tsx  simples/accordion.tsx  simples/alert-dialog.tsx
simples/alert.tsx  simples/avatar.tsx  simples/badge.tsx  simples/breadcrumb.tsx
simples/calendar.tsx  simples/checkbox.tsx  simples/client-only.tsx  simples/clipboard.tsx
simples/collapsible.tsx  simples/command.tsx  simples/date-picker.tsx  simples/download-trigger.tsx
simples/editable.tsx  simples/field.tsx  simples/file-upload.tsx  simples/highlight.tsx
simples/hover-card.tsx  simples/input-group.tsx  simples/input.tsx  simples/json-tree-view.tsx
simples/kbd.tsx  simples/listbox.tsx  simples/menu.tsx  simples/native-select.tsx
simples/number-input.tsx  simples/pagination.tsx  simples/password-input.tsx  simples/pin-input.tsx
simples/popover.tsx  simples/progress.tsx  simples/prose.tsx  simples/rating.tsx
simples/resizable.tsx  simples/scroll-area.tsx  simples/segment-group.tsx  simples/separator.tsx
simples/sheet.tsx  simples/skeleton.tsx  simples/spinner.tsx  simples/stat-tile.tsx
simples/status.tsx  simples/steps.tsx  simples/switch.tsx  simples/table.tsx  simples/tabs.tsx
simples/tags-input.tsx  simples/textarea.tsx  simples/toast.tsx  simples/toggle-group.tsx
simples/toggle.tsx  simples/tooltip.tsx  simples/tree-view.tsx  table/data-table-content.tsx
table/select-column.tsx
```

(all paths relative to `packages/ui/src/`; directive is line 1 of each)

**Four files were checked and correctly excluded** because they call hooks through a namespace my
first pass missed: `simples/color-picker.tsx:96,98` (`React.useMemo`), `simples/dialog.tsx:344`,
`simples/toggle-group.tsx:108`, `simples/tree-view.tsx:445` (`React.useContext`). They keep the directive.

**Confidence: CONFIRMED** on the mechanical facts (no own hook, no own listener, all hook-bearing deps
are client modules). **SUSPECTED** that removing all 59 is safe in one sweep — the honest test is the
`docs/` App Router build, and the CI comment already tells you that build will not detect a *wrong*
removal either. Do it in batches and watch bundle size, which is the only signal that will move.

---

## 6. Per-rule conformance sweep

### 6a. `ark.*` on every DOM-rendering part — 25 violations

CONVENTIONS.md:90: *"**`ark.*` on every part that renders a DOM element** — simples, composites *and*
layouts, **with no exemption**."*

Exported components whose root element is a raw intrinsic tag:

```
packages/ui/src/charts/tokenized-plot.tsx:105   TokenizedPlot -> <div>        (internal, not public)
packages/ui/src/composites/CodeEditor.tsx:462   CodeEditor    -> <div>
packages/ui/src/composites/CodeEditor.tsx:473   CodeEditor    -> <div>
packages/ui/src/composites/MadeWith.tsx:29      MadeWith      -> <p>
packages/ui/src/composites/SidebarIdentity.tsx:81   SidebarIdentityIcon        -> <div>
packages/ui/src/composites/SidebarIdentity.tsx:108  SidebarIdentityText        -> <div>
packages/ui/src/composites/SidebarIdentity.tsx:123  SidebarIdentityLabel       -> <span>
packages/ui/src/composites/SidebarIdentity.tsx:134  SidebarIdentityDescription -> <span>
packages/ui/src/composites/SidebarNav.tsx:95    SidebarNav    -> <nav>
packages/ui/src/simples/EmptyState.tsx:21       EmptyState    -> <div>
packages/ui/src/simples/FieldArray.tsx:86       FieldArray    -> <div>
packages/ui/src/simples/Link.tsx:26             Link          -> <a>
packages/ui/src/simples/Ribbon.tsx:99           Ribbon        -> <div>
packages/ui/src/simples/calendar.tsx:107        CalendarYearSelect   -> <div>
packages/ui/src/simples/calendar.tsx:135        CalendarMonthSelect  -> <div>
packages/ui/src/simples/command.tsx:179         CommandList   -> <div>   [also no data-slot]
packages/ui/src/simples/command.tsx:246         CommandFooter -> <div>
packages/ui/src/simples/complete.tsx:162        CompleteGhost -> <div>
packages/ui/src/simples/complete.tsx:185        CompleteHint  -> <p>
packages/ui/src/simples/floating-panel.tsx:98   FloatingPanel -> <div>
packages/ui/src/simples/floating-panel.tsx:131  FloatingPanelResizeHandle -> <div>
packages/ui/src/simples/stat-tile.tsx:80        StatTile      -> <div>
packages/ui/src/simples/suggest.tsx:125         SuggestItem   -> <div>   [also no data-slot]
packages/ui/src/simples/table.tsx:63            Table         -> <div>
packages/ui/src/table/data-table-content.tsx:62 DataTableContent -> <div>
```

Note the shape of the list: it is almost exactly the PascalCase-filename set. The rule was written
because *"this rule used to be implied by the recipe and observed only in `simples/`"*
(CONVENTIONS.md:90) — the sweep that fixed `layouts/` and `sidebar.tsx` (both now fully `ark.*`)
did not reach the bespoke composites. **CONFIRMED.** Action: convert all 25; each is a one-token edit
and buys `asChild` universally.

### 6b. `data-slot` on every targetable part — 4 missing

CONVENTIONS.md:91. `ark.*` elements with neither `data-slot` nor `asChild`:

```
packages/ui/src/composites/sidebar.tsx:222      <ark.div>
packages/ui/src/composites/sidebar.tsx:307      <ark.span>
packages/ui/src/simples/action-bar.tsx:339      <ark.div>   (ActionBarBody root, spreads rest)
packages/ui/src/simples/select.tsx:312          <ark.div>   (SelectEmpty root, spreads rest)
```

Plus the two flagged in §6a (`CommandList`, `SuggestItem`). **CONFIRMED**, 6 total. Low severity, one-line each.

### 6c. `React.ComponentProps<typeof ark.x>` never `ComponentProps<"div">` — 14 violations

CONVENTIONS.md:90 last sentence: *"Type props as `React.ComponentProps<typeof ark.div>`, never as
`ComponentProps<"div">`."*

```
packages/ui/src/composites/SidebarIdentity.tsx:18   SidebarIdentityProps extends ComponentProps<"div">
packages/ui/src/composites/SidebarIdentity.tsx:78   SidebarIdentityIcon(… ComponentProps<"div">)
packages/ui/src/composites/SidebarIdentity.tsx:105  SidebarIdentityText(… ComponentProps<"div">)
packages/ui/src/composites/SidebarIdentity.tsx:121  SidebarIdentityLabel(… ComponentProps<"span">)
packages/ui/src/composites/SidebarIdentity.tsx:132  SidebarIdentityDescription(… ComponentProps<"span">)
packages/ui/src/composites/sidebar.tsx:45           SidebarProviderProps extends React.ComponentProps<"div">
packages/ui/src/composites/sidebar.tsx:421          SidebarContentProps  extends React.ComponentProps<"div">
packages/ui/src/layouts/section.tsx:115             Omit<ComponentProps<"h2">, "ref">
packages/ui/src/simples/Link.tsx:23                 LinkProps extends React.ComponentProps<"a">
packages/ui/src/simples/command.tsx:226             CommandSeparator(props: React.ComponentProps<"div">)
packages/ui/src/simples/command.tsx:242             CommandFooter(props: React.ComponentProps<"div">)
packages/ui/src/simples/floating-panel.tsx:31       FloatingPanelProps extends React.ComponentProps<"div">
packages/ui/src/simples/floating-panel.tsx:113      FloatingPanelResizeHandleProps extends React.ComponentProps<"div">
packages/ui/src/simples/spinner.tsx:6               Spinner(props: React.ComponentProps<"svg">)
```

`layouts/section.tsx:115` is the sharpest one: `Omit<…, "ref">` deliberately strips `ref`, which is the
exact failure mode CONVENTIONS.md:62-65 forbids for `ComponentPropsWithoutRef`. **CONFIRMED.**

### 6d. No `forwardRef`, no `ComponentPropsWithoutRef` — 3 and 0

CONVENTIONS.md:62-65: *"Do **not** use `forwardRef` — it still works, but it is redundant."*

```
packages/ui/src/composites/link.tsx:16       DefaultLink  = React.forwardRef<HTMLAnchorElement, …>
packages/ui/src/simples/TextField.tsx:28     TextField    = React.forwardRef<HTMLInputElement, TextFieldProps>
packages/ui/src/simples/TextField.tsx:55     NumberField  = React.forwardRef<HTMLInputElement, NumberFieldProps>
```

`ComponentPropsWithoutRef`: **zero occurrences.** Clean. **CONFIRMED.**

### 6e. kebab-case filenames — 19 remaining, and the rule contradicts DESIGN.md

CONVENTIONS.md:93: *"File naming: kebab-case … Some older files are PascalCase; new files are
kebab-case and the rest converge over time."*

```
composites/AppearanceToggle.tsx   composites/Breadcrumbs.tsx    composites/CodeEditor.tsx
composites/InstanceSwitcher.tsx   composites/MadeWith.tsx       composites/Preferences.tsx
composites/SidebarIdentity.tsx    composites/SidebarNav.tsx     composites/SidebarUser.tsx
simples/DateField.tsx  simples/EmptyState.tsx  simples/FacetFilter.tsx  simples/FieldArray.tsx
simples/Link.tsx  simples/Ribbon.tsx  simples/TextField.tsx
table/DataTable.tsx  table/sortableHeader.tsx  theme/KanzoThemeProvider.tsx
```

**The two normative documents disagree.** DESIGN.md:95-101 ("The naming rule") makes PascalCase
*semantic*: *"`kebab-case` is the vendored primitive. `PascalCase` is our pre-assembled convenience
built on top of it"* — verified for `TextField`→`input`+`input-group`, `DateField`→`date-picker`+`calendar`.
CONVENTIONS.md:93 says they should all converge to kebab. **These cannot both be policy.** Under
DESIGN.md's rule, 15 of the 19 are correct and four are wrong:
`composites/CodeEditor.tsx` (imports no kebab primitive — it *is* the primitive),
`composites/Preferences.tsx`, `composites/AppearanceToggle.tsx` (ditto), and
`table/sortableHeader.tsx` (camelCase, neither category, and it exports a factory not a component).
**Action: pick one rule and delete the other paragraph.** **CONFIRMED (the contradiction).**

Related hazard, and CONVENTIONS.md:93 names it: *"Never rely on case-insensitive resolution — CI is
case-sensitive even though macOS is not."* The tree contains `simples/Link.tsx` **and**
`composites/link.tsx`. They are in different directories so resolution is safe today, but they are
one move apart from an unbuildable repo, and they are the same component twice (§3.4).

### 6f. Thin `data-slot` renames — 38, of which 13 add nothing at all

Exported components whose entire body is one other Kanzo component plus a new `data-slot`. Strictly
`data-slot`-only (no class, no prop, no adapter):

```
packages/ui/src/simples/alert-dialog.tsx:22    AlertDialogTrigger  -> DialogTrigger
packages/ui/src/simples/alert-dialog.tsx:53    AlertDialogHeader   -> DialogHeader
packages/ui/src/simples/alert-dialog.tsx:59    AlertDialogClose    -> DialogClose
packages/ui/src/simples/alert-dialog.tsx:63    AlertDialogFooter   -> DialogFooter
packages/ui/src/simples/command.tsx:209        CommandGroup        -> ComboboxGroup
packages/ui/src/simples/command.tsx:240        CommandShortcut     -> MenuShortcut
packages/ui/src/simples/date-picker.tsx:169    DatePickerPresetTrigger -> CalendarPresetTrigger
packages/ui/src/simples/download-trigger.tsx:8 DownloadTrigger     -> ArkDownloadTrigger   (the vendoring point — keep)
packages/ui/src/simples/menu.tsx:311           MenuSub             -> Menu
packages/ui/src/simples/sheet.tsx:21           Sheet               -> Dialog
packages/ui/src/simples/sheet.tsx:30           SheetOverlay        -> DialogOverlay
packages/ui/src/simples/sheet.tsx:188          SheetHeader         -> DialogHeader
packages/ui/src/simples/tour.tsx:234           TourHeader          -> DialogHeader
```

`TourHeader` is the one DESIGN.md:187 already concedes — *"Precedent that the line is right:
`TourHeader` *is* `DialogHeader`."* The doc uses it to justify keeping the rename; the minimality
reading is that `DialogHeader` with a `data-slot` override is the same thing without an export.
A further 7 add only a `className` merge (`SectionTitle`, `AlertDialogBody`, `CommandEmpty`,
`CommandSeparator`, `Highlight`, `SheetBody`, `SheetFooter`); the remaining 18 add a real prop or
adapter and are legitimate. **DESIGN.md's "29, floor not ceiling" is confirmed as a floor.** CONFIRMED.

### 6g. `data-slot` written before `{...rest}` — 440 of 535 (class-wide)

Corroborating the taxonomy agent. Measured with the TS parser over every JSX element in `src`:

| Ordering | Count |
|---|---:|
| spread **after** `data-slot` → a caller's `data-slot` erases the primitive's | **440** |
| spread **before** `data-slot` → the slot always wins | **1** |
| no spread at all | 94 |
| **total `data-slot` elements** | **535** |

81 files affected; the heaviest are `composites/sidebar.tsx` (24), `simples/calendar.tsx` (22),
`simples/color-picker.tsx` (20), `simples/tree-view.tsx` (15), `simples/field.tsx` / `menu.tsx` /
`tour.tsx` (14 each). The single opposite case is
**`packages/ui/src/simples/combobox.tsx:142` (`<ArkCombobox.Trigger>`)**.

**Framing matters here.** At 440/535 this is not a bug list, it is the house style — inherited from
Shark/shadcn, which write `data-slot="x" {...props}` too. It is nonetheless a real hazard given
CONVENTIONS.md:91 (*"our own recipes depend on it (`in-[[data-slot=popover-content]…]`)"*): a caller who
passes `data-slot` silently detunes a recipe with no error. It is **one decision**, not 440 findings:
either (a) declare that overriding `data-slot` is a supported escape hatch and fix the one outlier at
`combobox.tsx:142`, or (b) move the attribute after the spread everywhere — a mechanical codemod.
**CONFIRMED (the counts), SUSPECTED (that it is a defect rather than a convention).**

### 6h. Focus-ring shape — 12 divergences

CONVENTIONS.md:81: *"Focus rings are `outline-none focus-visible:ring-[3px] focus-visible:ring-ring`
… ours is **solid**, because the diluted form measured 1.29:1 on the page and 1.4.11 names a focus
indicator first."* 44 ring sites; the canonical shape appears 27×.

**Diluted rings — direct contradiction of "ours is solid" (11 sites):**
```
packages/ui/src/simples/badge.tsx:25   focus-visible:ring-foreground/20
packages/ui/src/simples/badge.tsx:26   dark:focus-visible:ring-foreground/40
packages/ui/src/simples/badge.tsx:33   focus-visible:ring-foreground/50
packages/ui/src/simples/badge.tsx:59   focus-visible:ring-success/20
packages/ui/src/simples/badge.tsx:66   focus-visible:ring-info/50
packages/ui/src/simples/badge.tsx:73   focus-visible:ring-warning/20
packages/ui/src/simples/badge.tsx:74   dark:focus-visible:ring-warning/40
packages/ui/src/simples/badge.tsx:81   focus-visible:ring-destructive/24
packages/ui/src/simples/badge.tsx:82   dark:focus-visible:ring-destructive/40
packages/ui/src/simples/button.tsx:51  focus-visible:ring-destructive-foreground/32
packages/ui/src/simples/slider.tsx:158 aria-invalid:focus-visible:ring-destructive/48
```
The rule's own history says a soft alpha ring *"was tried for these 37 sites and dropped"*. Eleven
survived the drop. **CONFIRMED.**

**Wrong width (3 sites):**
```
packages/ui/src/simples/Link.tsx:12        focus-visible:ring-2  (and no focus-visible:border-*)
packages/ui/src/simples/resizable.tsx:52   focus-visible:ring-1 focus-visible:ring-offset-1 + outline-hidden
packages/ui/src/composites/sidebar.tsx:480 "outline-hidden ring-sidebar-ring focus-visible:ring-2"
```
`sidebar.tsx:480` is the worst: `ring-sidebar-ring` is **unscoped**, so the colour applies whether or
not the element is focused; only the width is behind `focus-visible`. **CONFIRMED.**

`ring-offset-*` additions at `breadcrumb.tsx:62`, `color-picker.tsx:317`, `radio-group.tsx:99`,
`checkbox.tsx:36` and the deliberate `focus-visible:ring-0` suppressions at `input-group.tsx:210,233`
are divergences from the stated shape but defensible; noted, not filed.

### 6i. `border-input` vs `bg-field` — the trough has three answers, and none is `bg-field`

CONVENTIONS.md:80: *"`border-input` outlines, `bg-field` fills. … the outline is the visual boundary
that identifies a control, **a switch track or a progress trough is not**. `border-input` is the
outline; `bg-field` is the fill, and it is an **alpha step**, so it never carries a `/NN`."*

**The two rules the doc states literally are both clean:** zero `bg-field/NN`, zero `border-input/NN`.
CONFIRMED.

**But the two examples the rule names by name are both wrong:**
```
packages/ui/src/simples/switch.tsx:31     data-[state=unchecked]:bg-input     # "a switch track"
packages/ui/src/simples/progress.tsx:66   bg-border                           # "a progress trough"
packages/ui/src/simples/scroll-area.tsx:98 bg-input                           # scrollbar thumb
```
Three troughs, three different tokens, and `bg-input` uses the **outline** token as a fill — precisely
the conflation the rule was written to end. **CONFIRMED.** Action: all three → `bg-field`.

(For contrast, the 18 correct `bg-field` sites are all controls: `input.tsx:13`, `textarea.tsx:11`,
`native-select.tsx:16`, `pin-input.tsx:18`, `tags-input.tsx:58`, `file-upload.tsx:52,110`, etc.)

### 6j. Inline `style={}` — 21 sites, 7 violations

CONVENTIONS.md:78: *"**Never** use inline `style={}` for variant appearance … One-off **computed**
structural style … is fine; a hard-coded constant is not."* Sanctioned exception (`:82`): a colour
that is data.

**Sanctioned (2):** `charts/chart-legend.tsx:47` (`{ color }` from the series config),
`simples/swatch.tsx:45` (`{ background: color }`).
**Computed structural, fine (7):** `CodeEditor.tsx:462,488` (min/max height from props),
`floating-panel.tsx:105` (width), `table.tsx:66` (maxHeight), `complete.tsx:170` (`ctx.metrics`),
`shell.tsx:168` (width), `sidebar.tsx:764` (skeleton width), `action-bar.tsx:237` / `toggle-group.tsx:61`
/ `radio-group.tsx:63` (custom property from a prop).

**Violations — hard-coded constants, three of them colours:**
```
packages/ui/src/simples/popover.tsx:239     style={{ "--arrow-background": "var(--popover)",   "--arrow-size": "calc(1.5 * var(--spacing))" }}
packages/ui/src/simples/hover-card.tsx:91   style={{ "--arrow-background": "var(--popover)",   "--arrow-size": "calc(1.5 * var(--spacing))" }}
packages/ui/src/simples/tooltip.tsx:90      style={{ "--arrow-background": "var(--foreground)", "--arrow-size": "calc(1.5 * var(--spacing))" }}
packages/ui/src/simples/toast.tsx:54        style={{ "--width": "356px" }}
packages/ui/src/composites/CodeEditor.tsx:473 style={{ flex: 1, width: "100%" }}
packages/ui/src/composites/sidebar.tsx:142  style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON }}
packages/ui/src/composites/sidebar.tsx:211  style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE }}
```
The three arrow colours are the sharpest: a **token colour set inline**, so a consumer cannot restyle
the arrow with a class — which is the whole point of the rule. All seven become
`[--arrow-background:var(--popover)]`, `[--width:356px]`, `flex-1 w-full`, `[--sidebar-width:16rem]`.
**CONFIRMED.**

**Two IN-FLIGHT, judgement calls:** `composites/Preferences.tsx:439` (`fontFamily: o.preview` — a font
the user is choosing, arguably the same "value not known until runtime" exception as data colour) and
`:492` (`fontSize: DENSITY_PX[o.value]` — a JS constant table, which the rule forbids). If the font
preview is legitimate, CONVENTIONS.md:82 should name it as a third exception, because an unnamed
exception is where the last defect went to hide (`:83`).

### 6k. Extensionless relative imports — 140 sites

`moduleResolution: "Bundler"` (`tsconfig.base.json:7`) makes these legal to `tsc`, and Rollup rewrites
them under `preserveModules`, so the **JS** is fine. The risk is the emitted `.d.ts`:
`vite-plugin-dts` is configured with no specifier rewriting (`packages/ui/vite.config.ts:11-16`), so
`dist/simples/editable.d.ts` will contain `from "./button"`, which a consumer on
`moduleResolution: "node16"/"nodenext"` cannot resolve in an ESM package. 67 files affected; the
barrel files themselves correctly use `.js`, so the failure would be partial and confusing.
**SUSPECTED** — I could not run the build to inspect `dist`. Cheap to verify: build once and grep
`dist/**/*.d.ts` for `from "\./[a-z-]*"`.

---

## 7. Do the guard rails guard what they claim?

CONVENTIONS.md:117-120: *"Guard rails that must not regress — the public export surface, the client
boundary, optional-peer isolation — belong in `packages/ui/src/index.test.ts` and `pnpm smoke`."*

### 7a. `packages/ui/src/index.test.ts` — partial

**What it does well.** It asserts 28 names present, ~30 deleted names absent (with the reasoning
inline, which is genuinely good practice), 13 `*Variants` absent, and the *names* of the optional-peer
components absent from the root barrel (`:133-166`).

**What it does not catch:**
1. **No count assertion.** Nothing pins the size of the surface, so a new `export *` adding 40 names
   passes silently. Given §1's numbers, a `expect(Object.keys(UI)).toHaveLength(n)` — or better, an
   inline snapshot of the sorted names — is the single highest-value test to add.
2. **Optional-peer isolation is tested by proxy.** `:145-166` asserts `MosaicProvider`, `ChartRoot`,
   `DataTable`, `CodeEditor`… are *undefined* on the root barrel. That catches re-exporting a known
   name; it does **not** catch a *new* file importing `@tanstack/react-table` and being exported under
   a name the test has never heard of. The real invariant — no optional peer in the root entry's static
   import graph — is what §4a computes, and it is not tested anywhere. `exp-graph.mjs` in this
   scratchpad is ~40 lines and could become that test.
3. **The client boundary is not tested at all**, despite being one of the three named guard rails.
   A test that reads every file under `src`, detects hooks/listeners, and asserts the directive matches
   would have caught `SidebarNav.tsx` and `use-is-mobile.tsx` (§5a) — both of which are live defects today.
4. **No flat-barrel assertion.** CONVENTIONS.md:103-104's "no dot-notation" is true by luck, not by test.

Precedent that this style of static test is already accepted here: `src/alpha-steps.test.ts`,
`src/logical-properties.test.ts`, `src/no-literal-hues.test.ts` all sweep the source tree. Three more
in the same shape would close all four gaps. **CONFIRMED.**

### 7b. `scripts/smoke-install.mjs` — two real defects

1. **It guards symbols that no longer exist.** `scripts/smoke-install.mjs:63`:
   `for (const leaked of ["EditorShell", "GhostEditor"])`. Neither name is exported anywhere in the
   repo — `editor.ts:14` exports `CodeEditor`, and `index.tsx:164-167` mentions the old names only in a
   comment. **The assertion can never fail.** Meanwhile `index.test.ts:135-137` guards the *current*
   names (`CodeEditor`, `CompletionField`). The two guards have drifted. **CONFIRMED. Action:** sync to
   `["CodeEditor", "CompletionField"]`, and add the `/table` and `/analytics` names.
2. **It does not check `"use client"` preservation** — the first bug class its own header
   (`:19`) names: *"`"use client"` was stripped by the bundler → every component silently a server
   component."* Nothing in the script reads a directive. Its SSR assertions
   (`renderToString(h(ui.Button, …))`, `:88-95`) **cannot** substitute: `react-dom/server` outside an
   RSC bundler ignores `"use client"` entirely, so those two lines pass identically whether the
   directive survived or not. **CONFIRMED.** Action: after install, walk the tarball's `dist/**/*.js`
   and assert the expected set of first lines. That is a five-line addition and it restores the
   guarantee the file was written for.
3. Minor: it never imports `@kanzo-tech/ui/table` or `/analytics`, so it proves nothing about those
   subpaths — neither that they work with their peers nor that they fail cleanly without them.

`.github/workflows/ci.yml` runs build → typecheck → lint → check:generated → test → size → smoke →
docs RSC build → `publint`. That is a strong pipeline; the gaps above are inside the two steps that
claim the export/boundary contracts, not in the pipeline's shape.

### 7c. Components with no test at all — 44 modules

Modules that contribute a public export and whose exports are named in **zero** test file:

```
charts/use-chart-query.ts        composites/MadeWith.tsx      composites/SidebarIdentity.tsx
composites/link.tsx              layouts/section.tsx          simples/DateField.tsx
simples/EmptyState.tsx           simples/FieldArray.tsx       simples/Link.tsx
simples/Ribbon.tsx               simples/TextField.tsx        simples/accordion.tsx
simples/action-bar.tsx           simples/alert-dialog.tsx     simples/badge.tsx
simples/calendar.tsx             simples/checkbox.tsx         simples/clipboard.tsx
simples/command.tsx              simples/date-picker.tsx      simples/dialog.tsx
simples/editable.tsx             simples/file-upload.tsx      simples/floating-panel.tsx
simples/highlight.tsx            simples/hover-card.tsx       simples/kbd.tsx
simples/native-select.tsx        simples/password-input.tsx   simples/pin-input.tsx
simples/progress.tsx             simples/prose.tsx            simples/rating.tsx
simples/resizable.tsx            simples/scroll-area.tsx      simples/separator.tsx
simples/sheet.tsx                simples/spinner.tsx          simples/steps.tsx
simples/tabs.tsx                 simples/tags-input.tsx       simples/toggle.tsx
simples/tour.tsx                 simples/tree-view.tsx
```

`layouts/section.tsx` is the one to fix first: 9 exported parts, a `tv()` recipe with a `scale`
variant, and it is the merge target DESIGN.md:174 designates for three former components.
`simples/dialog.tsx` is second — `alert-dialog`, `sheet` and `tour` all render its parts, so one
untested module carries four families.

Two bespoke parts additionally trip CONVENTIONS.md:89 (*"the bespoke part must **document its ARIA
contract in a comment** and be **covered by a test**"*): `composites/SidebarIdentity.tsx` and
`simples/Ribbon.tsx`. **CONFIRMED.**

---

## 8. IN-FLIGHT notes (54 dirty paths)

- **`packages/ui/src/index.tsx`** — the identity-axis block (`:14-68`) is new. `IdentityNotice` is
  exported (`:67`) and **tested** (`composites/Preferences.test.tsx:231-280`, contrary to a first
  impression), but has **no `docs/content/**` page and no `docs/examples/identity-notice/` directory**
  — a new public export landing below the repo's own doc+example bar. `.changeset/identity-axis.md`,
  `preferences-identity-section.md` and `sub-brand-identities.md` cover the change.
- **`packages/ui/src/composites/Preferences.tsx`** — `PreferencesFieldSet` (`:304`, exported at `:556`
  as an alias of `PrefFieldSet`) is in the un-export list §2c; the barrel comment at `index.tsx:44-46`
  explains why it was added, and the reason ("the panel's own doc said every section is exported flat")
  is a doc bug, not an API gap. Also two inline `style` sites (§6j).
- **`packages/ui/src/composites/identity-notice.tsx`** (untracked) — one `ark.*`-free element? No: it
  renders `null`, so §6a does not apply. Clean on the conformance sweep. `identityRetiredCopy` (`:36`)
  is module-exported and correctly **not** in the barrel.
- **`packages/ui/src/composites/AppearanceToggle.tsx`**, **`theme/KanzoThemeProvider.tsx`**,
  **`theme/theme-script.ts`**, **`theme/prefs-config.ts`** — all dirty; `theme-script.ts` correctly has
  no directive (§5a false positive); `prefs-config.ts` contributes no public export and is correctly internal.
- **`docs/examples/appearance-toggle/example-system.tsx` → `example-follow-os.tsx`** (renamed) plus
  `.changeset/appearance-has-no-system.md` — an axis value is being removed; re-run the variant-value
  census (§2g) after that lands, since `AppearancePref` is a public type (`index.tsx:16`).

---

## Appendix — reproducing these numbers

All in this scratchpad; none writes to the repo.

| Script | Output | What it produces |
|---|---|---|
| `exp-census-ts.mjs` | `exp-census.json` | every export of the 4 entries, with declaration file/line/pos, value-vs-type |
| `exp-usage2.mjs` | `exp-usage2.json` | per-export reference buckets over 826 repo files (worktrees excluded) |
| `exp-internal.mjs` | `exp-internal.json` | symbol-resolved intra-`src` references, keyed on absolute declaration position |
| `exp-final.mjs` | `final3.txt` | the A / B / C bucket partition and the single-example list |
| `exp-graph.mjs` | `reach-*.txt` | static import graph + optional-peer reachability per entry |
| `exp-client.mjs`, `exp-client2.mjs` | `client.txt` | client-boundary classification |
| `exp-ark.mjs`, `exp-slots.mjs`, `exp-slotorder.mjs` | `ark.txt`, `slots.txt`, `slotorder.txt` | §6a–6d, §6g, §6j |
| `exp-variants.mjs`, `exp-props.mjs`, `exp-rename.mjs` | stdout | §2g, §6f |

Two traps that will silently invert the results if you re-derive: exclude `.claude/worktrees/`
(three copies of every symbol otherwise), and key intra-module reference joins on **absolute
declaration position**, not on name (misses aliased exports) and not on line alone (collides with
same-line parameters — `SidebarInput` appeared internally-used because `props` is declared on
`sidebar.tsx:367` too).
