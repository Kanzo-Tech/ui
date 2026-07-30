# Docs-site audit — `docs/content/docs`, `docs/examples`, `docs/showcases`, `docs/components`, `docs/app`

Read-only. 106 MDX pages, 327 example files, 6 showcase directories, 10 docs components.
Every finding below carries `file:line`. Verified against `packages/ui/src/index.tsx`,
`/table`, `/analytics`, `/editor`, `@kanzo-tech/theme` and `@kanzo-tech/palette` — 990 exported
names extracted from source, not from `.planning/`.

---

## Executive summary (10 lines)

1. **The site is structurally sound and factually leaky.** Zero broken internal links, zero broken anchors, zero broken example references, zero API names imported that do not exist. The defects are *claims*, not plumbing.
2. **The most important gap is the one the brief predicted.** Three pages link "the engine rule" to `/docs/philosophy` (`charts.mdx:417`, `table.mdx:16`, `stat-tile.mdx:19`) and that page does not contain it. The three axes, the admission rules, the ladder and the minimality rule are **nowhere on the site at all**.
3. **Seven pages state something false about the code.** Highest: `navigation/sidebar.mdx:41` says `SidebarInset` renders `<main>` — `sidebar.tsx:347` says in a comment that it deliberately does not, and `showcases/app-shell.mdx:17` says the opposite on the same site.
4. **`charts.mdx:559-560` and `:128` document four exports that were deliberately deleted** (`Fixed`, `from`, `plot`, `coordinator`) — `analytics.ts` names all four as gone, with the reasoning.
5. **`links: doc:` frontmatter on 55 pages renders nowhere.** `app/docs/[[...slug]]/page.tsx` never reads `page.data.links`. Half the site carries curated upstream Ark links no reader can see — and DESIGN.md:322 cites that frontmatter as evidence.
6. **`installation.mdx:36` says "Two peers are optional" and omits `/analytics` entirely** — four optional peers and a whole subpath missing from the one page a new consumer reads first. `@kanzo-tech/palette` is also absent from a page titled "Two packages".
7. **A live example is silently dead.** `examples/charts/example-interactor.tsx:69-71` wraps `ChartHighlight` in `Show`; `chart-spec.ts:102-104` skips any descriptor inside a consumer component. The house `Show` rule and the chart grammar are incompatible and nothing says so.
8. **Cohesion is measured, not asserted:** `## Usage` on 86/106, Anatomy 53/106, an API section 75/106, **accessibility/keyboard on 13/106**, `<TypeTable>` on **0/106** despite being registered in `mdx-components.tsx:31`.
9. **Minimality evidence:** 17 pages open by disambiguating themselves from a sibling; 6 mirrored pairs where both halves do it; the same "when to use which" rule is written in 3–5 wordings; 24 sites of migration/legacy prose in an unpublished library, including a 7-row rename table (`layout/section.mdx:43-51`).
10. **39 of 106 pages have no inbound link from any other page** — the whole `overlays/` and `actions/` groups, plus the 596-line `forms/tanstack-form` that `validation.mdx:58` recommends without linking.

---

## 1. Coverage matrix

### 1a. Read-at-a-glance matrix — component family → page → example → parts documented

`parts` = exported values in that module. `on page` = named on its own page. `never` = named on
no MDX page anywhere. Sorted by undocumented parts, then alphabetically.

| Module (`packages/ui/src/`) | Page | Live example dir | parts | on page | never documented anywhere |
|---|---|---|---|---|---|
| `simples/calendar.tsx` | `forms/calendar` | `calendar` (4) | 24 | 12 | `CalendarControl` `CalendarLabel` `CalendarTrigger` `CalendarPresetTrigger` `CalendarContext` `CalendarTableHead` `CalendarTableRow` `CalendarTableHeader` `CalendarTableBody` `CalendarTableCell` (+`CalendarTodayTrigger` `CalendarClearTrigger` used by an example but on no page) |
| `simples/color-picker.tsx` | `forms/color-picker` | `color-picker` (2) | 21 | 15 | `ColorPickerLabel` `ColorPickerView` `ColorPickerFormatTrigger` `ColorPickerFormatSelect` `ColorPickerSwatchPreview` (+`ColorPickerTransparencyGrid` example-only) |
| `simples/tour.tsx` | `overlays/tour` | `tour` (1) | 15 | 11 | `TourActionTrigger` `TourOverlay` `TourPositioner` `TourSpotlight` |
| `simples/toggle-group.tsx` | **none** | **none** | 2 | 0 | `ToggleGroup` (one un-narrated fence at `layout/shell.mdx:54`), `ToggleGroupItem` |
| `simples/alert-dialog.tsx` | **none** (folded into `overlays/dialog`) | `alert-dialog` (2) | 9 | 8 | `AlertDialogBody` |
| `composites/SidebarIdentity.tsx` | **none** (folded into `navigation/sidebar-user`) | `sidebar-identity` (1) | 6 | 6 | — |
| `composites/identity-notice.tsx` **IN-FLIGHT** | **none** | **none** | 1 | 0 | `IdentityNotice` |
| `charts/id-set-client.ts` | **none** | **none** | 1 | 0 | `IdSetClient` |
| `charts/use-chart-query.ts` | `data-display/charts` (hook only) | **none** | 2 | 1 | `Query` |
| `simples/combobox.tsx` | `forms/combobox` | `combobox` (8) | 14 | 12 | `ComboboxContext` `ComboboxPositioner` |
| `simples/select.tsx` | `forms/select` | `select` (7) | 11 | 9 | `SelectContext` `SelectClearTrigger` |
| `simples/sheet.tsx` | `overlays/sheet` | `sheet` (3) | 9 | 7 | `SheetOverlay` `SheetPositioner` |
| `composites/Preferences.tsx` **IN-FLIGHT** | `layout/preferences` | `showcases/preferences` (iframe) | 11 | 10 | `PreferencesIdentity` |
| `composites/sidebar.tsx` | `navigation/sidebar` | `sidebar` (3) | 23 | 22 | `SidebarInput` |
| `simples/checkbox.tsx` | `forms/checkbox` | `checkbox` (3) | 3 | 2 | `CheckboxIndicator` |
| `simples/dialog.tsx` | `overlays/dialog` | `dialog` (3) | 11 | 10 | `DialogPositioner` |
| `simples/listbox.tsx` | `forms/listbox` | `listbox` (5) | 12 | 11 | `ListboxContext` |
| `simples/menu.tsx` | `overlays/menu` | `menu` (7) | 17 | 16 | `MenuPositioner` |
| `simples/popover.tsx` | `overlays/popover` | `popover` (3) | 12 | 11 | `PopoverPositioner` |
| `simples/tree-view.tsx` | `data-display/tree-view` | `tree-view` (2) | 11 | 10 | `TreeViewBranchIndicator` |
| `charts/chart-axes.tsx` | `data-display/charts` | `charts` (31) | 4 | 3 | `ChartFacetY` (example-only) |
| `charts/theme.ts` | `data-display/charts` | `charts` | 2 | 1 | `CHART_CAPACITY_PROPERTY` |
| `charts/chart-inputs.tsx` | `data-display/charts` | `charts` | 3 | 3 | — but `useMosaicInput` (the documented-in-source engine) is on no page |
| **All other 79 modules** | 1:1 page | 1:1 example dir | — | **100 %** | — |

**Aggregate:** 79 of 103 public modules document every exported part. The 24 above account for
**52 exported values that appear on no page**, plus **325 exported names never mentioned in any
MDX page at all** when types, `use*` context aliases and `*Variants` objects are included.

### 1b. Components with **no page** — severity high, they get no card and no llms.txt entry

`docs/content/docs/(root)/components.mdx:11` promises *"a component has a card here exactly when
it has a page"*, which is true — and therefore these are invisible on `/docs/components`:

| Missing page | Evidence | Notes |
|---|---|---|
| `ToggleGroup` / `ToggleGroupItem` | `packages/ui/src/simples/toggle-group.tsx`; only mention is an unexplained fence at `docs/content/docs/layout/shell.mdx:54-56` | **CONFIRMED.** No page, no example dir, no prose. `actions/toggle.mdx` never mentions it. The one export family with zero documentation. |
| `AlertDialog` (9 parts) | `docs/examples/alert-dialog/` (2 files) rendered from `docs/content/docs/overlays/dialog.mdx:76,120` | **CONFIRMED.** Documented, but as a section of Dialog, so no card and no `llms.txt` line. |
| `SidebarIdentity` (6 parts) | `docs/examples/sidebar-identity/` rendered from `docs/content/docs/navigation/sidebar-user.mdx:74` | **CONFIRMED.** Same shape. `navigation/sidebar.mdx:79` cross-links it correctly. |
| `IdentityNotice`, `IdentityRetiredCopy` | `packages/ui/src/composites/identity-notice.tsx`; barrel `index.tsx:63-65` | **CONFIRMED, IN-FLIGHT.** New export, zero docs. |
| `PreferencesIdentity` | `packages/ui/src/composites/Preferences.tsx:557`; barrel `index.tsx:47` | **CONFIRMED, IN-FLIGHT.** See §1c-3. |
| `IdSetClient`, `useMosaicInput`, `Query`, `makeClient`, `clausePoint*`, `clauseInterval*`, `clauseMatch`, `loadCSV/JSON/Parquet/Spatial/Extension`, `compileChartSpec`, `buildChartSpec`, `chartSpecSignature`, `column`, `numbers` | `packages/ui/src/analytics.ts` | **CONFIRMED.** The `/analytics` barrel spends ~40 lines of comment explaining the Mosaic-client protocol and the Arrow-column fallback; none of it reaches a page. `charts.mdx` documents the grammar, not the protocol. |
| `@kanzo-tech/palette`: 90 of ~100 exports | `packages/palette/src/*` | **CONFIRMED.** `(root)/theming.mdx` documents `derivePalette`, `compile`, `PALETTE_SEEDS`, `seedInput`, `BASE16_SLOTS`. `checkRamp`, `checkScheme`, `resolveRoles`, `ROLES`, `deriveRamp`, `deriveOrderedScheme`, `OBLIGATIONS`, `alphaOver`, `contrastRatio`, `PALETTE_SCHEMA_VERSION`, `TenantPalette`, `PaletteRecord`… have no page. A tenant-onboarding consumer has the theming page's narrative and no API. |
| `@kanzo-tech/theme`: `AXES`, `DEFAULT_PREFS`, `STORAGE_KEY`, `themeData`, `KanzoRadius`/`KanzoDensity`/`KanzoFont`/`KanzoMonoFont`/`KanzoIdentity`, `IdentityOption`, `AppearancePref` | `packages/theme/src/index.ts` | **CONFIRMED.** `theming.mdx` names `DEFAULT_PREFS` once (`layout/preferences.mdx:56`). `AXES` — the axis table CONVENTIONS.md:125 calls a distribution deliverable — is named in no page. |

### 1c. Pages that document something that does not exist — **highest severity**

**1c-1 — `data-display/charts.mdx:559-560` and `:128` document four deleted exports. CONFIRMED.**

```
559: Re-exported so a whole chart is written without a direct `@uwdata` import: `count` `sum` `avg`
560: `min` `max` `median` `quantile` `stddev` `mode` `bin` `sql` `Fixed`, plus `from` and `plot` for the
     [escape hatch](#escape-hatches), `Coordinator` `Selection` `coordinator` `wasmConnector`, …
128: `Coordinator`, `Selection`, `coordinator` and `wasmConnector` are re-exported from the subpath, …
```

`packages/ui/src/analytics.ts` (the "one rule" comment above the re-export block) says verbatim:
*"Four exports failed that rule and are gone: `coordinator` (vgplot's process-wide
active-coordinator setter — `MosaicProvider` is the only thing that should ever call it), `Fixed`
(a scale-domain sentinel …), and `from` / `plot`, which claimed to complete the `ChartRaw` hatch
and did not."* None of the four is in the 990-name export map.
**Contradicts:** the brief's no-legacy rule and the barrel's own reasoning.
**Action:** delete `Fixed`, `from`, `plot` from line 560 and `coordinator` from lines 128 and 561;
replace the `#escape-hatches` sentence with the six axis marks (`axisX` `axisY` `axisFx` `axisFy`
`gridFx` `gridFy`) that `analytics.ts` says are what `ChartRaw` is actually for.
**Confidence:** CONFIRMED.

**1c-2 — `navigation/sidebar.mdx:41` claims `SidebarInset` renders `<main>`. It does not. CONFIRMED.**

```
41: `SidebarInset` renders the `<main>` landmark. The library allows **exactly one `<main>` per
33:     {children}                          {/* the page — this owns the <main> */}
```

`packages/ui/src/composites/sidebar.tsx:347-349`:
*"A neutral offset column, not `<main>`: the content shell goes inside it and `ShellMain` owns the
landmark"* → `ark.div`.
Contradicted **on the same site** by `docs/content/docs/showcases/app-shell.mdx:17`:
*"`SidebarInset` carries no landmark; `ShellMain` owns the page's …"*.
And by DESIGN.md:143: *"**`SidebarInset` is a neutral offset `<div>`, not a `<main>`** … (shadcn
makes `SidebarInset` the `<main>` because it has no separate region layer; we do.)"*
Repeated a third time at `docs/content/docs/(root)/styling.mdx:102`
(*"Exactly one `<main>` per page — `ShellMain` / `SidebarInset` own it"*) and in CONVENTIONS.md:92.
**Why it matters:** a reader following the sidebar quickstart ships a page with **no `<main>`
landmark** and a broken skip-link — the exact conformance failure DESIGN.md:141 exists to prevent.
**Action:** fix `sidebar.mdx:33,41` and `styling.mdx:102`; fix CONVENTIONS.md:92 in the same pass
so the three sources agree with `sidebar.tsx:347`.
**Confidence:** CONFIRMED.

**1c-3 — `layout/preferences.mdx` documents four sections; there are five. CONFIRMED, IN-FLIGHT.**

- `:40` *"Four sections, and none of them is a hue."*
- `:63-70` anatomy tree lists `Density` / `Radius` / `Font` / `MonoFont`.
- `:186-190` the Sections API table has exactly those four rows.

`packages/ui/src/composites/Preferences.tsx:226` renders `<IdentitySection />`; `:534` exposes
`Identity:` on the namespace; `:557` exports `PreferencesIdentity`; `index.tsx:44-47` exports it
with the comment *"First, and the only section that can vanish"*. `Preferences.tsx:38` even shows
`<Preferences.Identity />` in its own JSDoc example.
The claim "none of them is a hue" is now **false in the strongest possible way** — the new section
is *specifically* the colour identity.
**Action:** add a fifth row, a fifth anatomy line, and rewrite the "Colour is not a preference"
callout to say what `Preferences.tsx:51` says: an identity chooses among blocks the *tenant*
published, which is not the same thing as a user picking a hue.
**Confidence:** CONFIRMED. **IN-FLIGHT** (`packages/ui/src/composites/Preferences.tsx`,
`packages/theme/src/index.ts`, `packages/ui/src/theme/prefs-config.ts`,
`packages/ui/src/composites/identity-notice.tsx`).

**1c-4 — `installation.mdx:36-42` says two optional peers; there are six, across three subpaths. CONFIRMED.**

```
36: Two peers are **optional**, needed only if you import the matching subpath:
39: | `@kanzo-tech/ui/table`  | `@tanstack/react-table` |
40: | `@kanzo-tech/ui/editor` | `@codemirror/*`, `@lezer/highlight` |
```

`packages/ui/package.json` `peerDependenciesMeta` marks **`@uwdata/vgplot`, `@uwdata/mosaic-core`,
`@uwdata/mosaic-sql`, `@duckdb/duckdb-wasm`** optional too, and `exports` publishes
`./analytics`. The row is missing. `data-display/charts.mdx:88-95` has its own install block, so
the information exists — but the page whose job is installation presents an enumeration
("Two peers") that is wrong.
Second omission on the same page: the title is *"Two packages, one stylesheet, one provider"* and
`:12` says installing `@kanzo-tech/ui` brings `@kanzo-tech/theme`. There is a **third** package —
`(root)/theming.mdx:224` says *"Install `@kanzo-tech/palette` where you onboard a tenant"* — and
`installation.mdx` never names it.
**Action:** add the `/analytics` row; add a short "and one you install only to onboard a tenant"
step pointing at `theming.mdx`.
**Confidence:** CONFIRMED.

**1c-5 — `app/(home)/page.tsx:39` says "Six axes". CONFIRMED.**

```
39: body="Six axes as data-* attributes on <html>. Change one and every component follows, overlays included."
```

`(root)/theming.mdx:15-22` documents **four** `data-*` axes (`data-radius`, `data-font`,
`data-mono-font`, `data-font-size`) plus appearance, which is a **class**, not an attribute.
`packages/theme/src/index.ts` adds a fifth `data-*` (`data-identity`) in-flight. Six is wrong
before and after the in-flight work.
**Action:** "Four axes as `data-*` attributes on `<html>`, plus light/dark" — or five once identity
lands. **Confidence:** CONFIRMED.

**1c-6 — `layout/section.mdx:43-51` is a 7-row migration table for deleted components. CONFIRMED.**

```
42: | Was | Now |
45: | `PageShell` | `SectionRoot` |
46: | `PageShellHeader` / `SectionHeader` / `TopBarMain` | `SectionHeader` |
…
51: | `PageShellContent` | `SectionBody` |
86: `SectionHeader` is a flex row. `PageShellHeader` used a two-column grid so its actions could …
```

Fourteen names in that table exist nowhere in the codebase (`PageShell*`, `TopBar*`,
`SectionHeaderTitle`, `SectionHeaderDescription`, `SectionHeaderActions`, `SectionHeaderContent`).
**Contradicts:** the brief — *"Docs describing a migration path, a deprecated prop, or an old API
are deletion candidates: the packages are unpublished, nothing needs a migration note."*
**Action:** delete lines 38-51 and 86. Keep the `CardHeader`/`DialogHeader` callout at `:53-58`
— that is the **header rule** (DESIGN.md:182-188), which is reasoning, not history — and promote
it to the philosophy page (see §3).
**Confidence:** CONFIRMED.

**1c-7 — `data-display/prose.mdx` never names the class the component actually ships. CONFIRMED.**

The page is 52 lines about a component whose entire purpose is a class name, and the class is
`kanzo-prose` (`packages/ui/src/styles.css:18-19`, `@plugin "@tailwindcss/typography" { className:
kanzo-prose }`). The word appears zero times in the page. `styles.css:13-16` explains the rename
was made *because* an unscoped `.prose` repainted fumadocs — a consumer-facing fact.
Note also that `.planning/DOCS-QUALITY.md:138-148` (§5.1) records this as an open `packages/ui`
defect; it was fixed in commit `5f0fa20` *"fix(ui): scope the typography plugin…"*, and the
containment rule §1.1 says was added to `docs/app/global.css` is **not present** in that file
(verified: `docs/app/global.css` has no `.prose` rule). DOCS-QUALITY §1.1/§5.1/§7.1 are stale.
**Action:** name `kanzo-prose` on the page, and mark DOCS-QUALITY §5.1 FIXED.
**Confidence:** CONFIRMED.

**1c-8 — `forms/validation.mdx:95-99` documents an unbuilt part. CONFIRMED, medium.**

*"the answer will be a new **part** — `FieldWarning`, alongside the thirteen that already
exist"*. `FieldWarning` does not exist.
**Contradicts:** DESIGN.md:219 *"Do not add a model before the existing parts have a consumer"*
and admission rule 2 (proven demand). The callout is a design note, and design notes belong in
`.planning/`, not on a consumer page that reads as an API promise.
**Action:** delete the callout. Keep `:91-93` ("the library owns presentation; the product owns
production"), which is the real rule.
**Confidence:** CONFIRMED.

**1c-9 — `data-table.mdx:13-14` abbreviates exports into names that do not exist. CONFIRMED, low.**

*"`DataTableRoot` / `Toolbar` / `Search` / `FacetFilter` / `ViewOptions` / `Content` /
`Pagination`"* — the real exports are `DataTableToolbar`, `DataTableSearch`,
`DataTableFacetFilter`, `DataTableViewOptions`, `DataTableContent`, `DataTablePagination`
(`packages/ui/src/table.ts:19-31`). `FacetFilter` *is* a different, root-barrel export
(`simples/FacetFilter.tsx`), so the abbreviation collides with a real name.
**Action:** spell them out. **Confidence:** CONFIRMED.

**1c-10 — `forms/controls.mdx` omits `Editable` from the Text table. CONFIRMED, low.**

`docs/content/docs/forms/meta.json:13` files `editable` under `---Text---`; `forms/editable.mdx`
exists; the "Controls" index — the page whose frontmatter says *"Every form control in the
library"* and *"A table index — start here"* — has no `Editable` row (`forms/controls.mdx:19-26`).
`forms/editable` also has **zero inbound links** (§4).
**Action:** add the row. **Confidence:** CONFIRMED.

### 1d. Verified clean (so nobody re-checks)

- **Zero** MDX code-fence imports of a name that is not exported (checked all 106 pages against the 990-name map).
- **Zero** example/showcase/component imports of a non-existent `@kanzo-tech/*` name.
- **Zero** deep-path imports — nothing imports `@kanzo-tech/ui/simples/...`; every example uses the barrel or a published subpath.
- **Zero** `<ComponentPreview>` pointing at a missing file (321 refs, all resolve).
- **Zero** raw Tailwind palette classes (`bg-slate-700` etc.) anywhere in `docs/`.
- Raw hex appears only in `examples/swatch/*` and `examples/color-picker/*` — the sanctioned "a colour that is data" exception, CONVENTIONS.md:82.
- **`.planning/DOCS-QUALITY.md:66-68` is wrong**: it says *"One orphan example directory: `docs/examples/form/` is referenced by no page"*. `docs/content/docs/forms/tanstack-form.mdx` references `form/tanstack` **20 times** (lines 24, 287, 294, 301, 312, 322, 336, 348, 356, 364, 378, 389, 397, 414, 421, 428, 439, 448, 456, 479). Do not delete it. CONFIRMED.
- Related: **DESIGN.md:272 cites `docs/examples/form/tanstack/example-card-radio-group.tsx`** as `CardRadioGroup`'s genuine second call site. That file does not exist (the directory has `example-radio-cards.tsx`), and `index.tsx:190-193` records that `CardRadioGroup` was deleted. DESIGN.md's own evidence is stale. CONFIRMED.

---

## 2. Organisation

The IA the site presents: Getting started (7 pages), Forms (31), Actions (7), Navigation (11),
Data display (18), Overlays & feedback (13), Layout (14), Showcases (4). Config:
`docs/content/docs/meta.json` (root order), one `meta.json` per group,
`docs/source.config.ts`, `docs/app/docs/layout.tsx` (sidebar tree filter).

### 2-1. DESIGN.md:321-328's `Command` claim — **both halves CONFIRMED true**

- *"Filed under `actions/`, not `forms/`"* → `docs/content/docs/actions/command.mdx` exists and `docs/content/docs/actions/meta.json:3` lists `"command"` in `actions`. ✔
- *"which is why `forms/controls.mdx` must still cross-link it rather than list it as a control"* → cross-linked **twice**, and correctly framed both times: `forms/controls.mdx:59-63` (*"A further face of that same machine, [`Command`](/docs/actions/command), is not a form control at all: what it captures is an **action**, so it is filed under actions"*) and `forms/controls.mdx:83-88` (the honest-exception paragraph). It appears in **no** control table. ✔

This is the best-executed IA decision on the site and should be the model for the rest.

### 2-2. `SegmentGroup` is filed against its own page's argument. CONFIRMED, high.

`docs/content/docs/navigation/segment-group.mdx:11-13`:
> *"This is Ark's radio group underneath — verifiably: `@ark-ui/react/segment-group` re-exports
> `@zag-js/radio-group`, and the root renders `role="radiogroup"`. **It selects a value and belongs
> in a form, next to `RadioGroup`**, whose semantics it has with a segmented look."*

It is filed in `docs/content/docs/navigation/meta.json:3`. `forms/controls.mdx:37` lists it as a
Choice control and links *out* of Forms to reach it.
**Contradicts:** DESIGN.md:298 — *"if closing the surface leaves state, it is a listbox; if it
leaves only an effect, it is a menu"*. SegmentGroup leaves state. Also the page's own sentence.
Worse: `.planning/DOCS-QUALITY.md:61-63` records the "fix" as *rewriting the link* from
`/docs/forms/segment-group` to `/docs/navigation/segment-group` — i.e. the link was bent to match
a filing the page itself argues against.
**Action:** move `segment-group.mdx` to `forms/`, under `---Choice---`, beside `radio-group`.
Redirect the two inbound links (`actions/button-group.mdx:32`, `forms/controls.mdx:37`).
**Confidence:** CONFIRMED.

### 2-3. `layout/` is not an axis a reader can predict. CONFIRMED.

`docs/content/docs/layout/meta.json:3` reads:
`["shell","section","resizable","scroll-area","floating-panel","---Utilities---","client-only","show","separator","float","accordion","collapsible","preferences","appearance-toggle","made-with"]`

Under one heading: two structural regions (`shell`, `section` — DESIGN.md Axis 1), two Ark
behaviour machines (`accordion`, `collapsible` — Axis 3, disclosure), two render-control helpers
that produce no DOM (`show`, `client-only`), two **theming controls** (`preferences`,
`appearance-toggle`), a positioning primitive (`float`), a link badge (`made-with`), a rule
(`separator`), and a scroll container (`scroll-area`).
**Contradicts:** DESIGN.md:31-52 — *"When deciding where something belongs, name its axis first…
A part should sit on one axis."* `layout/` is the group with no axis. Ark files Accordion and
Collapsible under *disclosure*; Shark under components, never layout.
**Action:** see the proposed tree at the end. `preferences` + `appearance-toggle` belong with
`theming`; `accordion` + `collapsible` become one **Disclosure** page; `show` + `client-only`
become one **Rendering** page (or a section of `styling`); `made-with` is a deletion candidate.
**Confidence:** CONFIRMED.

### 2-4. `data-display/` mixes display with input. CONFIRMED.

`docs/content/docs/data-display/meta.json:3` puts `code-editor` under a `---Content---`
separator with `prose`, `kbd`, `highlight`. `CodeEditor` is a **control** — `packages/ui/src/editor.ts:11-13`
says so in writing: *"It was never a layout: its props are `value` / `onChange` / `extensions` /
`readOnly`, i.e. a control"*. `forms/controls.mdx:143` already lists it as an AI-assisted control
and links to `forms/ai`, not to `data-display/code-editor`.
**Action:** move `code-editor` into Forms (Text), or into a `Editors` group with the AI pages.
**Confidence:** CONFIRMED.

### 2-5. `overlays/` is really two groups wearing one title. CONFIRMED, low severity.

Title is *"Overlays & feedback"* (`docs/content/docs/overlays/meta.json:2`) and the file uses a
`---Feedback---` separator at index 8. Eight overlay machines + five feedback components. The
title admits the split; the tree should make it.

### 2-6. Divergence from the references, with and without reason

| Us | Ark / Shark / shadcn | Reason on the site? |
|---|---|---|
| `SegmentGroup` in `navigation/` | Ark: `docs/forms/segment-group` (the page's own frontmatter link, `segment-group.mdx:5`) | **No.** Divergence with the page arguing against itself. |
| `Accordion`/`Collapsible` in `layout/` | Ark: disclosure | **No.** |
| `Command` in `actions/` | Shark: its own top-level page; Ark: `docs/forms/combobox` | **Yes** — argued at DESIGN.md:321-328 and `forms/controls.mdx:59-63`. Model case. |
| No `Autocomplete` page | Shark ships one | **Yes** — `forms/combobox.mdx:12`, `forms/controls.mdx:57-63`. |
| No `ContextMenu*` family | Shark ships ten exports | **Yes** — `overlays/menu.mdx:162-165`, though the prose is history (§6). |
| `Table` + `DataTable` split across subpaths | shadcn has one | **Yes** — the engine rule … which is not on the site (§3-1). |
| `ListboxShortcut` withheld | Shark ships it | **Yes** — `forms/listbox.mdx:72-74`. |
| `Prose` as `kanzo-prose` | Tailwind typography's `.prose` | **No** — the page never says it (§1c-7). |

### 2-7. Config-level defects in the IA machinery

**2-7a — `docs/source.config.ts:5-6` describes a schema extension that does not exist. CONFIRMED.**
The comment: *"MDX under content/docs, frontmatter extended with upstream links so a component
page can point at the Ark UI docs it wraps."* The call is a bare `defineDocs({ dir:
"content/docs" })` — no `docs: { schema: … }`. The `links.doc` frontmatter on 55 pages is
therefore unvalidated **and** unrendered (see §4-1).

**2-7b — `docs/lib/component-groups.ts:41` gates full-bleed on groups that do not exist. CONFIRMED.**
```
41: const FULL_BLEED_GROUPS = new Set(["showcases", "sidebar"]);
```
There is no `sidebar` group (sidebar pages live in `navigation/`), and every `showcases/` page
uses `<PreviewIframe>`, not `<ComponentPreview>`. So `isFullBleedComponent()` returns `false` for
every slug on the site, and all 8 full-bleed previews pass the prop by hand
(`layout/shell.mdx:6`, `navigation/sidebar.mdx:10,118,122`, `navigation/sidebar-nav.mdx:6,67`,
`navigation/instance-switcher.mdx:6`, `navigation/sidebar-user.mdx:6`).
`docs/components/component-preview.tsx:20-24` documents the dead mechanism at length:
*"Left undefined it is **derived** — a page in the `layouts` or `blocks` group is full-bleed"* —
and neither `layouts` nor `blocks` is a group. `navigation/sidebar-user.mdx:74` passes
`fullBleed={false}` "to override" a default that is already `false`: a no-op.
**Action:** either add `layout` and `navigation`'s sidebar family to the set and drop the
hand-passed props, or delete `isFullBleedComponent` and the doc comment. Do not leave both.

**2-7c — `docs/next.config.ts:7-11` claims the docs consume source. They consume `dist`. CONFIRMED.**
*"The design system is consumed from source here so a change shows up without a rebuild."*
`docs/tsconfig.json` has only `@/*` in `paths`; there is no alias for `@kanzo-tech/ui`, so
resolution goes through `packages/ui/package.json` `exports` → `./dist/index.js`.
`docs/app/global.css:11` gets it right: *"the docs eat the published artifact"*.
This comment is exactly what makes the known trap a trap.
**Action:** correct the comment to say what `transpilePackages` is actually for here — letting
Next process the workspace package's `"use client"` directives and CSS.

**2-7d — `app/view/showcases/[name]/page.tsx:18` names the map `BLOCKS`.** Vestige of
DESIGN.md's `docs/blocks/`. See §5-1.

---

## 3. Cohesion as a reference — **the most important section**

### 3-1. The design reasoning is not on the site, and three pages link to a page that does not carry it. CONFIRMED, highest severity.

```
docs/content/docs/data-display/charts.mdx:417   [the engine rule](/docs/philosophy), the same one behind `Table` and `DataTable`.
docs/content/docs/data-display/table.mdx:16     This pair is a **rule, not a one-off** — see [the engine rule](/docs/philosophy). …
docs/content/docs/data-display/stat-tile.mdx:19 … that split is [the engine rule](/docs/philosophy), the same one behind
```

`docs/content/docs/(root)/philosophy.mdx` is 71 lines. The word "engine" does not appear in it.
Its four `##` sections are: The three layers · Adopt, don't rebuild · Domain-free · The client
boundary. The link resolves (HTTP 200 — the orchestrator verified all 106 routes), which is why
no link checker catches it. **A reader who follows it three times finds nothing three times.**

The full inventory of DESIGN.md reasoning against its presence on the site:

| Rule | DESIGN.md | On the site? | Where it belongs |
|---|---|---|---|
| **The engine rule** (presentational in root, connected on the subpath; a part belongs on a subpath only if it imports that subpath's engine) | `DESIGN.md:66-89` | **NO** — linked 3× to a page that lacks it | `philosophy.mdx`, new `## The engine rule` |
| **The three axes** (Structure / Content / Behaviour; a part sits on one) | `DESIGN.md:30-52` | **NO** — string "three axes" absent from all 106 pages | `philosophy.mdx`. This is also the fix for §2-3: the group names should name the axis. |
| **The layers** (`simples/` / `composites/` / `layouts/`, flat barrel) | `DESIGN.md:55-64`, CONVENTIONS.md:8-20 | **NO** | `philosophy.mdx` |
| **The admission rules** (domain-free · proven demand · wraps not reinvents · single axis) | `DESIGN.md:208-216` | Partly — *"admission rule"* is name-dropped at `navigation/sidebar.mdx:84` and `sidebar-user.mdx:27` for the auth clause only. The four rules are nowhere. | `philosophy.mdx` |
| **The ladder** (prop → composition+`data-*` → `asChild` → provider/slot → new component) | `DESIGN.md:242-259` | **NO**. `styling.mdx:45-86` teaches rungs 1-3 as *restyling*, never as the ladder, and never says "reach for a new component last". | `philosophy.mdx` — and it is the natural home for the minimality rule |
| **Minimality** ("las piezas fundamentales para crecer"; generic is the system, specific is an example) | new; partly `DESIGN.md:14-26` | Half — `(root)/showcases.mdx:8-14` states the arrangement half well. The *component* half is absent. | `philosophy.mdx` + `showcases.mdx` |
| **A menu is a command; a listbox is a value** | `DESIGN.md:286-341` | **YES**, well — `forms/controls.mdx:74-97`. Reachable from `select`, `listbox`, `menu`, `command`. Best-executed rule on the site. | keep canonical there; link from `philosophy.mdx` |
| **The naming rule** (`kebab-case` primitive, `PascalCase` convenience) | `DESIGN.md:91-101` | **Partly** — `forms/controls.mdx:10-16` callout, scoped to forms; `app/llms.txt/route.ts:40` states it for machines. DESIGN.md says it *"explains half the library"*; the site says it explains half the forms. | promote to `philosophy.mdx`, keep the forms callout as a link |
| **Export naming: flat, never dot-notation** | CONVENTIONS.md:94-104 | **YES** — `styling.mdx:107-113`. But contradicted, see §3-2. | keep |
| **Validation: the library displays errors, products produce them** | `DESIGN.md:192-204` | **YES** — `forms/validation.mdx:91-93`. Excellent. | keep |
| **The header rule** (a header wired to a machine stays with its machine) | `DESIGN.md:182-188` | **YES** but buried — `layout/section.mdx:53-58`, inside a section that is otherwise a migration table slated for deletion (§1c-6) | move to `philosophy.mdx` before deleting the table around it |
| **Exactly one `<main>`; logical properties; a region declares no role** | `DESIGN.md:139-162` | Partly and wrongly — `styling.mdx:102` states the `<main>` rule with the false `SidebarInset` clause (§1c-2); `layout/shell.mdx` covers regions; logical properties appear nowhere as a rule | `philosophy.mdx` + `layout/shell.mdx` |
| **Themeable vs structural** (the recipe test) | CONVENTIONS.md:74-77 | **YES** — `styling.mdx:6-44,88-104`. Good. | keep |

**Action.** `philosophy.mdx` grows from 71 lines to the page the site is missing, with one
`##` per rule and an anchor per rule, so `charts.mdx:417` can link
`/docs/philosophy#the-engine-rule` and land somewhere. This is the single highest-value change in
this report: DESIGN.md is a repo file, and *"the design reasoning is the product"* means it has to
be on the site or it is not shipped.
**Confidence:** CONFIRMED.

### 3-2. The site contradicts itself on dot-notation. CONFIRMED.

- `(root)/styling.mdx:107-113`: *"Parts are exported flat, not as namespaces… Not `Dialog.Content`. Flat exports tree-shake per part and match Shark."*
- `layout/preferences.mdx:83-86` (a `warn` callout): *"Use the **flat** parts (`PreferencesFont`), not the `Preferences.Font` statics… `Preferences.Font` reads back as `undefined` there. We hit this for real."*
- And yet `layout/preferences.mdx` uses the statics as its own API-reference headings — `:161` `### Preferences.Root`, `:169` `### Preferences.Panel`, `:177` `### Preferences.Trigger` — and `:186-190` has a dedicated **`Static`** column advertising `Preferences.Density`, `Preferences.Radius`, `Preferences.Font`, `Preferences.MonoFont`.

The library really does ship them: `packages/ui/src/composites/Preferences.tsx:515`
`Object.assign(...)`, with `Identity:` added at `:534` **IN-FLIGHT**.
**Contradicts:** CONVENTIONS.md:103-104 — *"A component may only export dot-notation if it also
exports the flat names; **no component does today**, and adding one would make the library speak
two dialects."* One component does, and the docs teach both dialects on one page while warning
against one of them.
**Action:** pick one. Under the minimality steer the answer is to drop the `Object.assign`
namespace from `Preferences.tsx` and rewrite `preferences.mdx:63-70,161-190` in flat names —
which also deletes the `Static` column and the `warn` callout. Docs-side: retitle the API
headings to `PreferencesRoot` / `PreferencesPanel` / `PreferencesTrigger` regardless.
**Confidence:** CONFIRMED. **IN-FLIGHT.**

### 3-3. One voice, several skeletons. Measured.

| Section | Pages carrying it | of 106 |
|---|---|---|
| `## Usage` | 86 | 81 % |
| An API / Props / Reference section | 75 | 71 % |
| `## Anatomy` | 53 | 50 % |
| `links: doc:` frontmatter | 55 | 52 % |
| An Accessibility / Keyboard / ARIA section | **13** | **12 %** |
| `<TypeTable>` | **0** | **0 %** |
| `<Callout>` | 84 uses over ~50 pages | — |

**Voice:** one, and it is good. The house register — name the decision, say what was rejected, say
why, cite a measurement — is consistent across `theming.mdx`, `forms/controls.mdx`,
`forms/index.mdx`, `data-display/charts.mdx`, `forms/validation.mdx`, `data-display/status.mdx`,
`overlays/skeleton.mdx:15-20`, `navigation/segment-group.mdx:9-17`. There is no second voice.
The inconsistency is **structural**, not tonal.

**3-3a — Accessibility is a normative concern with 12 % coverage. CONFIRMED, high.**
CONVENTIONS.md:87-89: *"'accessibility comes from Ark' is not true of this codebase… the bespoke
part must document its ARIA contract in a comment and be covered by a test — and must never
declare a composite role (`toolbar`, `listbox`, `tree`, `grid`, `tablist`) without implementing
that role's keyboard contract."* Yet no page carries a keyboard table for `Listbox`, `Combobox`,
`TreeView`, `Menu`, `Tabs`, `Steps`, `Sidebar`, `TagsInput`, `Command`, `Calendar` or `DataTable` —
the ten components a reader most needs one for. The 13 pages that do have such a section are
`actions/button`, `actions/toggle`, `data-display/badge`, `card`, `chart-gallery`, `item`, `kbd`,
`status`, `layout/appearance-toggle`, `navigation/link`, `tabs`, `overlays/alert`, `sheet`.
**Action:** a `## Keyboard` table on every page whose component declares a composite role. This is
also the missing half of the "reference-grade" claim on `(root)/index.mdx:20-27`.

**3-3b — `<TypeTable>` is registered and never used. CONFIRMED.**
`docs/mdx-components.tsx:8,31` imports and registers it; 0 of 106 pages use it. Same for
`Accordion`/`Accordions` (`:2,24-25`) and `File`/`Files`/`Folder` (`:4,28-30`) — 0 uses each.
`.planning/DOCS-QUALITY.md:122-126` raised this as a **DECISION** ("pick one — `<TypeTable>` reads
better and is already imported") and it is still unsettled; the count has moved from 41-of-115
pages with no API table to 31-of-106, so the long tail was partly closed by hand-written tables
instead.
**Action:** settle it. Either adopt `<TypeTable>` and convert, or delete the three unused
registrations from `mdx-components.tsx` and standardise on the markdown table.

**3-3c — Callouts still have no rule.** DOCS-QUALITY §4 raised it; 84 uses, and they carry
everything from the load-bearing decision (`charts.mdx:26`, `forms/controls.mdx:10`) to an aside
(`data-display/badge`). Suggested rule, unchanged from DOCS-QUALITY:129 — *a callout is for a
thing that will bite the reader, not for emphasis.*

**3-3d — `## Usage` is import-only on the thin pages.** e.g. `data-display/card.mdx:8-12`,
`overlays/skeleton.mdx:7-11`, `forms/switch.mdx`, `layout/separator.mdx`. On those pages the
section adds nothing the Code tab does not already show.

### 3-4. The minimality symptom count — pages that must disambiguate themselves

**17 pages open by distinguishing themselves from a sibling.** The diagnostic subset is the
**mirrored pairs** — where *both* halves spend their opening on the other:

| # | Pair | Evidence | Verdict |
|---|---|---|---|
| 1 | `navigation/breadcrumb` ↔ `navigation/breadcrumbs` | `breadcrumb.mdx:10` *"**Breadcrumb vs [Breadcrumbs]**: the plural one is built on this"*; `breadcrumbs.mdx:8` *"**Breadcrumbs vs [Breadcrumb]**: this is the data-driven one"* | **Merge into one page.** Textbook: the naming rule (`DESIGN.md:91-101`) already says the relationship is primitive + convenience, which is a section, not a page. |
| 2 | `navigation/tabs` ↔ `navigation/segment-group` | `tabs.mdx:10` and `segment-group.mdx:10`, both *"they look alike and share no semantics"* | **Keep two pages** (different ARIA roles) but move `segment-group` to Forms (§2-2); the "vs" belongs once, in `forms/controls.mdx`. |
| 3 | `data-display/table` ↔ `data-display/data-table` | `table.mdx:10` *"**Table vs [Data Table]**: this one is markup only"* | **Merge into one page** with two sections. The engine rule justifies two *components*, not two pages — and both pages already link to the engine rule that isn't there (§3-1). |
| 4 | `forms/date-field` ↔ `forms/date-picker` ↔ `forms/calendar` | 3 pages, one Ark machine + one convenience; `forms/controls.mdx:117-119` disambiguates all three in three table rows | **Merge into one Dates page.** `calendar.mdx` documents 12 of 24 parts (worst coverage on the site). |
| 5 | `forms/input` ↔ `forms/text-field` ↔ `forms/textarea` ↔ `forms/input-group` | `controls.mdx:19-26`; `input.mdx` is 28 lines with no API table, `textarea.mdx` 35 | **Merge into one Text inputs page.** |
| 6 | `overlays/spinner` ↔ `overlays/skeleton` ↔ `data-display/progress` | the spinner-vs-progress-vs-skeleton decision table exists at `overlays/spinner.mdx` per DOCS-QUALITY:106 | **Merge into one Loading page.** |
| 7 | `layout/accordion` ↔ `layout/collapsible` | `collapsible.mdx` is Accordion's item without the group | **Merge into one Disclosure page.** |
| 8 | `navigation/sidebar` ↔ `sidebar-nav` ↔ `sidebar-user` ↔ `instance-switcher` (+ `SidebarIdentity` with no page) | `sidebar.mdx:73` *"## Which identity component?"* — a table whose only job is to disambiguate three of its own siblings | **Merge into one Sidebar page** with sections. `sidebar.mdx` is already 205 lines of "this page is both the guide and the reference" (`:8`). |
| 9 | `layout/preferences` ↔ `layout/appearance-toggle` | `preferences.mdx:47-58` is a callout explaining why the toggle is not a section of the panel | **Merge into one Theme controls page**, in a `theming/` group. |
| 10 | `forms/select` ↔ `listbox` ↔ `combobox` ↔ `native-select` ↔ `facet-filter` ↔ `tags-input` + `forms/controls` | `## When to use which` on `select.mdx:46`, `listbox.mdx:49`, `tags-input.mdx:57`, `number-install.mdx:43`; **`forms/controls.mdx` exists solely to disambiguate this cluster** | **Keep the pages** (six real machines) but **delete the four per-page "when to use which" sections** and make `controls.mdx` the single answer (§6-1). |
| 11 | `data-display/swatch` ↔ `forms/color-picker` ↔ `data-display/status` | `swatch.mdx:28` *"## Swatch or ColorPicker"*; `status.mdx:63` *"## Status or Swatch"* | Keep; these are genuinely one-line rules, correctly placed. |

**A 31-page Forms group is a catalogue, not a system.** The 10 merges above take the site from
106 pages to ~82 without losing a sentence of reasoning — and every merge removes a paragraph
whose only job was to apologise for the split.

---

## 4. Cross-linking

### 4-1. `links: doc:` frontmatter renders nowhere. CONFIRMED, high.

55 of 106 pages carry e.g. `docs/content/docs/forms/select.mdx:4-5`
(`links:\n  doc: https://ark-ui.com/docs/forms/select`).
`docs/app/docs/[[...slug]]/page.tsx:16-21` renders `DocsTitle`, `DocsDescription`, `DocsBody` and
nothing else; `grep -rn "data\.links" docs/app docs/components docs/lib` → **zero hits**.
`docs/source.config.ts:5-6` claims the frontmatter is *"extended"* for exactly this purpose
(§2-7a). Shark UI renders these as a link row under the title; we collect them and drop them.
**Consequences:** (a) 55 curated upstream links are invisible; (b) DESIGN.md:322 reasons from
`links.doc` (*"Its `links.doc` points at `ark-ui.com/docs/forms/combobox`"*) about a field a reader
can never check; (c) `actions/button.mdx:5` points at `ark-ui.com/docs/simples/factory` — a URL
that looks wrong (`simples` is *our* directory name, not Ark's) and nothing surfaces it for review.
**Action:** render it in `page.tsx` (`DocsPage`'s `tableOfContent`/`footer` slot or a small badge
row), then audit the 55 URLs. This is a one-file change that recovers half the site's cross-links
to upstream.
**Confidence:** CONFIRMED.

### 4-2. 39 of 106 pages have zero inbound links from any other page. CONFIRMED.

Reachable only through the sidebar. Full list:

`/docs` · `/docs/styling` ·
**all of `actions/`**: `action-bar` `button` `button-group` `clipboard` `download-trigger` `toggle` ·
**11 of 13 `overlays/`**: `alert` `dialog` `empty-state` `hover-card` `popover` `ribbon` `sheet` `spinner` `toast` `tooltip` `tour` ·
**8 of 14 `layout/`**: `accordion` `client-only` `collapsible` `float` `floating-panel` `made-with` `resizable` `scroll-area` `show` ·
`data-display/`: `badge` `highlight` `item` `json-tree-view` `kbd` `prose` `tree-view` ·
`forms/`: `editable` `tanstack-form` · `navigation/`: `pagination` `steps`

Two that matter most:

- **`forms/tanstack-form` — 596 lines, 20 previews, the largest page after `charts`, and nothing links to it.** `forms/validation.mdx:52-59` has a `## Which form library?` section that says *"**A form library** (TanStack Form) — recommended once a form has enough fields"* — as plain text, no link. `forms/building-a-form.mdx` does not link it either.
- **`(root)/styling.mdx` — the page that carries the themeable-vs-structural rule and the flat-export rule has no inbound link from any page**, including `philosophy.mdx`, which is the page a reader lands on to learn how the system is built.

**The whole `overlays/` group is mutually unlinked.** Dialog ↔ Sheet ↔ AlertDialog are three
surfaces over one machine (`overlays/sheet.mdx:81-87` says so) and no page links to another.
Popover ↔ HoverCard ↔ Tooltip is the same question three times (hover vs click vs description)
and no page states the rule or links its siblings — the exact gap `forms/controls.mdx` closes for
the listbox family.

### 4-3. The Select/Combobox/Listbox/TagsInput/Command cluster — the brief's test case

Outbound links between the ten members (excluding self-anchors):

| From | select | combobox | listbox | tags-input | native-select | facet-filter | command | menu | radio-group | segment-group | controls |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `forms/select` | — | ✔ | | | ✔ | | | ✔ | | | |
| `forms/combobox` | | — | | ✔ | | | | | | | |
| `forms/listbox` | ✔ | ✔ | — | | | ✔ | | ✔ | | | |
| `forms/tags-input` | | ✔ | | — | | | | | | | ✔ |
| `forms/native-select` | ✔ | ✔ | | | — | | | | | | |
| `forms/facet-filter` | | | ✔ | | | — | | | | | ✔ |
| `actions/command` | | ✔ | | | | | — | | | | ✔ |
| `overlays/menu` | ✔ | ✔ | | | | | | — | | | ✔ |
| `forms/radio-group` | | | | | | | | | — | | |
| `navigation/segment-group` | | | | | | | | | ✔ | — | |

**Findings:**
- **`forms/combobox` is the hub that points nowhere.** It is the most-linked component page on the site (6 inbound) and links only to `tags-input`. No link back to `select`, `listbox`, `native-select`, `facet-filter`, `command`, or the `controls` index. CONFIRMED.
- **`forms/radio-group` links to nothing** despite being the target of `segment-group.mdx:13` and carrying `RadioGroupCard`, which `controls.mdx:35` links to by anchor. CONFIRMED.
- Only 4 of 10 members link back to `forms/controls` — the page that is the cluster's single answer and the site's most-linked page overall (8 inbound). Every member should.
- `Listbox` and `Menu` cross-link correctly and carry the role rule; `Select`, `TagsInput`, `Command` carry restatements of it instead of links (§6-1).

### 4-4. `docs/app/llms.txt/route.ts` — current in shape, thin in content, with three real defects

**4-4a — the origin.** `route.ts:24` `const origin = new URL(request.url).origin;`. Next 16
(`docs/package.json`: `"next": "16.2.7"`) does **not** cache `GET` route handlers by default and
there is no `export const dynamic`/`revalidate`, so this evaluates per request — which is why the
orchestrator saw `http://localhost:3100/...` when fetching from `:3100`. That is correct
behaviour, **not** a baked build-time host. **SUSPECTED-negative** on the build-time bake.
Two genuine risks remain: (i) behind a reverse proxy `request.url`'s host is the *internal* origin
(no `X-Forwarded-Host` handling), so a deployed llms.txt can advertise `http://0.0.0.0:3000/...`;
(ii) being dynamic, it is re-rendered on every crawl instead of being a static asset.
**Action:** derive the origin from an explicit `NEXT_PUBLIC_SITE_URL` with `request.url` as a
fallback, and emit **root-relative** paths (llmstxt.org permits them) so the file is host-agnostic
and can be statically generated.

**4-4b — the Forms overview page is filed under "Getting started". CONFIRMED.**
`route.ts:31` `const key = page.slugs.length > 1 ? page.slugs[0] : "";`. `forms/index.mdx` has
`slugs = ["forms"]` (length 1) → key `""` → grouped with Getting started. That is why the
orchestrator counted 8 Getting-started entries against 7 files. The page whose description says
*"Start here before reading any individual input page"* is listed outside Forms.
**Action:** `const key = page.slugs.length > 1 ? page.slugs[0] : (page.slugs[0] === "forms" ? "forms" : "")` — or better, key off the page-tree folder rather than the slug array.

**4-4c — it describes the pages, not the surface. CONFIRMED.**
`route.ts:38-41`'s blurb states the naming rule (good) but the file never mentions:
the three import paths (`@kanzo-tech/ui/table`, `/analytics`, `/editor`), the optional peers, the
two sibling packages (`@kanzo-tech/theme`, `@kanzo-tech/palette`), or the `<html>`-attributes
theming contract. An agent handed this file cannot write a correct import for `DataTable` or
`ChartRoot`. Entries are also sorted **alphabetically within group** (`route.ts:48-50`), which
discards the curated `meta.json` order — so `Controls`/`Building a form` do not lead Forms, and
the `---Text---` / `---Choice---` structure that makes the group navigable is lost.
**Action:** add a `## Packages and entry points` block before the page list; sort by page-tree
order, not title; consider an `llms-full.txt` that inlines the reasoning pages
(`philosophy`, `styling`, `theming`, `forms/controls`, `forms/validation`).

---

## 5. Examples quality

Baseline: 327 files, 12 302 lines, 348 comment lines = **2.8 %**. The examples are lean and match
the minimal-comments preference; the verbose-JSDoc habit lives in `docs/components/` and
`docs/showcases/`, not here.

### 5-1. `docs/blocks/` does not exist. `docs/showcases/` does. Three names for one thing. CONFIRMED.

| Source | Says |
|---|---|
| `DESIGN.md:23` | *"**Specific arrangements are showcases**, in `docs/blocks/`, not components."* |
| `DESIGN.md:349` | *"**`docs/blocks/`** — full arrangements: an app shell, a workspace, an editor."* |
| The tree | `docs/showcases/` (6 dirs), `docs/content/docs/showcases/` (4 pages), `/docs/showcases` URL |
| `docs/components/component-preview.tsx:23` | *"a page in the `layouts` or `blocks` group is full-bleed"* — neither group exists (§2-7b) |
| `docs/app/view/showcases/[name]/page.tsx:18` | `const BLOCKS = { … }` |

**Action:** `docs/showcases/` is the real name and the site is consistent about it. Fix
DESIGN.md:23,349, `component-preview.tsx:23` and rename `BLOCKS` → `SHOWCASES`.
**Confidence:** CONFIRMED.

### 5-2. A live example is silently dead: `Show` cannot wrap a chart descriptor. CONFIRMED, high.

`docs/examples/charts/example-interactor.tsx:69-71`:
```tsx
<Show when={mode === "toggle"}>
  <ChartHighlight />
</Show>
```
`packages/ui/src/charts/chart-spec.ts:97-105`:
```
if (!isValidElement(node)) return;
if (node.type === Fragment) { collect(...children...); return; }
// Anything else is a DOM child (ChartLegend, a caption…) — rendered, never compiled. A
// descriptor hidden inside a consumer's own component is invisible here, as in Recharts.
if (!isChartDescriptor(node.type)) return;
```
`Show` (`packages/ui/src/simples/show.tsx:10`) is a component: the element's `type` is the `Show`
function, not `Fragment`, so `collect` returns before reaching `ChartHighlight`. **The highlight
is never compiled.** The example's own prose at `:24-25` — *"the toggle is not [its own feedback],
so it pairs with a `ChartHighlight`"* — describes a pairing that does not happen, and `:21-22`
correctly describes the `&&`/ternary form the file abandons two lines later
(*"A `false` child compiles to nothing"*). The very next line, `:68`, uses a ternary and works.
**Contradicts:** the house `Show` rule, which has an undocumented exception — chart descriptors,
like eager-deref children, must stay `&&`/ternary.
**Action:** revert `:69-71` to `{mode === "toggle" && <ChartHighlight />}`; add the exception to
`docs/content/docs/layout/show.mdx` (36 lines, no API table, currently no caveats at all) and to
`data-display/charts.mdx:85-87`, next to the fragments-and-arrays rule it belongs beside.
**Confidence:** CONFIRMED.

### 5-3. Four `data-display/card` examples import a component the reader cannot get. CONFIRMED.

```
docs/examples/card/example-metric-default.tsx  → "@/showcases/metric-card/metric-card"
docs/examples/card/example-metric-status.tsx   → "@/showcases/metric-card/metric-card"
docs/examples/card/example-metric-loading.tsx  → "@/showcases/metric-card/metric-card"
docs/examples/card/example-metric-link.tsx     → "@/showcases/metric-card/metric-card"
```
The Code tab of `data-display/card.mdx:60,68,75,84` shows that import line verbatim.
`docs/content/docs/data-display/card.mdx:47-57` argues the section well ("It is a composition, not
an import") but never says **where the composition lives** or that it must be copied. Contrast
`data-display/charts.mdx:420`, which does exactly the right thing for the same problem:
*"they are arrangements you copy. The ones these docs use are in `docs/lib/`."*
Compounding it: `docs/showcases/metric-card/` has **no page and no `/view/showcases/` route**
(`app/view/showcases/[name]/page.tsx:18-31` does not list it), so it is a "showcase" that is
never shown — it is a 6-part compound component parked in the showcases directory and imported by
four examples. `docs/components/showcases-list.tsx:14-22` reasons carefully about
`docs/showcases/preferences` being a mechanism-not-a-showcase; `metric-card` is the case that
argument misses.
**Action:** either inline `MetricCard` into one example file (minimality: a specific convenience
is an example, and an example is one file a reader copies), or say on the page where it lives and
that it is copied — as the charts page does.
**Confidence:** CONFIRMED.

### 5-4. `component-preview.tsx`'s import rewriter is a no-op with a lying JSDoc. CONFIRMED.

```
70: function forDisplay(input: string) {
71:   return input
72:     .replace(/^import .*from "@kanzo-tech\/ui";$/gm, (line) => line)
73:     .replace(/\n+$/, "");
74: }
```
`(line) => line` replaces each matched line with itself. The JSDoc at `:66-69` says *"Rewrite the
source so a reader sees the imports THEY would write. Shark does the same when mapping its
registry path onto `@/components/ui`."* It rewrites nothing — and it is precisely the hook that
should rewrite `@/showcases/metric-card/metric-card` and `@/lib/chart-card` into something a
reader can act on (§5-3).
**Action:** either implement it (map `@/showcases/*` and `@/lib/*` to a commented "copy from …"
line) or delete the function and the comment.
**Confidence:** CONFIRMED.

### 5-5. Orphan example files. CONFIRMED.

Referenced by no page and imported by nothing:

| File | Note |
|---|---|
| `docs/examples/charts/example-stat.tsx` (63 lines) | The only live example of `ChartStat` + `DashboardGrid`. `data-display/charts.mdx:425-435` shows the same shape as a **static fence** instead, and `data-display/stat-tile.mdx` (which explains the pair at `:16-19`) has no `ChartStat` preview. A working example exists and no page renders it. |
| `docs/examples/charts/example-color-legend.tsx` (99 lines) | Same for `ChartLegend` vs `ChartColorLegend`, which `charts.mdx:549-555` describes in prose only. |
| `docs/examples/forms/example-controls.tsx` | Referenced nowhere at all. `forms/controls.mdx` has **zero previews** — the site's index of every control shows no control. |

**Action:** wire all three in (`charts.mdx` §Stat and §Legend; `controls.mdx` as its opening
preview), or delete them.

### 5-6. `Show` vs `&&` in `docs/components/`. CONFIRMED, low.

Seven `&&`-JSX sites, none of them a deref guard, all convertible:
`components/component-preview-tabs.tsx:59`, `components/code-block.tsx:24`,
`components/components-list.tsx:38,54`, `components/showcases-list.tsx:39`,
`components/preview-iframe-tabs.tsx:20,37`. Plus `showcases/palette-onboarding/base16-panel.tsx:57`.
`docs/examples/` itself is clean — 25 `Show` uses, one ternary (§5-2).
**Action:** low priority; convert for consistency, since these are the files a reader is most
likely to read as house style.

### 5-7. `docs/examples/charts/mosaic-boot.tsx:4` and `charts.mdx:117` teach different imports. CONFIRMED, low.

The example imports `loadObjects` from `@kanzo-tech/ui/analytics` (correct — the barrel re-exports
it at `analytics.ts:145-147` precisely so consumers avoid a direct `@uwdata` import). The page's
"bring your own coordinator" fence at `charts.mdx:117` imports it from `@uwdata/mosaic-sql`.
The page teaches the import the barrel exists to remove.

### 5-8. ButtonGroup — no violations found worth reporting

26 example files render ≥2 `<Button>` without `ButtonGroup`, but every one inspected is a
*variants/sizes gallery* (`examples/button/example-variants.tsx`, `example-sizes.tsx`) or a
*dialog footer* (`examples/dialog/*`, `examples/sheet/*`, `examples/alert-dialog/*`) — neither is
a control cluster, and `DialogFooter`/`CardFooter`/`SectionActions` are the correct container in
the second case. `docs/app/(home)/page.tsx:28-33` renders a two-Button hero CTA in a plain flex
div; arguably a cluster, arguably a hero. **No action.**

---

## 6. Duplication

### 6-1. One rule, five wordings — the listbox family. CONFIRMED.

| Rule | Canonical | Restated at |
|---|---|---|
| menu = command, listbox = value; *"if closing the surface leaves state…"* | `forms/controls.mdx:74-82` | `forms/select.mdx:53-58` · `forms/listbox.mdx:49-54` · `overlays/menu.mdx` (via link) — and DESIGN.md:286-298 |
| the ~7 / ~15-option threshold | `forms/controls.mdx:44-47` | `forms/select.mdx:48-52` |
| TagsInput only when values do not pre-exist | `forms/controls.mdx:38` | `forms/tags-input.mdx:57-66` |
| Autocomplete is a Combobox presentation | `forms/controls.mdx:56-63` | `forms/combobox.mdx:12` |
| NumberInput vs NumberField | `forms/controls.mdx:104-105` | `forms/number-input.mdx:43-48` |

**Canonical: `forms/controls.mdx`.** It is the site's most-linked page (8 inbound) and its
frontmatter says *"A table index — start here"*. Delete the four `### When to use which`
sections at `select.mdx:46`, `listbox.mdx:49`, `tags-input.mdx:57`, `number-input.mdx:43` and
replace each with a one-line link. **Confidence:** CONFIRMED.

### 6-2. `(root)/theming.mdx` and `showcases/palette.mdx` duplicate three paragraphs. CONFIRMED.

| Content | Copy A | Copy B |
|---|---|---|
| *"Dracula, Nord and the two Catppuccins ship as `PALETTE_SEEDS` … two shapes for one idea is the defect this layer exists to remove."* | `theming.mdx:229-233` | `showcases/palette.mdx:62-65` |
| *"There is no `data-palette`, no `data-accent`, no per-token override — all of those were ways to express *part* of a palette at runtime, and a document expresses all of it at once."* | `theming.mdx:216-221` (a `warn` callout) | `showcases/palette.mdx:70-73` |
| *"The old rule — 'a palette may be dark-only; do not invent a light side for Dracula' — was true when a palette was a set of authored hexes…"* + the same `#ff79c6` → `#e562af` / 7.3 ΔE measurement | `theming.mdx:237-241` | `showcases/palette.mdx:74-77` |

**Canonical: `theming.mdx`** (it is the reference page; `palette.mdx` is a showcase and should
describe what the showcase shows). Cut all three from `palette.mdx` and link. The third is also
**legacy prose** under the no-legacy rule and should be deleted from both.
**Confidence:** CONFIRMED.

### 6-3. Prose restating CONVENTIONS.md, at risk of drifting — and already drifted. CONFIRMED.

| MDX | CONVENTIONS.md | State |
|---|---|---|
| `styling.mdx:6-44` (the recipe) | `CONVENTIONS.md:29-58` | In sync. Canonical should be the MDX; CONVENTIONS.md should link. |
| `styling.mdx:88-104` (the rules) | `CONVENTIONS.md:74-93` | **Drifted** — `styling.mdx:102` carries the `SidebarInset`-owns-`<main>` error (§1c-2), inherited from CONVENTIONS.md:92, which DESIGN.md:143 contradicts. Three copies, two wrong. |
| `styling.mdx:107-113` (flat exports) | `CONVENTIONS.md:94-104` | **Drifted** — CONVENTIONS.md says "no component does today"; `Preferences.tsx:515` does (§3-2). |
| `philosophy.mdx:60-69` (client boundary) | `CONVENTIONS.md:106-113` | In sync, but the MDX drops the load-bearing half (`preserveModules` + `rollup-plugin-preserve-directives`, and that Vite cannot catch it) — which `(root)/index.mdx:20-27` alludes to instead. |
| `philosophy.mdx:12-35` (three layers) | `CONVENTIONS.md:8-26` | **Terminology collision.** CONVENTIONS.md uses "three layers" for the *directories* and "three concerns" for behaviour/appearance/API. `philosophy.mdx:10` uses "**The three layers**" for the *concerns*, and never mentions the directories. DESIGN.md:30 adds a third triple, "the three axes". A reader meeting all three meets three different meanings of "three". |

**Action:** one canonical name per triple. Suggested: **concerns** (behaviour/appearance/API),
**layers** (`simples`/`composites`/`layouts`), **axes** (structure/content/behaviour). Fix
`philosophy.mdx:10` and add the other two triples there (§3-1).

### 6-4. Legacy / migration prose — 24 sites, all deletion candidates. CONFIRMED.

Grouped by whether the *lesson* survives deletion:

**Delete outright (pure history, no surviving lesson):**
`layout/section.mdx:38-51,86` (the rename table, §1c-6) ·
`forms/password-input.mdx:68-69` (*"it replaces the former `SecretField`"*) ·
`overlays/menu.mdx:162-165` (*"There used to be a ten-export `ContextMenu*` family"*) ·
`navigation/sidebar-user.mdx:25-28` (*"There used to be a second, hard-coded one… **Those props are gone.**"*) ·
`(root)/theming.mdx:33-37` (*"An earlier `KanzoTheme` wrapper component…"*) ·
`(root)/theming.mdx:216-221,237-241` (the `data-palette`-are-gone callout and the old-rule paragraph) ·
`(root)/showcases.mdx:11-14` (*"`AppShell` and `WorkspaceLayout` used to be components"*) ·
`layout/preferences.mdx:6-9,43` (*"The example used to work around that…"*, *"what the export used to do"*) ·
`data-display/status.mdx:31,44` · `data-display/swatch.mdx:21` ·
`data-display/charts.mdx:32-39,142,320,368` (*"The library used to ship five components"*) ·
`layout/shell.mdx:37-43` (*"There is no `Toolbar` and no `StatusBar`. They were two of three copies…"*)

**Rewrite forward, keeping the rule:**
`data-display/prose.mdx:21-30` — *"There is no `Heading` and no `Text`. **They existed and were
removed**"* — the reasoning (five styling knobs on a span is styling-by-props competing with the
utilities) is a *rule* and belongs on `styling.mdx`; the history should go. ·
`(root)/styling.mdx:96-101` and `(root)/theming.mdx:283-290` — the `text-white` measurement (2.13:1
on warning, 3.81 on destructive) is real evidence for "an untokenised colour is a colour no test
can measure"; keep the measurement, drop *"It used to be"*.

`forms/validation.mdx:95-99` (`FieldWarning`) is the mirror image — not legacy but **speculative
future API** — and is a deletion candidate for the same reason (§1c-8).

---

## Proposed IA — the sidebar tree I would ship

Eight groups → **six**. 106 pages → **~82**. Every group name states an axis a reader can predict.
Merges from §3-4 marked `⇐`.

```
Getting started
├── Introduction
├── Installation                    + the /analytics row, + @kanzo-tech/palette   (§1c-4)
├── Philosophy                      ← THE REASONING PAGE (§3-1)
│     ## The three concerns          behaviour / appearance / API
│     ## The three layers            simples / composites / layouts, flat barrel
│     ## The three axes              structure / content / behaviour
│     ## Admission rules             the four
│     ## Reach for a new component last     the five-rung ladder
│     ## A minimal system            generic is the system; specific is an example
│     ## The engine rule             ← the three dangling links land here
│     ## The naming rule             kebab primitive / Pascal convenience
│     ## Export naming               flat, never dot-notation
│     ## The header rule             a header wired to a machine stays with it
│     ## A menu is a command; a listbox is a value   → links forms/controls
│     ## Errors: the library displays, products produce  → links forms/validation
├── Styling                          the recipe · themeable vs structural · restyling · one <main>
└── Theming                          axes · the palette document · dark mode · tokens
      ⇐ Preferences, Appearance toggle  (moved out of layout/, as ## sections)

Forms                                (31 → 20)
├── Overview  ·  Building a form  ·  Controls (the index)  ·  Validation  ·  With TanStack Form  ·  AI-assisted
├── Field · Field array
├── Text inputs        ⇐ input + text-field + textarea + input-group
├── Editable
├── Tags input
├── Native select · Select · Listbox · Combobox · Facet filter
├── Radio group · Segment group                    ← moved from navigation/  (§2-2)
├── Checkbox · Switch
├── Number input · Slider · Rating
├── Dates              ⇐ date-field + date-picker + calendar
├── Colour picker
├── File upload
├── Password input · PIN input
└── Code editor        ← moved from data-display/  (§2-4)

Actions                              (7 → 7)
└── Button · Button group · Toggle group ← NEW page (§1b) · Toggle · Action bar · Command · Clipboard · Download trigger

Navigation                           (11 → 7)
└── Breadcrumbs ⇐ breadcrumb + breadcrumbs · Tabs · Link · Steps · Pagination
    · Sidebar ⇐ sidebar + sidebar-nav + sidebar-user + instance-switcher + SidebarIdentity

Data display                         (18 → 14)
└── Tables ⇐ table + data-table · Charts · Chart gallery · Stat tile
    · Tree view · JSON tree view · Card · Item · Status · Swatch · Badge · Avatar
    · Prose · Kbd · Highlight

Overlays                             (8)
└── Dialog (+ Alert dialog as a section) · Sheet · Popover · Hover card · Tooltip · Menu · Toast · Tour

Feedback                             (5 → 4)
└── Alert · Loading ⇐ spinner + skeleton + progress · Empty state · Ribbon

Layout                               (14 → 6)
└── Shell · Section · Resizable · Scroll area · Floating panel · Float
    · Disclosure ⇐ accordion + collapsible
    · Rendering  ⇐ show + client-only            (or fold into Styling)
    · Made with  → DELETE candidate

Showcases                            (4)
└── App shell · Workspace · Metadata form · Palette onboarding
```

Deletions/relocations: `layout/preferences` + `layout/appearance-toggle` → `Theming`;
`layout/made-with` → delete with the component; `navigation/segment-group` → `Forms`;
`data-display/code-editor` → `Forms`; nine merges collapse 24 pages into 9.

---

## The ten highest-value docs fixes, in order

| # | Fix | Where | Why it is first |
|---|---|---|---|
| 1 | **Write the reasoning onto `philosophy.mdx`** — engine rule, three axes, layers, admission rules, ladder, minimality, naming, header rule, with an anchor each | `docs/content/docs/(root)/philosophy.mdx` (71 → ~250 lines); then repoint `charts.mdx:417`, `table.mdx:16`, `stat-tile.mdx:19` at `#the-engine-rule` | Three pages already link to it and find nothing. The design reasoning is the product, and today it ships only in `DESIGN.md`, which no consumer reads. §3-1 |
| 2 | **Fix the `SidebarInset` / `<main>` lie in three places** | `navigation/sidebar.mdx:33,41`; `(root)/styling.mdx:102`; `CONVENTIONS.md:92` — against `sidebar.tsx:347` and `showcases/app-shell.mdx:17` | An accessibility conformance error a reader will copy: no `<main>`, ambiguous skip-link. §1c-2 |
| 3 | **Delete the four dead exports from the charts page** | `data-display/charts.mdx:128,559-561` (`Fixed`, `from`, `plot`, `coordinator`) | The doc promises API the barrel deleted on purpose and documents why. §1c-1 |
| 4 | **Render `links.doc`** | `docs/app/docs/[[...slug]]/page.tsx`; then audit the 55 URLs, starting with `actions/button.mdx:5` | One file, and it recovers half the site's upstream cross-links. Also makes DESIGN.md:322's evidence checkable. §4-1 |
| 5 | **Fix `installation.mdx`** — add the `/analytics` row and its four peers, add `@kanzo-tech/palette` | `(root)/installation.mdx:36-42` | The first page a new consumer reads states a complete enumeration that is wrong; a reader cannot install charts by following it. §1c-4 |
| 6 | **Land the identity axis in the docs** — fifth `Preferences` section, `data-identity`, `IdentityNotice`, `KanzoIdentity`/`IdentityOption` | `layout/preferences.mdx:40,63-70,186-190`; `(root)/theming.mdx:15-22`; new prose for `IdentityNotice` | Live code with zero docs, and `preferences.mdx:40` now asserts the exact opposite of what the panel does. **IN-FLIGHT.** §1c-3 |
| 7 | **Revert the dead `Show` in the interactor example and document the exception** | `docs/examples/charts/example-interactor.tsx:69-71`; `layout/show.mdx`; `data-display/charts.mdx:85-87` | A live example demonstrates a pairing that never happens, and the house style is what broke it. §5-2 |
| 8 | **Collapse the duplicated guidance** — delete four `### When to use which` sections and three duplicated palette paragraphs; make `forms/controls.mdx` and `(root)/theming.mdx` canonical | `select.mdx:46`, `listbox.mdx:49`, `tags-input.mdx:57`, `number-input.mdx:43`; `showcases/palette.mdx:62-77` | Five wordings of one rule is five things to keep in sync; it is already drifting. §6-1, §6-2 |
| 9 | **Delete the legacy prose** — 24 sites, starting with the 7-row rename table and the `FieldWarning` promise | `layout/section.mdx:38-51,86`; `forms/validation.mdx:95-99`; `password-input.mdx:68-69`; `overlays/menu.mdx:162-165`; `theming.mdx:33-37,216-221,237-241`; the rest in §6-4 | Nothing is published, so nothing needs a migration note; every line of it is a line that can go stale. §6-4 |
| 10 | **Cross-link the orphans and settle the API-table decision** — link `tanstack-form` from `validation.mdx:58`, link `styling` from `philosophy`, cross-link the overlay family, make `combobox` link its five siblings; then either adopt `<TypeTable>` or delete the three unused registrations | `forms/validation.mdx:58`; `(root)/philosophy.mdx`; `overlays/*`; `forms/combobox.mdx`; `docs/mdx-components.tsx:24-31` | 39 of 106 pages are sidebar-only, and the site's largest form page has no inbound link at all. The `<TypeTable>` decision has been open since DOCS-QUALITY §4 and blocks the 31 pages with no API section. §4-2, §3-3b |

**Runners-up:** add `## Keyboard` tables to the ten composite-role components (§3-3a — the largest
single gap against CONVENTIONS.md:87-89); create the `ToggleGroup` page (§1b); resolve the
`FULL_BLEED_GROUPS` dead mechanism (§2-7b); fix `next.config.ts:7-11`'s source-vs-dist comment
(§2-7c); fix `llms.txt`'s Forms-in-Getting-started bug and add the packages block (§4-4b/c); name
`kanzo-prose` on the Prose page (§1c-7); wire or delete the three orphan example files (§5-5);
inline or explain `MetricCard` (§5-3); implement or delete `forDisplay` (§5-4); rename
`docs/blocks/` → `docs/showcases/` in DESIGN.md:23,349 and `BLOCKS` in
`app/view/showcases/[name]/page.tsx:18` (§5-1).
