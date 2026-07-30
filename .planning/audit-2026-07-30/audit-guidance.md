# Audit — the agent-guidance system

Read-only pass, 2026-07-30, against `e210a59` plus 27 uncommitted files from another live session
(the "identity axis" work — tagged **IN-FLIGHT** below).

---

## Executive summary

1. **~6,300 lines of guidance across 16 files, and not one of them is reachable from a cold start.**
   No `CLAUDE.md`, no `AGENTS.md`, and `README.md` — the only file a newcomer opens — never names
   `DESIGN.md` or `CONVENTIONS.md`. The two documents cross-reference *each other* and nothing else
   cross-references them.
2. **`README.md` and `packages/ui/README.md` are the two most stale documents in the repo**, and
   both are the npm landing page. They name `TopBar`, `StatusBar`, `WorkspaceLayout`,
   `CommandPalette`, `EditorShell`, `GhostEditor` — six symbols that do not exist — and an `accent`
   axis deleted in `1975b9a`.
3. **`DESIGN.md`'s longest argument is about a component that no longer exists.** `CardRadioGroup`
   was deleted in `06a3231`, which landed *after* `DESIGN.md`'s last edit (`1f9a1dd`).
   `DESIGN.md:264-273` still debates whether to unwind it, and cites two paths that are gone.
4. **Four of the seven export counts at `DESIGN.md:231-240` are wrong**, and the paragraph presents
   them as "the live version … the one to cite instead". `733` reproduces exactly; `139` is now
   `60`; `122` is now `95`; `21 *Variants` is now `10`, because the audit those numbers justified
   already shipped.
5. **The three axes are stated twice and the duplicate has rotted.** `CONVENTIONS.md:92` says
   `SidebarInset` owns the `<main>`; `DESIGN.md:141-144` says it must not, and the code
   (`composites/sidebar.tsx:349`, an `ark.div`) agrees with `DESIGN.md`. Duplication is the defect.
6. **The hardest-enforced rules in this repo are not written in `CONVENTIONS.md` at all.**
   `alpha-steps.test.ts` bans seven token spellings; `CONVENTIONS.md:80` documents two of them.
   An agent meets those rules as a red test, not as guidance.
7. **`.planning/` is 4,140 lines, eleven files, and eight of them are dead.** `ARCHITECTURE-AUDIT.md`
   has never been edited since the initial commit while 177 commits of remediation landed on top of
   it; ~34 of its 40 findings are resolved and every path it cites (`primitives/`, `shells/`,
   `playground/`) was renamed or deleted.
8. **The recurrence inventory (§5) is the real specification.** Seven mistakes recur: N-ways-to-do-
   one-thing (9 instances), untokenised colour (3, now a test), `data-slot` omitted (3, no test),
   a role claimed without its keyboard contract (2), a component designed then redesigned (5
   families), the docs-vs-source fix applied at the wrong layer (2), and dead names surviving a
   rename in prose (7 sites).
9. **62 changesets, 1,964 lines, and they are a design journal, not release notes.** Three of them
   announce renames to names that were then deleted. Released as-is they publish a CHANGELOG
   describing an intermediate history no consumer ever saw.
10. **The central proposal:** a four-field decision record (`what` / `because` / `reversed by` /
    `status`), one per file under `decisions/`, so `DESIGN.md` becomes a 60-line index and a
    reopened argument costs one field, not a self-contradicting paragraph.

---

## §1 — Truth audit: verdict table

`DESIGN.md` and `CONVENTIONS.md`, claim by claim. Every row re-derived against the tree.

### 1a. `DESIGN.md`

| # | Claim | `file:line` | Verdict | Evidence |
|---|---|---|---|---|
| D1 | Specific arrangements live in `docs/blocks/` | `DESIGN.md:23`, `DESIGN.md:349` | **FALSE — CONFIRMED** | `docs/blocks` does not exist. The directory is `docs/showcases/` (renamed in `c6cad41` "Rename blocks to showcases"). Same dead path also at `packages/ui/src/layouts/shell.tsx:12`, `.planning/LAYOUT-DESIGN.md:16,147,158` |
| D2 | The three layers `simples/` `composites/` `layouts/` | `DESIGN.md:57-61` | **TRUE — CONFIRMED** | all three exist; `packages/ui/src/{simples,composites,layouts}` |
| D3 | The public barrel is flat | `DESIGN.md:62` | **TRUE — CONFIRMED** | `packages/ui/src/index.tsx`, 74 `export *`, no namespaces |
| D4 | Engine rule: `Table`→`DataTable` on `/table`; `StatTile`→`ChartStat` on `/analytics` | `DESIGN.md:76-77` | **TRUE — CONFIRMED** | `packages/ui/src/table.ts:10-11`, `packages/ui/src/analytics.ts:87-89`, `packages/ui/src/simples/stat-tile.tsx` |
| D5 | Naming rule: `SecretField` imports `password-input` | `DESIGN.md:98` | **FALSE — CONFIRMED** | `SecretField` was deleted and folded into `password-input`: `packages/ui/src/index.test.ts:64` `expect(surface.SecretField).toBeUndefined()`. The rule's flagship example is gone |
| D6 | `TextField` imports `input` + `input-group` | `DESIGN.md:98-99` | **TRUE — CONFIRMED** | `packages/ui/src/simples/TextField.tsx:2-3` |
| D7 | `DateField` imports `date-picker` + `calendar` | `DESIGN.md:99` | **TRUE — CONFIRMED** | `packages/ui/src/simples/DateField.tsx:4-15` |
| D8 | Ark ships no layout; the one layout-adjacent primitive is `Splitter` | `DESIGN.md:107-108` | **TRUE — CONFIRMED** | `packages/ui/node_modules/@ark-ui/react/dist/components/` has 73 dirs, `splitter` among them, no layout family |
| D9 | Shell region vocabulary as drawn | `DESIGN.md:116-123` | **TRUE — CONFIRMED** | `layouts/shell.tsx:38,50,71,84,102,152` — Header, Footer, Root, Body, Main, Aside all present |
| D10 | Exactly one `<main>`; `SidebarInset` is a neutral `<div>`, not a `<main>` | `DESIGN.md:141-144` | **TRUE — CONFIRMED** | `composites/sidebar.tsx:349` is `ark.div`; `:347-348` states the reason; `layouts/shell.tsx:102` is the only `ark.main`; enforced by `layouts/shell.test.tsx:127` |
| D11 | `TwoPaneLayout` deleted, `SidePanel`→`ShellAside`, `Toolbar`/`StatusBar`/`TopBarUtility` deleted, `TopBar` split, `PageShell`/`SectionHeader`/`TopBarMain` merged | `DESIGN.md:164-175` | **TRUE — CONFIRMED, and now history not plan** | none of the eight symbols exists as code; `Toolbar`/`StatusBar`/`ShellBar`/`AppShell`/`WorkspaceLayout` survive only in prose at `layouts/shell.tsx`; the merge landed as `layouts/section.tsx:34-191` (`SectionRoot`…`SectionFooter`) |
| D12 | `TourHeader` *is* `DialogHeader` | `DESIGN.md:188` | **TRUE — CONFIRMED** | `packages/ui/src/simples/tour.tsx` reuses the dialog header parts |
| D13 | Field: `Field` imported by **39** files under `docs/` | `DESIGN.md:225` | **STALE — CONFIRMED** | **49** files have `Field` in an import block (47 code + 2 `.mdx`). Direction is right, number is low by 10 |
| D14 | `FieldLabel` by **12** modules inside `packages/ui/src` | `DESIGN.md:225-226` | **STALE (off by one) — SUSPECTED** | 13 files contain it; excluding `field.tsx` and `field.test.tsx` leaves **11** modules: `Preferences.tsx`, `clipboard`, `color-picker`, `file-upload`, `number-input`, `pin-input`, `progress`, `radio-group`, `rating`, `slider`, `tags-input`. 12 only if the test file counts. IN-FLIGHT: `Preferences.tsx` is modified |
| D15 | `field.tsx` ships **thirteen** parts; **eleven of thirteen** rendered elsewhere | `DESIGN.md:221,226` | **FALSE — CONFIRMED** | `simples/field.tsx` exports **15** values (14 components + `useField`) at lines 14,59,72,100,118,136,153,176,197,215,236,271,285,308,322. **Thirteen** of fifteen have a renderer outside the file. The conclusion is stronger than the sentence |
| D16 | The two parts without a consumer are `FieldSeparator` and `useField` | `DESIGN.md:229` | **TRUE — CONFIRMED** | measured: `FieldSeparator` 0 renderers, `useField` 0 callers; every other part ≥1 (`FieldSetError`/`FieldSetHelper` 1 each, in `docs/examples/field/example-field-set-messages.tsx`) |
| D17 | **733** exported values | `DESIGN.md:231` | **TRUE — CONFIRMED** | re-derived at exactly **733** distinct exported value names across `packages/ui/src` (comments stripped, tests excluded). Coincidence: the surface audit deleted ~25 and the identity work added ~25 |
| D18 | **139** referenced nowhere in the repo | `DESIGN.md:231` | **FALSE — CONFIRMED** | now **60**. The 79 that closed are what `06a3231` deleted and what the two adoption examples fixed. Current list includes `Calendar Table*` (8), `use*` context aliases (23), `loadJSON`/`loadParquet`/`loadSpatial`/`loadExtension`, `SidebarInput`, `SelectClearTrigger`, `sectionVariants`, and IN-FLIGHT `PreferencesIdentity` |
| D19 | **122** appear in exactly one `docs/examples/<slug>/` and nowhere else | `DESIGN.md:232-233` | **FALSE — CONFIRMED** | now **95** (`AccordionItem`, the `AlertDialog*` family, `TreeView*`, `PasswordInput*`, …). Direction unchanged, number 22 % low |
| D20 | **42 of 56** exported `useX` context aliases unreferenced | `DESIGN.md:234` | **FALSE — CONFIRMED** | **58** `useX` exports exist; **23** are referenced nowhere. Not 42 of 56 |
| D21 | **14 of 21** `*Variants` objects unreferenced | `DESIGN.md:234` | **FALSE — CONFIRMED** | **10** `*Variants` are exported today, and **1** is unreferenced (`sectionVariants`). `06a3231` made thirteen internal: `.changeset/what-the-surface-audit-changed.md:13` "Thirteen `tv()` recipes are internal again". The claim is the *pre-fix* measurement |
| D22 | **29** pure `data-slot` renames, floor not ceiling | `DESIGN.md:235-236` | **SUPERSEDED — SUSPECTED** | not independently reproducible, but nine were deleted by name in `.changeset/what-the-surface-audit-changed.md:11` (`AlertDialogTitle`, `SheetTitle`, `CommandDialogTrigger`, `TourFooter`, `MenuArrow`, …). Whatever 29 was, it is not 29 now |
| D23 | **69** exports have no export consumer because their own root renders them | `DESIGN.md:236-237` | **UNVERIFIABLE as stated — SUSPECTED** | the mechanism is real and the named examples check out (`ProgressTrack` at `simples/progress.tsx:54,61`, `CheckboxIndicator`, `CalendarTable*`); the count is a pre-audit figure |
| D24 | `ProgressTrack` is the ideal case; `data-display/progress.mdx` says you never place it | `DESIGN.md:239-240` | **TRUE — CONFIRMED** | `docs/content/docs/data-display/progress.mdx:23` "you never place `ProgressTrack` yourself"; `:30` "← rendered for you" |
| D25 | "Deleting those exports is a **compatibility question**" | `DESIGN.md:238` | **WRONG BY POLICY — CONFIRMED** | nothing is published (`packages/*/package.json` all `"version": "0.0.0"`, no git tags). There is no compatibility question in this repo. The sentence should read *delete the export, keep the symbol* |
| D26 | `RadioGroupCard` at `simples/radio-group.tsx:98` | `DESIGN.md:249-250` | **FALSE — CONFIRMED** | it is at `packages/ui/src/simples/radio-group.tsx:121`. Line 98 is `data-slot="radio-group-item"` inside `RadioGroupItem` |
| D27 | `CardRadioGroup` is "the outlier to unwind"; composes at `simples/CardRadioGroup.tsx:6-7`; second call site `docs/examples/form/tanstack/example-card-radio-group.tsx` | `DESIGN.md:264-273` | **FALSE — CONFIRMED, whole paragraph** | the component was **deleted** in `06a3231`, after `DESIGN.md`'s last edit (`git merge-base --is-ancestor 1f9a1dd 06a3231` → true). `packages/ui/src/index.tsx:175-178` "No `CardRadioGroup`."; `packages/ui/src/index.test.ts:98` `expect(surface.CardRadioGroup).toBeUndefined()`. Neither cited path exists — the example is `docs/examples/form/tanstack/example-radio-cards.tsx`. The grid became `columns` on `RadioGroup` (`simples/radio-group.tsx:20,26`) |
| D28 | `composites/SidebarIdentity.tsx:31-38` rejects the record-of-`ReactNode`s shape | `DESIGN.md:269` | **TRUE, cite `31-36` — CONFIRMED** | the quoted argument runs `SidebarIdentity.tsx:31-36`; `:37-38` are the blank line and the code example's first line |
| D29 | AI-assist is `Complete` (`CompleteRoot`/`CompleteInput`/`CompleteTextarea`/`CompleteGhost`/`CompleteHint`) + `Suggest` (`Root`/`Trigger`/`Content`/`Item`); no `AiAssist` provider | `DESIGN.md:277-284` | **TRUE — CONFIRMED** | all five in `simples/complete.tsx`; `SuggestRoot` in `simples/suggest.tsx`; no `AiAssist` symbol anywhere |
| D30 | `Listbox` has no popover of its own; `TagsInput` has no collection; `Combobox multiple` is the answer when values pre-exist | `DESIGN.md:306-313` | **TRUE — CONFIRMED** | `simples/listbox.tsx`, `simples/tags-input.tsx`; `allowCustomValue` documented at `docs/content/docs/forms/combobox.mdx:84,129` |
| D31 | No `autocomplete` directory in Ark; the difference is `showTrigger` on `Combobox` | `DESIGN.md:315-319` | **TRUE — CONFIRMED** | `packages/ui/node_modules/@ark-ui/react/dist/components/` has `combobox`, no `autocomplete`; `showTrigger` at `simples/combobox.tsx` and covered in `combobox.test.tsx` |
| D32 | `Command`'s `links.doc` points at `ark-ui.com/docs/forms/combobox` | `DESIGN.md:322` | **TRUE — CONFIRMED** | `docs/content/docs/actions/command.mdx:5` `doc: https://ark-ui.com/docs/forms/combobox`; the reasoning is restated at `:9` |
| D33 | `DataTableViewOptions` is a genuine menu; `DataTableFacetFilter` and the chart filter were menus and should not be; their shared surface is `FacetFilter` | `DESIGN.md:330-341` | **TRUE — CONFIRMED** | `packages/ui/src/table.ts:22-23`; `FacetFilter` on the root barrel at `index.tsx:181-185` with the reason ("both consumers are on subpaths that must not see each other") |
| D34 | `.planning/LAYOUT-ARK-NATIVE-REVIEW.md` and `.planning/FORMS-DECISION.md` hold the full grounding | `DESIGN.md:112,200` | **TRUE — CONFIRMED** | both files exist and both are the real reasoning. These are the two `.planning/` pointers that are load-bearing |

### 1b. `CONVENTIONS.md`

| # | Claim | `file:line` | Verdict | Evidence |
|---|---|---|---|---|
| C1 | Reference implementation `packages/ui/src/simples/button.tsx` (lowercase) | `CONVENTIONS.md:60` | **TRUE — CONFIRMED** | exists; the recipe at `:38-57` matches its shape |
| C2 | React peer `>=19`; no `forwardRef`, never `ComponentPropsWithoutRef` | `CONVENTIONS.md:62-66` | **TRUE — CONFIRMED** | `packages/ui/package.json` `"react": ">=19"`; no `forwardRef` in `packages/ui/src` |
| C3 | `tailwind-variants` imported directly; `lib/tv.ts` had 21 of 24 callers bypass it; it has been deleted | `CONVENTIONS.md:67-70` | **TRUE in outcome, UNVERIFIABLE in evidence — SUSPECTED** | `packages/ui/src/lib/` is `cn.ts` + `color.ts`; zero references to `lib/tv`; **37** files import `tailwind-variants` directly. But `lib/tv.ts` appears nowhere in git history — this sentence was already in the squashed initial commit (`git log -S "21 of 24 callers"` → `f7c90c1`), so the 21-of-24 measurement is pre-repo and cannot be checked. Keep the rule, drop the unverifiable number |
| C4 | Themeable → recipe; structural → inline; the re-skin test | `CONVENTIONS.md:74-77` | **TRUE, and the best-written rule in the file — CONFIRMED** | matches `.planning/ARK-USAGE-AUDIT.md:397-409` where it was derived |
| C5 | Token list: `background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/field/ring` + `info/success/warning` + `sidebar-*` + `chart-*` + `--radius` + `--kanzo-font-size-*` + `--kanzo-syntax-*` | `CONVENTIONS.md:79` | **TRUE, every name — CONFIRMED** | each of the 16 semantic families defined twice in `packages/theme/tokens.css` (light + dark); `--sidebar*` 24 hits; `--chart-1…8` at `tokens.css:257-264` with `--chart-capacity: 8` at `:203`; `--kanzo-font-size-{base,small,xs}` at `:187-189`; 26 `--kanzo-syntax-*`. **The known `chart-*` problem is fixed** — the validated 8-slot scheme shipped |
| C6 | `border-input` outlines, `bg-field` fills; `bg-field` is an alpha step and never carries `/NN` | `CONVENTIONS.md:80` | **TRUE, and now under-stated — CONFIRMED** | `alpha-steps.test.ts:98-101` enforces it; but `:105-127` bans five *more* spellings the document never mentions (see §7 G1). IN-FLIGHT: `e210a59` made `--field` step 1 in dark, so it is no longer an alpha step in both modes (`alpha-steps.test.ts:79-88`) — `CONVENTIONS.md:80` does not say so |
| C7 | Focus rings are solid because the diluted form measured **1.29:1** | `CONVENTIONS.md:81` | **TRUE — CONFIRMED** | `packages/ui/src/alpha-steps.test.ts:34` and `:96` ("a diluted ring measured 1.29:1 — use solid `ring-ring`"); also `docs/content/docs/(root)/styling.mdx:97`. Executable, not asserted |
| C8 | A soft `--ring-soft` was tried for these **37 sites** and dropped | `CONVENTIONS.md:81` | **STALE — SUSPECTED** | `alpha-steps.test.ts:35` says 37 too, but nothing counts it. Measured now: **40** `ring-ring` occurrences across **30** files; 27 spelled `focus-visible:ring-[3px]`, 5 `data-focus-visible:ring-[3px]`. Replace the number with "every focus ring" or make the test count |
| C9 | White measured **2.13:1** on warning and **3.81** on destructive | `CONVENTIONS.md:83` | **TRUE — CONFIRMED** | `packages/ui/src/simples/status.tsx:19`, `simples/button.tsx:46-47`, `packages/palette/src/palettes.test.ts:109,172`, `roles.test.ts:233`, `ramp.test.ts:188`, `ramp.ts:507`. Six independent records |
| C10 | `text-destructive-content` and its three siblings now exist | `CONVENTIONS.md:83` | **TRUE — CONFIRMED** | `packages/theme/tokens.css` defines `--destructive-content` + `info`/`success`/`warning` siblings |
| C11 | `-foreground` means two things; do not "fix" it | `CONVENTIONS.md:84` | **TRUE — CONFIRMED, and the highest-value sentence in the file** | this is the correction of a wrong audit finding (`.planning/ARCHITECTURE-AUDIT.md:348-360` proposed `--destructive-emphasis`; it was applied and reverted, `.planning/PLAN.md:42-46`) |
| C12 | Theming = tokens only; attributes on `<html>` because Ark portals to `document.body` | `CONVENTIONS.md:85` | **TRUE — CONFIRMED** | `theme/KanzoThemeProvider.tsx`; the reason is also in `packages/theme/tokens.css:19` |
| C13 | "The only bespoke code is the CodeMirror editors (`CodeEditor`/`GhostEditor`)" | `CONVENTIONS.md:86` | **FALSE twice — CONFIRMED** | (a) `GhostEditor` does not exist: it became `CompletionField` (`43e2e52`) and then was deleted, ghost completion folded into `CodeEditor`'s `complete` prop (`packages/ui/src/editor.ts:11-12`); the only survivals are two prose mentions at `packages/ui/src/index.tsx:164,249`. (b) The sentence contradicts `CONVENTIONS.md:87` five lines later — "Ark ships no sidebar, status bar, toolbar, field array or app shell" — and ignores `composites/sidebar.tsx`, `layouts/shell.tsx`, `simples/FieldArray.tsx`, `simples/FacetFilter.tsx`, `charts/` (23 files over Mosaic), `table/` (9 modules over TanStack) |
| C14 | Ark two-clause accessibility rule; check `@ark-ui/react/dist/components/` first | `CONVENTIONS.md:87-89` | **TRUE, path is workspace-relative — CONFIRMED** | 73 dirs at `packages/ui/node_modules/@ark-ui/react/dist/components/`; the path does not resolve from the repo root. Worth spelling out |
| C15 | `ark.*` on every part, no exemption; never `ComponentProps<"div">` | `CONVENTIONS.md:90` | **RULE TRUE, COMPLIANCE PARTIAL — CONFIRMED** | violated at `simples/floating-panel.tsx:31,113`, `simples/command.tsx:226,242`, `composites/sidebar.tsx:45,421`, `composites/SidebarIdentity.tsx:18,78,105`. No test enforces it |
| C16 | `data-slot` on every targetable part; the popover recipe depends on it | `CONVENTIONS.md:91` | **RULE TRUE, EXAMPLE TRUE, COMPLIANCE PARTIAL — CONFIRMED** | the exact string is at `simples/popover.tsx:138`. Eight files render DOM with no `data-slot`: `simples/suggest.tsx`, `composites/Breadcrumbs.tsx`, `composites/InstanceSwitcher.tsx`, `charts/chart-inputs.tsx`, `charts/chart-stat.tsx`, `table/DataTable.tsx`, plus IN-FLIGHT `composites/AppearanceToggle.tsx` and `composites/identity-notice.tsx`. No test enforces it |
| C17 | "Exactly one `<main>`. `ShellMain` / **`SidebarInset`** own it. Every nestable container (**`PageShell`**) uses `<section>`" | `CONVENTIONS.md:92` | **FALSE twice — CONFIRMED** | (a) `SidebarInset` is deliberately **not** a `<main>`: `composites/sidebar.tsx:347-349` and `DESIGN.md:141-144` both say so, and `layouts/shell.test.tsx:127` tests it. This copy of the rule contradicts the canonical one. (b) `PageShell` was merged into `layouts/section.tsx` in `1eb85e6`; the nestable container is `SectionRoot`/`SectionBody`, and `layouts/section.tsx:174-176` carries the correct comment |
| C18 | File naming kebab-case; some older files PascalCase, converging | `CONVENTIONS.md:93` | **TRUE, and not converging — CONFIRMED** | 14 PascalCase files still in `simples/` alone (`DateField`, `EmptyState`, `FacetFilter`, `FieldArray`, `Link`, `Ribbon`, `TextField`, …) plus most of `composites/`. "Converge over time" with no deadline and no test is a rule that will not converge |
| C19 | Export naming flat; wrapping an Ark machine → bare name; our own compound → `*Root` | `CONVENTIONS.md:94-103` | **TRUE — CONFIRMED** | `Accordion`/`Field`/`Pagination`/`Table`/`InputGroup` bare; `ShellRoot`/`SectionRoot`/`CompleteRoot`/`SuggestRoot`/`ChartRoot`/`DataTableRoot` all present |
| C20 | "A component may only export dot-notation if it also exports the flat names; **no component does today**" | `CONVENTIONS.md:104` | **FALSE — CONFIRMED** | `packages/ui/src/composites/Preferences.tsx:515` (HEAD: `:423`) is `export const Preferences = Object.assign(…)`, i.e. exactly a dot-notation namespace beside flat parts. And the real reason not to is stronger than "two dialects": `packages/ui/src/layouts/shell.tsx:14-17` — "`Object.assign` does not survive the RSC client boundary — `Preferences` learned that the hard way". That reason is in a source comment and not in `CONVENTIONS.md` |
| C21 | Client boundary: `"use client"` iff hooks/listeners; `preserveModules` + `rollup-plugin-preserve-directives`; Vite ignores it; `pnpm smoke` + docs build catch it | `CONVENTIONS.md:108-113` | **TRUE — CONFIRMED** | `packages/ui/vite.config.ts` registers the plugin with `preserveModules: true`; `.github/workflows/ci.yml:36-45` documents the fixture's honest scope |
| C22 | Optional peers never in the root barrel | `CONVENTIONS.md:113` | **TRUE — CONFIRMED** | `packages/ui/package.json` `peerDependenciesMeta` marks 13 optional; subpaths `.`/`./editor`/`./table`/`./analytics` |
| C23 | Testing: minimum bar is render + the behaviour the recipe depends on; guard rails in `index.test.ts` and `pnpm smoke` | `CONVENTIONS.md:117-120` | **INCOMPLETE — CONFIRMED** | there are **four** repo-wide guard tests, not one: `packages/ui/src/index.test.ts`, `alpha-steps.test.ts`, `logical-properties.test.ts`, `no-literal-hues.test.ts`, plus `packages/theme/src/boundary.test.ts`. Three are unmentioned |
| C24 | `@kanzo-tech/palette` is authoring-time only; the categorical search costs 0.2–7.4 s | `CONVENTIONS.md:124` | **TRUE — CONFIRMED** | `packages/theme/src/boundary.test.ts:12-18` states the same numbers as the reason |
| C25 | theme depends on palette as a **devDependency**; `boundary.test.ts` fails if that moves | `CONVENTIONS.md:125` | **TRUE — CONFIRMED** | `packages/theme/package.json` `devDependencies: {"@kanzo-tech/palette": "workspace:*"}`, no `dependencies` block at all; `boundary.test.ts:20-27` asserts absence from `dependencies` and presence in `devDependencies`; `:31-38` also greps shipped source for the import specifier. **This is the model the rest of the guidance should copy** — a rule whose enforcement and whose reason live in the same file |
| C26 | theme ships no React, no components, no colour maths; exports `AXES`, `DEFAULT_PREFS` | `CONVENTIONS.md:125` | **TRUE — CONFIRMED** | `packages/theme/package.json` has no React peer; `packages/theme/src/index.ts:219` `AXES`, `:186` `DEFAULT_PREFS` |
| C27 | The theming runtime is `KanzoThemeProvider`, `useKanzoTheme`, `themeScript`, `cookieStorageAdapter`, `Preferences` | `CONVENTIONS.md:126` | **TRUE — CONFIRMED** | `packages/ui/src/theme/` + `composites/Preferences.tsx` |
| C28 | Semver via changesets | `CONVENTIONS.md:128` | **TRUE, unexercised — CONFIRMED** | `.changeset/config.json`, `.github/workflows/release.yml`; 62 changesets accumulated, nothing published |

### 1c. `README.md` — the worst document in the repo

Not in the brief's list by name, but it is the file a cold reader opens and it ships to npm.
Last touched at `33caf88`, the second commit in the repo.

| # | Claim | `file:line` | Verdict |
|---|---|---|---|
| R1 | `@kanzo-tech/ui` ships "Level 2 domain-free shells (Sidebar, **TopBar**, **StatusBar**, **WorkspaceLayout** / Resizable, **CommandPalette**, **EditorShell**)" | `README.md:24` | **FALSE ×5 — CONFIRMED.** Five of the six symbols do not exist. `EditorShell`→`CodeEditor` (`cb330fb`) |
| R2 | Theming is "base colour · accent · radius · font · density · light/dark" | `README.md:23`, `:71` | **FALSE — CONFIRMED.** Colour stopped being an axis: `packages/theme/tokens.css:19` "There is no colour AXIS. `data-base`, `data-accent`, `data-palette` and `data-chart-scheme` are…"; `packages/theme/src/index.ts:126-131` (HEAD) lists four axes, none of them colour |
| R3 | `<KanzoThemeProvider defaults={{ accent: "blue" }}>` | `README.md:60` | **FALSE — CONFIRMED.** The accent axis was replaced by the palette in `1975b9a`; the flagship snippet on the npm landing page does not describe a real API. This is the *same defect* `.changeset/one-theming-story.md:36-40` recorded as fixed once already |
| R4 | "`<Preferences />` for a live theme editor (base · accent · radius · font · density · light/dark)" | `README.md:70-71` | **FALSE — CONFIRMED** (same cause) |
| R5 | "Components that need CodeMirror (`EditorShell`, `GhostEditor`)" | `README.md:80` | **FALSE ×2 — CONFIRMED** |
| R6 | No mention of `DESIGN.md` or `CONVENTIONS.md` anywhere | `README.md` (absence) | **CONFIRMED.** `grep -ln "DESIGN.md\|CONVENTIONS.md" README.md packages/*/README.md` → no matches |
| R7 | Root `package.json` description: "shared **Radix Themes** primitives & shells" | `package.json:5` | **FALSE — CONFIRMED.** Flagged eight days ago at `.planning/NEW-COMPONENTS.md:677` and still there |
| R8 | `packages/ui/README.md` — "Level 1 primitives / Level 2 shells", `TopBar`, `StatusBar`, `WorkspaceLayout`, `CommandPalette`, `PageShell`, "the CodeMirror 6 `EditorShell`" | `packages/ui/README.md:7-15` | **FALSE ×7 — CONFIRMED.** Layer names were renamed in `458cee0`. This file is in `files: ["dist","README.md"]` — it is the npm page |
| R9 | `packages/theme/README.md`, `packages/palette/README.md` | — | **CURRENT — CONFIRMED.** Both accurate and well written. `packages/theme/README.md:36` even states the *absence* of the colour axis. `packages/palette/README.md` is IN-FLIGHT and describes identities |

**Verdict on §1.** `DESIGN.md` is 85 % true and its errors cluster in exactly one place — the two
paragraphs that quote *measurements* (`:221-240`) and the one that quotes *file:line* (`:249-273`).
`CONVENTIONS.md` is 82 % true and its errors cluster in the bullets it **duplicates from
`DESIGN.md`** (`:92`) or asserts without a test (`:86`, `:104`). Prose survives; numbers and paths
rot. That is the finding that shapes everything below: **a guidance document should not carry a
number or a `file:line` unless a test carries it too.**

---

## §5 — Recurrence inventory (the real specification)

Reconstructed from 178 commit subjects and 62 changeset bodies. A rule nobody breaks does not need
writing down. These seven do, and three of them are already unmissable because someone turned them
into a test — which is the pattern to generalise.

### R-1 · "N ways to do one thing" — 9 instances, the dominant failure mode

The single most common commit in this repo is the collapse of two or three implementations of one
idea. The repo names it itself: `.changeset/what-the-surface-audit-changed.md:7` — **"Two components
that were one, again."**

| Instance | Evidence | Ways |
|---|---|---|
| Colour drawn three ways | `.changeset/swatch-primitive.md:7` "Colour was drawn three ways in this library: `ColorField`'s picker in Preferences, a bare…" | 3 |
| Preferences drawing options three ways | `f5bf1c9` "Preferences can select a palette, and **stops drawing options three ways**" | 3 |
| Colour expressed four ways at runtime | `.changeset/ui-collapses-onto-the-document.md:10` "`data-base`, `data-accent`, `data-palette`, `data-chart-scheme` — three ways to express *part* of a palette" ; `packages/theme/tokens.css:19` | 4 |
| Two facet-filter families | `7317f79` "one FacetFilter behind both" → `1f9a1dd` "**two families that were one**" | 2 |
| Two theme providers | `.changeset/one-theming-story.md:7` "`KanzoTheme` is removed"; the dead one was the *documented* entry point with zero JSX usages | 2 |
| Two fieldsets | `.changeset/one-fieldset-not-two.md` | 2 |
| Three header vocabularies | `DESIGN.md:178-180` `SectionHeader`/`PageShell`/`TopBarMain`; merged in `1eb85e6` | 3 |
| Three copies of one strip | `DESIGN.md:130-131` `Toolbar`/`StatusBar`/`TopBarUtility` → `ShellBar` → deleted | 3, over 3 attempts |
| `CardRadioGroup` over `RadioGroupCard` | `06a3231`; `packages/ui/src/index.tsx:175-178` | 2 |

**The rule that would have prevented all nine, and which is written nowhere:** *before adding a
way to express X, grep for the ways X is already expressed.* The owner's "minimal system —
the fundamental pieces to grow from" is this rule stated as a goal. It belongs in the first ten
lines of the entry document.

### R-2 · Untokenised colour — 3 rounds, now a test. The template to copy.

| Round | Evidence |
|---|---|
| 1 | `963ebb7` "four inherited Shark defects, plus the logical-property sweep" |
| 2 | `c074ec6` "status fills had no on-fill ink, and **were failing AA everywhere**" — `simples/status.tsx:19` records warning at 2.13, `simples/button.tsx:46-47` white 3.81 / near-black 4.15 on red-500 |
| 3 | `d6f7f53` "tell a colour from a column, **in every spelling a colour has**" |
| Closure | `f45d19f` "**test(ui): no hue is written by hand**" → `packages/ui/src/no-literal-hues.test.ts` |

`CONVENTIONS.md:83` records the lesson in the right register: *"an untokenised colour is a colour
no test can measure. An exception to this rule is where a defect goes to hide."* That sentence is
the best thing in the guidance system. It exists because the mistake was made three times.

### R-3 · A percentage where a step was needed — 3 rounds, now a test, **not in the guidance**

| Round | Evidence |
|---|---|
| 1 | `0703fe5` "alpha roles, **because a percentage is right in one mode**" |
| 2 | `e210a59` "a field recesses, and a search hit stops being a warning" (IN-FLIGHT changesets `field-recess-and-match.md`, `wash-roles-and-faint.md`) |
| 3 | the same symptom had already been hand-written out in three places — `alpha-steps.test.ts:59-63`: "a badge at `bg-destructive` 10% with a dark override to 5%, a menu and a listbox at 10% with a dark override onto a *different token*, and a slider track doing the same at 24%" |
| Closure | `packages/ui/src/alpha-steps.test.ts:92-127` — **seven** banned regexes |

**`CONVENTIONS.md:80` documents two of the seven.** The other five — status washes, `--X-border`,
`bg-accent/NN`, `text-muted-foreground/NN` → `--faint`, `bg-input/NN` — an agent meets only as a
red test. This is the largest single gap in `CONVENTIONS.md` (§7 G1).

### R-4 · `data-slot` omitted — 3 rounds, still no test

| Round | Evidence |
|---|---|
| 1 | `f6d8c6d` "Add data-slot to the bespoke roots that lacked it (F7)" — closing `.planning/ARK-USAGE-AUDIT.md:323-342` |
| 2 | `12cfbc0` "data-slot on Rating/TagsInput hidden inputs" |
| 3 | `ce349e9` "ComboboxTrigger **keeps** its data-slot" — i.e. a regression |
| Open | eight files render DOM with none today (see C16), and the set has migrated to `charts/` and `table/` where nobody looked |

Three occurrences, a written rule (`CONVENTIONS.md:91`), and no test. Compare R-2 and R-3, which
recurred the same number of times and were closed by a test. **`data-slot` is the next test to
write, not the next paragraph.**

### R-5 · A role claimed without its keyboard contract — 2 rounds

| Round | Evidence |
|---|---|
| 1 | `4d073d7` "**Implement the ARIA roles StatusBar and Toolbar only claimed**" — `.planning/ARK-USAGE-AUDIT.md:73-119` |
| 2 | `7317f79` "**a filter is a value, so it stops being a menu**" — a `menuitemcheckbox` list cannot announce "2 of 5 selected" (`DESIGN.md:332-334`) |
| Closure | negative decision now tested: `layouts/shell.test.tsx:69` "Not `role="toolbar"`: a region of arbitrary children cannot provide roving focus" |

`CONVENTIONS.md:89` states it well and `DESIGN.md:286-341` gives the taxonomy. This one is
adequately covered.

### R-6 · The fix applied at the wrong layer — 2 rounds, one bug

| Round | Evidence |
|---|---|
| 1 | `eef4538` "Stop the docs' prose styles leaking into every rendered example" — fixed **docs-side** with a containment rule |
| 2 | `5f0fa20` "**scope the typography plugin** so the stylesheet stops repainting other people's `.prose`" — fixed **at source**, `packages/ui/src/styles.css:18-20` `@plugin "@tailwindcss/typography" { className: kanzo-prose; }` |

The same bug, twice, because the first fix was in the consumer. The diagnosis is at
`.planning/DOCS-QUALITY.md:30-43` (`.prose :where(a)` at 0,1,0 beats Preflight's `a` at 0,0,1).
**The rule: a defect visible in `docs/` is a library defect until proven otherwise.** Written
nowhere. Adjacent to the standing lesson that `docs/` consumes `dist/`, not `src/`.

### R-7 · A rename leaves its dead name in prose — 7 live sites

Renames are executed cleanly in code and never swept out of prose.

| Dead name | Renamed/deleted at | Still asserted at |
|---|---|---|
| `GhostEditor` | `43e2e52`→`CompletionField`, then deleted | `CONVENTIONS.md:86`, `README.md:80`, `packages/ui/src/index.tsx:164,249` |
| `EditorShell` | `cb330fb`→`CodeEditor` | `README.md:24,80`, `packages/ui/README.md:13` |
| `CardRadioGroup` | `06a3231` deleted | `DESIGN.md:264,266` |
| `SecretField` | folded into `password-input` | `DESIGN.md:98` |
| `PageShell` | `1eb85e6` merged | `CONVENTIONS.md:92` |
| `docs/blocks/` | `c6cad41`→`docs/showcases/` | `DESIGN.md:23,349`, `layouts/shell.tsx:12`, `.planning/LAYOUT-DESIGN.md:16,147,158` |
| `TopBar`/`StatusBar`/`WorkspaceLayout`/`CommandPalette` | `a193d76`, `d277f90` | `README.md:24`, `packages/ui/README.md:10-12` |

`0f8f2eb` "Point CONVENTIONS at CodeEditor, not the old EditorShell name" shows the sweep is
*sometimes* done. **The cheap fix is a test**: a guard that greps the guidance documents for
backticked identifiers and fails when one resolves to no export. `packages/theme/src/boundary.test.ts`
already proves this shape works.

### R-8 · A component designed twice or more — 5 families

Not a broken rule; a re-litigated decision. This is the recurrence that the owner's third standing
constraint ("prior decisions are re-openable") makes *legitimate* — so the guidance must make it
cheap, not prevent it.

| Family | Rounds | Trail |
|---|---|---|
| The stat tile | **5** | `.planning/NEW-COMPONENTS.md:266` propose `StatCard` → `5524261` rename `MetricCard` → `.planning/NAMING-TAXONOMY.md:232-234` "stays a composite" → `.planning/THIN-LAYERS.md:144-162` delete `MetricCard` → `bef70eb`/`953052a`/`13d10df` `StatTile` + `ChartStat`. Final state: `packages/ui/src/index.test.ts:60-64` |
| AI-assist | **3** | `706bc2f` "AI as `CodeEditor.complete`" → `f6b7bc0` "a decoupled Field/AiAssist pattern" → `ac37bb2` "two composed compounds over the pure inputs" (`DESIGN.md:275-284`) |
| The colour axis | **6** | `8e3717f` `data-palette` → `1975b9a` palette replaces accent → `50c3d9c` `.dark` derived → `1c9908d` categorical becomes an axis → `542c286` colour becomes a tenant document → IN-FLIGHT identity axis |
| The layout layer | **3** | `DESIGN.md:130-134` says so in the document: "This is the correction that took three attempts to reach" |
| The card radio | **3** | propose (`NEW-COMPONENTS.md:206`) → `d8222dd` "composition, not a monolith" → `06a3231` delete |

**The cost, measured:** each re-litigation left a document asserting the superseded state.
`NEW-COMPONENTS.md:266` → `NAMING-TAXONOMY.md:232` → `THIN-LAYERS.md:144` → `index.test.ts:60`
is four records of one decision, three of them false, and **only the last is a test.**

### R-9 · Audit documents that were wrong — 3, per the owner's standing lesson

The three are named at `.planning/PLAN.md:48-52`, which is currently the only surviving record:

1. **The status-token rename.** `.planning/ARCHITECTURE-AUDIT.md:348-360` finding 14 said the
   status `-foreground` tokens invert the contract and proposed `--destructive-emphasis`. It was
   applied and fully reverted — Shark defines the identical pair and uses the second as a
   background. Now written the other way at `CONVENTIONS.md:84`.
2. **"Delete the `Appearance` type."** `ARCHITECTURE-AUDIT.md:241,245,488`. It is live and
   load-bearing: `packages/theme/src/index.ts` `AppearancePref = Appearance | null`.
3. **Wave 1 step 8** (`ARCHITECTURE-AUDIT.md:480`) — "broke at runtime when applied literally"
   (`PLAN.md:50-51`).

And `.planning/LAYOUT-ARK-NATIVE-REVIEW.md:5` cites the lesson via a **dangling path**:
`.planning/audit-findings-need-verification` does not exist. The most important lesson in the
repo is one `rm PLAN.md` away from being lost.

### The minimality half of this section

Rules nobody has broken once, and which therefore should **not** be in the guidance:

- The `tv()` recipe shape (`CONVENTIONS.md:31-57`) — no commit fixes a component for not using it.
  `simples/button.tsx` *is* the documentation. Replace 27 lines with one pointer.
- `forwardRef` (`CONVENTIONS.md:62-66`) — zero occurrences in `packages/ui/src`; nobody has added
  one. Keep one line, delete the paragraph.
- "Logical properties, never physical" (`DESIGN.md:155`) — broken once (`963ebb7`), closed by
  `packages/ui/src/logical-properties.test.ts`. **The test is the rule.** One line, pointing at it.
- The `ark.*` factory rule (`CONVENTIONS.md:90`) — broken but never *re-*broken, and the current
  violations are inherited Shark shapes. Keep the rule, drop the history.

Guidance earns its lines from recurrence. Nine instances of R-1 justify a headline; a rule with
zero recurrences justifies a pointer at the test or the reference file.

---

## §2 — Contradictions

### 2a. `CONVENTIONS.md` vs `DESIGN.md` — the duplicated rule rotted

Three things are stated in both. In every case the `DESIGN.md` copy is right and the
`CONVENTIONS.md` copy is either wrong or thinner.

| Rule | `DESIGN.md` | `CONVENTIONS.md` | Which is right |
|---|---|---|---|
| One `<main>` | `:141-144` — "`SidebarInset` is a neutral offset `<div>`, **not** a `<main>`", with the shadcn contrast | `:92` — "`ShellMain` / **`SidebarInset`** own it", and cites the deleted `PageShell` | **`DESIGN.md`.** The code (`composites/sidebar.tsx:349`) and the test (`layouts/shell.test.tsx:127`) agree with it. `CONVENTIONS.md:92` would make an agent add a landmark that a test then fails |
| The three layers | `:57-64` — with a "Test" column per layer | `:12-20` — the same table, no test column | **`DESIGN.md`.** Delete the `CONVENTIONS.md` copy, keep the pointer already at `:3` |
| Domain-free / admission | `:207-216` — four numbered rules | `:27` — one sentence | **`DESIGN.md`.** `CONVENTIONS.md:27` is a summary of a rule stated fully 180 lines away in another file |

**Canonical assignment, going forward:** `DESIGN.md` (or its successor) owns *what the system is* —
axes, layers, admission, taxonomy, landmarks. `CONVENTIONS.md` owns *how to type a file* — the
recipe, tokens, the client boundary, naming, tests. A rule appears in exactly one, and the other
links to it. Neither restates the other, because a restatement is a copy that will diverge, and
`:92` is the proof.

### 2b. `CONVENTIONS.md` against itself

- `:86` "The only bespoke code is the CodeMirror editors" vs `:87` "Ark ships no sidebar, status
  bar, toolbar, field array or app shell". Five lines apart. **CONFIRMED.**
- `:104` "no component does today" vs `composites/Preferences.tsx:515`. **CONFIRMED.**
- `:80` "`bg-field` … is an **alpha step**, so it never carries a `/NN`" vs
  `alpha-steps.test.ts:79-88` (IN-FLIGHT, `e210a59`): "it is no longer an alpha step in *both*
  modes … the binding takes the alpha step where it recedes and step 1 — the page — where none
  does." The ban survives; the stated reason no longer holds in dark. **IN-FLIGHT.**

### 2c. `DESIGN.md` against itself — the self-correction device

Two instances, and they behave differently.

**Instance 1 — `DESIGN.md:219-229`.** The rule is stated (`:219`), illustrated with `field.tsx`
(`:221-222`), then the illustration is retracted (`:224`) with the retraction's own measurement
(`:225-229`). Five paragraphs to deliver one rule and one obsolete example.

**Instance 2 — `DESIGN.md:264-273`.** Worse. It argues *against its own earlier reason*
("**not for the reason this doc used to give**"), builds a fresh charge, then argues the other side
("Against unwinding: …") and does not conclude. The subject was deleted five commits later.

**Verdict on the device: honest, and the wrong instrument.** Three specific failures:

1. **It is unresolved by construction.** `:264-273` presents charge and defence with no verdict.
   An agent reading top to bottom cannot act on it. `:238` does the same with a hedge the owner has
   ruled out — "a compatibility question" in a repo with nothing published.
2. **It inverts the read order.** The retraction at `:224` comes *after* the claim it kills. An
   agent that stops reading at `:222` — or that retrieves `:221` alone — acts on a false claim.
   Every mitigation ("do not cite it as current evidence") depends on reading the *next* paragraph.
3. **It grows monotonically.** Each reversal appends. `DESIGN.md` is 355 lines and its
   admission-rules section is now 34 % correction. Six colour-axis reversals (R-8) at this rate
   would double the file.

**What to keep.** The instinct is right and the repo is right to have it: a reason outlives its
example, and a deleted argument teaches nothing. The `field.tsx` lesson at `:227-229` — *"kept
because the lesson survived the example"* — is exactly correct. What is wrong is the **shape**:
correction as prose appended below the claim. The fix is a field, not a paragraph. See §8.

### 2d. Guidance vs enforcement

The most consequential contradiction in the repo is not between two documents. It is that
`CONVENTIONS.md` claims one guard test (`:117-120`) and there are five, three of which encode rules
the document never states.

| Guard | Enforces | In `CONVENTIONS.md`? |
|---|---|---|
| `packages/ui/src/index.test.ts` | export surface, hooks, deleted-component tombstones | partly, `:120` |
| `packages/ui/src/alpha-steps.test.ts` | 7 banned token spellings | **2 of 7**, `:80-81` |
| `packages/ui/src/logical-properties.test.ts` | logical properties | in `DESIGN.md:155`, not `CONVENTIONS.md` |
| `packages/ui/src/no-literal-hues.test.ts` | no hand-written hue | **no** |
| `packages/theme/src/boundary.test.ts` | the palette stays a devDependency | yes, `:125`, and cited by name |

`:125` is the one row that gets it right, and it is right because the *test file* carries the reason
(`boundary.test.ts:12-18`) and `CONVENTIONS.md` carries the pointer. **Copy that arrangement for
the other four.**

---

## §3 — `.planning/` hygiene

Eleven files, 4,140 lines. No changeset references `.planning/` at all
(`grep -ln "\.planning" .changeset/*.md` → nothing), and only two are referenced from `DESIGN.md`
(`:112`, `:200`). Applying the test — *what reason is lost by deleting this file?* — with a hard
bias to deletion.

| File | Lines | Last touched | What it is | Disposition |
|---|---|---|---|---|
| `ARCHITECTURE-AUDIT.md` | 518 | **`f7c90c1`** — never edited since the initial commit, under 177 commits of remediation | **Dead.** ~34 of 40 findings resolved; every path it cites (`primitives/`, `shells/`, `playground/`) renamed or deleted; self-inconsistent (`:3` says 50 findings, the table at `:37-78` has 40); `:17` says `themes.css` is 805 lines (it is 47) and `theme-data.json` 847 (it is 23); `:5` says "no commits on `main`" | **DELETE.** Migrate first: four open findings — no `LICENSE`/`repository` (`:74,145`), no API-surface snapshot (`:55,190`), the font axis never sets `--font-heading` (`:71,289-295`, live consumers at `simples/card.tsx:113`, `alert.tsx:85`, `dialog.tsx:295`), three hydration reads in `useState` initialisers (`:51,265`). Those four become four decision records or four issues. Its three durable rationales are already in `CONVENTIONS.md:84`, `tokens.css:19`, `PLAN.md` |
| `ARK-USAGE-AUDIT.md` | 438 | `659c5f2` — created, never edited | **Dead.** F1–F8 all target deleted files (`layouts/StatusBar.tsx`, `SidePanel.tsx`, `WorkspaceLayout.tsx`, `simples/CardRadioGroup.tsx`). All three of its `CONVENTIONS.md` recommendations were adopted almost verbatim: `:397-409`→`CONVENTIONS.md:74-76`, `:411-423`→`:87-89`, `:425-433`→`:90` | **DELETE.** The one unharvested reason is F10's provenance argument (`:369-389`): four worked examples of "reversing them would fork us from upstream for no accessibility gain". `CONVENTIONS.md:86` states the rule without the examples — move one example inline, delete the file |
| `PLAN.md` | 119 | `1151170` — created, never edited | **Dead as a plan, LIVE as the only record of two rules.** Every number stale (`:9` "five commits"; `:16` "92 prerendered pages" vs 106 `.mdx`); all five stages executed | **DO NOT DELETE until migrated — highest-priority extraction in `.planning/`.** `:39-46` "Match the reference. Do not invent." with the `gh api "repos/vinihvc/shark-ui/contents/<path>"` recipe and the worked reversal. `:48-52` "`ARCHITECTURE-AUDIT.md` is a map, not an oracle" — **the only surviving record of the three falsified findings** (R-9); `LAYOUT-ARK-NATIVE-REVIEW.md:5`'s pointer to them is dangling. Also the only tracker for one live bug: `AlertDialogAction` does not close the dialog despite extending `DialogClose` (`simples/alert-dialog.tsx:65-67` vs `:76-80` returning a plain `Button`) |
| `REVIEW-BACKLOG.md` | 137 | `06a3231` — the only maintained one | **Mostly dead task list.** §1, §2, §4b, §6, §7 and the suggested order all executed | **DELETE, extracting four items.** Still open and recorded nowhere else: `Calendar` "visualmente totalmente roto" (`:72`, no commit anywhere touches it); `ColorPicker` swatch click behaviour (`:76`, and `simples/color-picker.tsx` still carries a `text-white` literal); the "do **not** copy Shark's hand-kept thumbnail map" tradeoff (`:107-109`, implemented in `docs/components/components-list.tsx`, written nowhere); the `Heading`/`Text`→`prose` provenance argument (`:55-62`) |
| `NEW-COMPONENTS.md` | 734 | `f7c90c1` — never edited | **Dead**, and superseded on its central proposal. Spanish prose, English API blocks. Tally: **15 shipped** (4 own + 11 registry inputs), **27+ not shipped** — including the entire 20-symbol `/form` layer (`:464-468`), which was **reversed the same week** by `FORMS-DECISION.md:10-16` and `THIN-LAYERS.md:224-242`. `:670` says `main` has no commits | **DELETE.** Its admission rule (`:10-27`) is already `DESIGN.md:207-216`. Its `rowKey` remount/focus trap (`:104-111`) is already a comment at `simples/FieldArray.tsx:18`. Its one live item — root `package.json:5` "Radix Themes" (`:677`) — is a one-line fix, not a document |
| `NAMING-TAXONOMY.md` | 348 | `1f9a1dd` | **Completed decision record**, five rounds all executed, with a stale hand-off tail (`:304-348`, including an absolute path into `~/Downloads`) | **DELETE, extracting three.** `:203` the taxonomy test — *"a machine with a switch → variant/mode; a new content contract assembled on a primitive → Pascal composite"* — is the single most reusable line and is **not** in `DESIGN.md`. `:205-209` why we do not split `AlertDialog` the way Radix does. `:276-284` the CodeEditor gutter findings (constant +9 px from double-counted padding; gutter painted on `.cm-scroller` not `.cm-gutters`) — verify these are commented in `composites/CodeEditor.tsx` first; if not, this is the highest-value loss in `.planning/`. Note `:65-73`/`:232-234` are themselves superseded (StatCard→MetricCard→deleted, R-8) |
| `THIN-LAYERS.md` | 294 | `06a3231` | **Completed decision record**, contract shipped 1:1 (`:191-217` matches `packages/ui/src/table/` row for row; `:97-101` "59 marks" matches `analytics.ts:27-44` exactly). Self-flags `:246-249` as historical. Internally inconsistent: `:133` says 25 marks, `:99` says 59, `:288` says 59. Blind spot: the `FacetFilter` unification is not recorded here | **DELETE, extracting five reasons — the most reason-dense file in `.planning/`.** `:14-24` why forms got a guide and charts/table got code. `:45-49` why marks cannot be Ark parts (`host.replaceChildren(vg.plot(...))` — there is no DOM for a part to own). `:136-139` why axes compile to attributes not marks (an interactor binds to the last mark added). `:150-153` why `StatTile` was resolved the *opposite* way to `MetricCard`. `:270-275` three silent, well-painted failures ⇒ verify in a browser, a unit test cannot see a DuckDB Binder Error. (`:291-294`, the size-budget lesson, is already transplanted to `packages/ui/package.json:134`) |
| `DOCS-QUALITY.md` | 174 | `5f0fa20` | **LIVE guidance.** ~20 OPEN rows verified still open line-for-line: `layout/separator.mdx` 14 lines, `forms/switch.mdx` 17, `forms/input.mdx` 27, `data-display/badge.mdx` 29 — every count matches its table at `:103-114`. Plus `simples/avatar.tsx:125` `-space-x-2` (`:150-153`) and two undecided DECISION items | **KEEP — the only live worklist in `.planning/`.** Correct two rows first: `:67-70` says `docs/examples/form/` is orphaned — it is now the example set for `docs/content/docs/forms/tanstack-form.mdx`, **do not delete it**; `:114` puts `card.mdx`/`status.mdx` in the long tail (they are 77 and 94 lines now). Its `:120-121` house-voice definition and `:92-96` preview rule belong in the conventions, not here |
| `FORMS-DECISION.md` | 162 | `fba9b94` | **A real decision record** — "what we decided, and why we decided almost nothing", reversals recorded on purpose. `DESIGN.md:200` points at it and the summary at `DESIGN.md:194-203` is faithful | **KEEP, and make it the template.** This is already 80 % of the format §8 proposes: decision, reason, what was rejected, why the rejection matters. It lacks only a status field and a reversal condition |
| `LAYOUT-DESIGN.md` | 177 | `08dda3d` | **Dead.** "A spec to execute, not a proposal to review" (`:3`) — executed. Cites `docs/blocks/` three times (`:16,147,158`) | **DELETE.** Its governing constraint (`:12-14`, the owner's own words on generic layouts) is `DESIGN.md:105-113`; its outcome is `layouts/shell.tsx` |
| `LAYOUT-ARK-NATIVE-REVIEW.md` | 472 | `d72a550` | **Live-ish reference.** `DESIGN.md:112` calls it "full grounding" for the claim that "idiomatic to Ark" is a category error for layout. Every claim URL- or `file:line`-grounded. But `:5` cites `.planning/audit-findings-need-verification`, **which does not exist** | **KEEP as the one long-form reference, or compress to 40 lines.** It is the only document that answers a question an agent will ask again ("should the layout layer be Ark-native?"). Fix the dangling pointer either way |

**Net: delete 8 of 11, keep 3** (`DOCS-QUALITY.md`, `FORMS-DECISION.md`,
`LAYOUT-ARK-NATIVE-REVIEW.md`), removing ~3,400 lines. Do not archive: an archive directory is a
place where false claims keep their `file:line` citations and a future grep finds them. Under the
no-legacy rule, a reason worth keeping is worth *moving*; everything else is `git log`.

The 14 extractions above are the input to §8. Every one is one to four lines. They fit in ~120
lines of decision records — against 3,400 deleted.

---

## §6 — `.changeset/` review

62 files, 1,964 lines, ~32 lines each, 9 major · 58 minor · 13 patch. Nothing published.
Five reference `DESIGN.md`/`CONVENTIONS.md`; none references `.planning/`.

**They are a work journal wearing release-note clothes, and the prose is excellent.**
`.changeset/one-theming-story.md` is a better decision record than anything in `.planning/`: it
states the removal, the reason overlays portal to `document.body`, the migration diff, and the new
CI gate. `.changeset/what-the-surface-audit-changed.md` is the *only* accurate record of the export
surface today — `DESIGN.md:231-240` is the stale copy of it.

**But as releasable prose they are broken in three ways.**

1. **They describe an intermediate history no consumer ever saw.** `rename-components.md:6-8`
   announces `GhostEditor` → `CompletionField`; both names are now dead
   (`packages/ui/src/index.test.ts` tombstones `CompletionField`). Same file, `:12`: "SectionNav is
   'Sections'" — `SectionNav` was deleted in `06a3231`. Also naming dead symbols:
   `ai-system-and-shark-alignment.md` (`MetricCard`, `SecretField`, `CompletionField`),
   `publishable-artifact.md` (`EditorShell`, `GhostEditor`), `shark-quality-phase2.md`.
2. **They document APIs that no longer exist.** `one-theming-story.md:19` shows
   `defaults={{ accent: "blue", radius: "md" }}`; the accent axis was deleted in `1975b9a`. Six
   changesets describe `data-palette`, which `packages/theme/tokens.css:19` records as removed.
3. **They contradict each other on a live decision.** Both `appearance-has-no-system.md` and
   `appearance-one-control.md` are in the directory right now — two rounds of the same argument,
   both queued to ship. **IN-FLIGHT.**

The bump levels are also wrong in spirit: 58 `minor` for a stream of commits marked `!` (breaking)
in their subjects — `542c286`, `1975b9a`, `50c3d9c`, `c074ec6`, `1c9908d`, `06a3231`, `1f9a1dd`,
`cc896ff` — while only 9 files carry `major`. At `0.0.0` that is harmless; at the first publish it
is a lie.

**Proposed disposition.**

- **Before the first publish, collapse the 62 into one.** They describe the *arrival* of packages
  nobody has consumed. The honest release note for `0.1.0` is one changeset: what the packages are,
  what the four subpaths are, and the one-way doors (tokens on `<html>`, palette is authoring-time,
  optional peers on subpaths). ~40 lines. Everything else is `git log`, which is where an
  intermediate history belongs.
- **Harvest four before deleting** — they are the only current record of their subject:
  `what-the-surface-audit-changed.md` (supersedes `DESIGN.md:231-240`), `one-theming-story.md`
  (why one provider), `palette-leaves-the-runtime.md` (the boundary), `listbox-and-one-facet-filter.md`
  (menu vs listbox). Each becomes a decision record.
- **Change the house rule going forward:** a changeset says what a *consumer* must do differently.
  The reason a decision was taken goes in its decision record. Today a changeset is doing both jobs,
  which is why 32 lines is the average and why three of them ship dead names.
- **Resolve the appearance conflict now** (IN-FLIGHT). Two changesets litigating one axis will
  produce a CHANGELOG that argues with itself.

---

## §7 — Conventions gaps

Ranked by what an agent will get wrong today. Every one is absent from both documents.

| # | Gap | Why it matters here | Evidence |
|---|---|---|---|
| **G1** | **The five unstated token bans.** `CONVENTIONS.md:80-81` documents 2 of the 7 spellings `alpha-steps.test.ts` bans | The largest gap. An agent writing `bg-destructive/10`, `border-warning/20`, `bg-accent/50` or `text-muted-foreground/64` writes idiomatic Tailwind and fails a test with no prior warning. Recurred 3× (R-3) | `packages/ui/src/alpha-steps.test.ts:92-127`; replacements documented at `:66-78` (`--X-wash` a3, `--X-wash-strong` a4, `--X-border` a6, `--secondary-wash`, `--accent-wash`, `--faint` = step 10) |
| **G2** | **"No legacy, no backwards compatibility, no deprecation shims."** | The owner has now stated this twice in one session and it appears in **no file**. Its absence has already produced wrong guidance: `DESIGN.md:238` "deleting those exports is a compatibility question" in a repo where `packages/*/package.json` all read `"version": "0.0.0"` and no git tag exists. An agent that reads `DESIGN.md` cold will hedge | absence; `DESIGN.md:238` |
| **G3** | **"Minimal — the fundamental generic pieces to grow from."** Genericity over specificity | The dominant failure mode (R-1, nine instances) is *adding a second way*. `DESIGN.md:242-259`'s ladder tells you to reach for a new component last but never says *grep for the existing way first*. Nine collapses say that is the missing step | absence; `.changeset/swatch-primitive.md:7`, `f5bf1c9` |
| **G4** | **Prior decisions are re-openable.** | Stated by the owner, contradicted by the instrument: `DESIGN.md` is written to close arguments and patches itself when they reopen (§2c). Without this in writing an agent treats every paragraph as settled — including the four false ones | absence; `DESIGN.md:224,264-273` |
| **G5** | **Comment style.** | Nothing in either document. Measured density in `simples/`: `FacetFilter.tsx` 66/276, `action-bar.tsx` 57/358, `listbox.tsx` 56/317, `Ribbon.tsx` 39/119 — a third of some files. Some of it is load-bearing (`alpha-steps.test.ts:28-90` is the token argument; `SidebarIdentity.tsx:31-36` is a rule `DESIGN.md` cites), and some is the verbose JSDoc an agent then imitates. The rule needed: **a comment records a reason a reader cannot re-derive, or a measurement. Not what the code says** | absence |
| **G6** | **What a guard test is, and where the repo-wide ones live.** | `CONVENTIONS.md:117-120` names one of five. `boundary.test.ts:12-18` shows the shape — the test file carries the reason and the document carries the pointer. Unstated, so nobody writes the sixth | `alpha-steps.test.ts`, `logical-properties.test.ts`, `no-literal-hues.test.ts`, `index.test.ts`, `theme/boundary.test.ts` |
| **G7** | **Test shape and naming.** | `CONVENTIONS.md:117-120` gives a minimum bar and no shape. In practice this repo's tests are *specifications*: `describe("the control fill is an alpha step, not an opacity")`, `describe("the palette boundary")`, `it("keeps @kanzo-tech/palette out of dependencies")`, `layouts/shell.test.tsx:69` "Not `role="toolbar"`: …". The convention exists and is unwritten. Also unwritten: **a deleted component gets a tombstone assertion** (`index.test.ts:64,98,101-105`) | `alpha-steps.test.ts:92`, `boundary.test.ts:19-21` |
| **G8** | **Docs page vs example vs showcase.** | `DESIGN.md:22-25` and `:345-355` say specific arrangements are showcases; nothing says when a component needs a page, when a page needs an example, or that an example directory *is* a call site for admission rule 2. This is load-bearing — `DESIGN.md:232-233` counts 122 exports whose only consumer is one example directory, and `953052a` ("a metric tile is a Card example, not a component page") is the decision made once and never written | `docs/content/docs/` (106 `.mdx`), `docs/examples/`, `docs/showcases/`; `.planning/DOCS-QUALITY.md:92-96` has the preview rule |
| **G9** | **How to write a changeset.** | `.changeset/README.md` says how to *run* `pnpm changeset`. The house style — 30 lines of design prose — is learned by imitation, and §6 shows it is the wrong style. Nothing says a changeset addresses a consumer, or that bump level must match the `!` in the commit subject | `.changeset/README.md` |
| **G10** | **The review bar before calling work done.** | The pipeline exists (`.github/workflows/ci.yml:22-49`: build, typecheck, lint, `check:generated`, test, size, smoke, docs RSC build, publint ×2) and no document lists it. The build-first ordering is a real trap, explained only in a CI comment: packages typecheck against each other's emitted `.d.ts`, so `typecheck` on a clean checkout cannot resolve `@kanzo-tech/theme`. An agent that runs `pnpm typecheck` first sees a failure it did not cause | `.github/workflows/ci.yml:18-21` |
| **G11** | **`Show` for conditional rendering in `docs/`.** | A standing preference, in no file. Shipped as a component (`simples/show.tsx`) with a page (`docs/content/docs/layout/show.mdx`) and enforced once by hand (`f39403e` "render conditionals through Show"). The subtlety — children are an eager prop, so deref guards must stay `&&` — is exactly the kind of thing that must be written once | `grep "\bShow\b" CONVENTIONS.md DESIGN.md` → nothing |
| **G12** | **`ButtonGroup` for control clusters, never hand-rolled.** | Another standing preference in no file, with a specific shape (one group per cluster, not one split by a separator) | absence |
| **G13** | **The dead-name sweep.** | R-7: seven live sites. A rename is complete when no document asserts the old name. Unwritten, and cheaply testable | `CONVENTIONS.md:86`, `DESIGN.md:98,264`, `README.md:24,80` |
| **G14** | **Where a measurement lives.** | The rot in §1 is entirely in numbers and paths. The rule that follows: **a number in prose must be reproducible by a command in the same paragraph, or it belongs in a test.** `boundary.test.ts` and `alpha-steps.test.ts` do this; `DESIGN.md:231-240` does not, and four of its seven figures are wrong | `DESIGN.md:231-240` vs `alpha-steps.test.ts:34` |

---

## §8 — The central proposal: how this repo records a decision

The problem, stated once: **`DESIGN.md` closes arguments, and the owner wants arguments that can be
reopened cheaply without losing the reason.** A prose document cannot do both. Appending a
correction below a claim (`DESIGN.md:224`) preserves the reason and destroys the readability;
overwriting the claim preserves the readability and destroys the reason.

A record with fields does both, because a reversal changes a field instead of adding a paragraph.

### The format

One file per decision, `decisions/<slug>.md`, four fields, no prose outside them.

```markdown
# A palette is the colour identity

- **Status** live — 2026-07-26
- **Decided** Colour is a tenant palette document derived once at onboarding, not a runtime axis.
  `data-base`, `data-accent`, `data-palette` and `data-chart-scheme` are deleted.
- **Because** four attributes expressed *part* of a palette; a document expresses all of it at
  once, and a client's colour has to reach `--primary`, the charts, the graph and the dashboards
  from one artefact.
- **Reversed by** a tenant needing to switch identity per *request* rather than per document —
  then the axis comes back, for identity only.
- **Held by** `packages/theme/src/index.test.ts:34`, `packages/theme/tokens.css:19`
```

Five lines. The fields earn their place:

- **Status** is the field the current system lacks, and its absence is the whole §1 problem. It
  makes a dead decision impossible to mistake for a live rule: `superseded by <slug>` is one edit,
  and an agent that greps `decisions/` and filters on `Status: live` gets today's rules with no
  reading of history. `DESIGN.md:224`'s three-sentence apology becomes `Status: superseded`.
- **Because** is one line, deliberately. The nine-line arguments in `DESIGN.md` are nine lines
  because prose has nowhere else to put the evidence. It goes in **Held by**.
- **Reversed by** is the field that makes reopening cheap. It converts "we discussed this" into
  "here is the evidence that would change it", which is what the owner's third constraint needs.
  Absent it, reopening means re-deriving the original argument from scratch — which is what
  happened five times to the stat tile (R-8).
- **Held by** is the anti-rot device. Every number and every `file:line` moves out of prose into a
  test or a source comment that CI runs. **`Because` may not contain a number.** That single
  constraint would have prevented D18, D19, D20, D21, D26 and D27 — six of the eight false claims
  in §1.

### Applied to three real decisions from today's `DESIGN.md`

**1 — the paragraph that argues with itself (`DESIGN.md:219-229`), as two records:**

```markdown
# Do not add a model before the existing parts have a consumer

- **Status** live — 2026-07-22
- **Decided** Adoption before design. A family with unrendered parts does not get a new part.
- **Because** `field.tsx` shipped thirteen parts with no consumer while four rounds of design
  went into a fourteenth.
- **Reversed by** nothing yet. The example closed; the rule did not.
- **Held by** `packages/ui/src/index.test.ts` — the tombstones, and the two adoption examples
  `06a3231` added for `ChartStat` and `ChartColorLegend`
```

```markdown
# field.tsx has no consumer

- **Status** superseded 2026-07-26 — Field is the most-consumed family in the library
- **Decided** (was) Adopt `Field` before extending it.
- **Because** it had no renderer outside its own examples.
- **Reversed by** a renderer count above zero. It is now 47 files under `docs/` and 11 modules
  inside `packages/ui/src`; two of fifteen exports remain unrendered (`FieldSeparator`, `useField`).
- **Held by** `packages/ui/src/simples/field.test.tsx`
```

The rule stays readable. The history stays available. Neither is in the other's way, and an agent
that reads only `Status: live` never sees the second file.

**2 — the unresolved argument (`DESIGN.md:264-273`), as the decision it actually became:**

```markdown
# A layout tree is children, not an attribute

- **Status** live — 2026-07-26
- **Decided** No `options: T[]` prop that assembles a layout. `CardRadioGroup` is deleted; a card
  radio is `RadioGroupCard`, and the grid it owned is `columns` on `RadioGroup`.
- **Because** a record of `ReactNode`s cannot be reordered, wrapped, spread onto, or given
  `asChild` — `CardHeader`, not `<Card header={…} />`.
- **Reversed by** a layout whose arrangement is genuinely closed and which no caller has ever
  needed to reorder. None found in three attempts.
- **Held by** `packages/ui/src/index.test.ts:98`, `packages/ui/src/index.tsx:175-178`,
  `packages/ui/src/composites/SidebarIdentity.tsx:31-36`
```

Compare: ten lines of charge-and-defence with no verdict, about a deleted component, becomes five
lines with a verdict and a reversal condition — and a `Status` that would have flipped the day
`06a3231` landed.

**3 — the measurement paragraph (`DESIGN.md:231-240`), which should not be a document at all:**

```markdown
# An export needs a second call site, and one example is not it

- **Status** live — 2026-07-26
- **Decided** An export whose only consumer is one `docs/examples/<slug>/` directory has not met
  admission rule 2. Delete the export; keep the symbol if its own root renders it.
- **Because** the example is the page proving the part exists, not a consumer choosing it. There
  is no compatibility question — nothing is published.
- **Reversed by** a second independent call site.
- **Held by** `packages/ui/src/index.test.ts` (the pinned set and the tombstones);
  `docs/content/docs/data-display/progress.mdx:23` for the root-renders-it case
```

The seven counts leave prose entirely. If they matter, they become a test that prints them; if they
do not, they were noise. Today four of seven are wrong and the paragraph asks to be cited.

### Where the records live, and what happens to `DESIGN.md`

- `decisions/*.md` — one file per decision. ~30 files at ~6 lines: the ~16 real decisions in
  today's `DESIGN.md`, plus the 14 extractions from `.planning/` (§3). **~200 lines total**,
  replacing 355 + 3,400.
- `DESIGN.md` becomes a **60-line index**: the governing constraint, the three axes, the three
  layers, the admission ladder as a list, and a table of decision slugs with their status. No
  measurements, no `file:line`, no arguments. What survives verbatim is the prose that is a *rule*
  rather than an *argument*: `:14`, `:30-52`, `:66-72`, `:91-101`, `:139-162`, `:207-216`,
  `:242-259`, `:296-298`.
- `CONVENTIONS.md` stays roughly its current length and stops duplicating `DESIGN.md`
  (delete `:8-20`, `:27`, fix `:92`).
- **A guard test keeps the records honest.** Grep `decisions/*.md` for backticked identifiers and
  fail when one resolves to no export in `packages/*/src`; assert every `Held by` path exists and
  every `Status: superseded by <slug>` resolves. `packages/theme/src/boundary.test.ts` is the
  precedent: 40 lines, and the reason lives beside the assertion. This is the mechanism that stops
  §1 from happening again — R-7's seven dead names and D26/D27's wrong paths all fail it.

---

## §4 — The missing entry point

**The cost, measured.** An agent starting cold in this repo:

- finds no `CLAUDE.md`, no `AGENTS.md`. `.claude/` holds only `settings.local.json`, 4 lines,
  one permission.
- opens `README.md`, whose every component name is wrong (§1c) and which never mentions `DESIGN.md`
  or `CONVENTIONS.md`. `grep -ln "DESIGN.md\|CONVENTIONS.md" README.md packages/*/README.md` →
  no matches.
- may find `.planning/` first — 4,140 lines, eight files dead, one never edited since the initial
  commit while 177 commits landed on top.
- meets `alpha-steps.test.ts`'s five unstated bans as a red test.
- does not know that `pnpm build` must precede `pnpm typecheck`, or that `docs/` consumes `dist/`.
- does not know that nothing is published, so hedges on compatibility — and `DESIGN.md:238` will
  confirm the hedge.

The three constraints most expensive to get wrong — no legacy, minimal/generic, decisions are
re-openable — are transmitted only by the owner repeating them in chat. That is precisely the
failure the guidance system exists to prevent.

**What it must contain:** the three constraints, the discovery map, the four one-way doors, the
build order. **What it must not:** any rule stated elsewhere, any measurement, any history.
**Length:** under 50 lines. A `CLAUDE.md` is always loaded; every line costs context on every
turn, and a reading list is not guidance.

### Draft — `CLAUDE.md`

```markdown
# Kanzo UI — read this first

## Three standing constraints

1. **No legacy, no backwards compatibility, no deprecation shims.** Nothing is published
   (`0.0.0`, no tags). Rename and delete outright. If a document hedges on compatibility, the
   document is wrong — `DESIGN.md:238` is one.
2. **Minimal and generic.** The fundamental pieces to grow from, not a catalogue of conveniences.
   **Before adding a way to express something, grep for the ways it is already expressed.** Nine
   commits in this repo collapse two or three implementations of one idea; that is the most common
   commit here.
3. **Any decision may be reopened.** They live in `decisions/`, one file each, with the evidence
   that would reverse them. Reopening is editing a field, not winning an argument again.

## Where the rules are

- `DESIGN.md` — what the system is: the three axes, the three layers, admission, taxonomy.
- `CONVENTIONS.md` — how to write a file: the recipe, tokens, the client boundary, naming, tests.
- `decisions/` — one record per decision. `Status: live` is today's rule; anything else is history.
- Five guard tests are the rules nobody should have to remember. Read the file, not a summary:
  `packages/ui/src/alpha-steps.test.ts` (banned token spellings — there are seven, and most are
  not in `CONVENTIONS.md`), `no-literal-hues.test.ts`, `logical-properties.test.ts`,
  `index.test.ts` (export surface + tombstones), `packages/theme/src/boundary.test.ts`.

## Four one-way doors

- **Optional peers never enter the root barrel.** `/editor`, `/table`, `/analytics` exist for that.
  A static import of an optional peer from `index.tsx` breaks `import { Button }` for everyone.
- **Theme attributes go on `<html>`.** Ark portals overlays to `document.body`, and density sets
  the root font-size the whole `rem` scale resolves against.
- **`@kanzo-tech/palette` is authoring-time.** It is a devDependency of theme and
  `packages/theme/src/boundary.test.ts` fails if that moves.
- **Exactly one `<main>` per page**, owned by `ShellMain`. `SidebarInset` is a neutral `<div>`.

## Working here

- **Build before typechecking.** Packages typecheck against each other's emitted `.d.ts`, so
  `pnpm typecheck` on a clean tree cannot resolve `@kanzo-tech/theme`. `docs/` consumes `dist/`
  too: a rename typechecks clean while the docs build fails.
- Before calling work done: `pnpm build && pnpm typecheck && pnpm lint && pnpm check:generated &&
  pnpm test && pnpm size && pnpm smoke`, then `pnpm --filter @kanzo-tech/docs build` (the RSC
  fixture — nothing else catches a stripped `"use client"`).
- Charts only mount under `--webpack`; vgplot TDZs under Turbopack.
- One changeset per change, addressed to a consumer. The *reason* goes in `decisions/`.
- Other sessions write to this checkout. Attribute a stray edit before acting on it; commit by
  explicit path.
```

46 lines. It duplicates nothing: the three constraints exist nowhere else, the discovery map is a
map, the one-way doors are the four mistakes that are unrecoverable rather than merely wrong, and
the build order is currently a comment in `ci.yml:18-21`.

**Root vs directory-scoped vs skill.** Root `CLAUDE.md` gets the constraints, the map and the
one-way doors — they apply to every turn. A `packages/ui/CLAUDE.md` is unnecessary: `CONVENTIONS.md`
already lives at that altitude, and a second file at the same altitude is R-1 applied to guidance.
A `docs/CLAUDE.md` is worth 10 lines, because the docs app has genuinely local rules nothing else
records: `--webpack` for charts, the `@source` line in `global.css` that keeps the showcase sidebars
visible, one `MosaicProvider` per route (vgplot has one global coordinator), and `Show` over `&&`.
A **skill** is right for the repeatable multi-step jobs and wrong for rules: "add a component"
(recipe + page + example + test + changeset + decision record) and "sweep dead names" are skills;
"no legacy" is not.

---

## §9 — The guidance system I would ship

**Nine files, ~600 lines, down from sixteen files and ~6,300.**

| File | Owns | Length | Cross-reference |
|---|---|---|---|
| `CLAUDE.md` | The three constraints, the discovery map, the four one-way doors, the build order | 46 | the only file that names all the others |
| `DESIGN.md` | What the system is: governing constraint, three axes, three layers, engine rule, naming rule, admission ladder, the menu/listbox test. An index of decision slugs with status | ~60 | → `decisions/`, `CONVENTIONS.md` |
| `CONVENTIONS.md` | How to write a file: the recipe (by pointer to `simples/button.tsx`), tokens, the client boundary, export naming, `data-slot`, comment style, test shape, the guard-test roster | ~110 | → the five guard tests by path; → `DESIGN.md` for anything about *where* something belongs |
| `decisions/*.md` | One record per decision: `Status` / `Decided` / `Because` / `Reversed by` / `Held by`. ~30 files | ~200 | ← `DESIGN.md`'s index; `Held by` → tests |
| `README.md` | What the packages are, how to consume them, what is out of scope. Rewritten — 9 claims in it are false today | ~60 | → `CLAUDE.md` in one line |
| `packages/theme/README.md` | Already correct. Keep as-is | 124 | — |
| `packages/palette/README.md` | Already correct (IN-FLIGHT). Keep as-is | 85 | — |
| `packages/ui/README.md` | Rewritten — 7 dead names, and it is the npm page | ~25 | → `DESIGN.md` |
| `docs/CLAUDE.md` | Docs-app-local rules: `--webpack`, the `@source` line, one `MosaicProvider` per route, `Show` over `&&`, page-vs-example-vs-showcase | ~15 | → `CLAUDE.md` |

**What disappears.**

- **`.planning/` — 8 of 11 files, ~3,400 lines**, after 14 named extractions become decision
  records (§3). `DOCS-QUALITY.md` survives as the live docs worklist; `FORMS-DECISION.md` survives
  as the template the format was derived from; `LAYOUT-ARK-NATIVE-REVIEW.md` survives as the one
  long-form reference, with its dangling pointer fixed.
- **`.changeset/` — 62 files collapse to 1**, ~1,900 lines gone, after four are harvested into
  decision records (§6). Nothing has been published; there is no changelog to preserve.
- **`CONVENTIONS.md:8-20` and `:27`** — the duplicated layer table and the duplicated
  domain-free rule. One rule, one home.
- **`DESIGN.md:219-240` and `:264-273`** — the two self-arguing passages, ~30 lines, into four
  decision records.
- **`CONVENTIONS.md:31-57`** — the recipe block, into one pointer at `simples/button.tsx`. Nobody
  has ever broken it.

**Three tests that make it stay true.** The guidance rots in exactly one way — numbers and paths —
so the fix is mechanical, and this repo already has the template at
`packages/theme/src/boundary.test.ts:12-18`.

1. **Dead-name guard.** Every backticked identifier in `CLAUDE.md`, `DESIGN.md`, `CONVENTIONS.md`,
   `decisions/*.md` and every `README.md` resolves to a real export, file or token. Kills R-7's
   seven live sites, D5, D26, D27, C13, C17, R1–R5, R8.
2. **Record integrity.** Every `Held by` path exists; every `superseded by <slug>` resolves; no
   `Because` line contains a digit. Kills D18–D23 by construction.
3. **`data-slot` guard.** The next test to write, on the R-4 evidence: three occurrences, a written
   rule, no enforcement, eight files non-compliant today.

**Where the three constraints go, one last time.** `CLAUDE.md`, lines 3–20 — because they are the
rules most expensive to get wrong, they are currently transmitted only by being repeated aloud, and
one of them (**no legacy**) is actively contradicted by the guidance an agent would find instead.

---

## Appendix — IN-FLIGHT tags

27 uncommitted files, another session's identity-axis work. Findings touched by it:

- **D14** — `composites/Preferences.tsx` modified; the `FieldLabel` module count may move again.
- **D18** — `PreferencesIdentity` is a new unreferenced export in the count of 60.
- **C6** — `e210a59` + the working tree make `--field` step 1 in dark, so `CONVENTIONS.md:80`'s
  "it is an alpha step" is now true in light only. `alpha-steps.test.ts:79-88` has the correct
  version.
- **C16** — `composites/AppearanceToggle.tsx` and the new `composites/identity-notice.tsx` render
  DOM with no `data-slot`.
- **§6.3** — `.changeset/appearance-has-no-system.md` and `.changeset/appearance-one-control.md`
  are both present and litigate the same axis. `.changeset/identity-axis.md`,
  `preferences-identity-section.md` and `sub-brand-identities.md` are new and unreviewed here.
- **R-8** — the colour axis is on its sixth round; `packages/theme/src/index.ts` gains an
  `identity` axis with `source: "document"` that HEAD does not have.
- **R9/§1c** — `packages/palette/README.md` is modified and is current; `README.md` and
  `packages/ui/README.md` are untouched and are the two stalest files in the repo.
