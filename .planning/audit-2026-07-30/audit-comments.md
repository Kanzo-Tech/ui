# Comment audit — Kanzo UI

Read-only, 2026-07-30. Scope: `packages/*/src`, `packages/*/scripts`, `docs/showcases`,
`docs/examples`, `docs/components`, `docs/lib`, `docs/app`, the CSS files, the build configs, and the
`//key` idiom in every `package.json`. `DESIGN.md` and `CONVENTIONS.md` read first. Nothing was
edited; no build was run.

---

## Executive summary

**4,527 comment blocks / 8,952 comment lines across 612 files — 16% of all non-blank lines.**
**53 comments are FALSE. 31 are stale. 96 are proposed for deletion or rewrite. 6 mandatory
ARIA-contract comments are missing.**

1. **The codebase does not have a restating-comment problem.** A mechanical sweep for single-line
   comments whose every word appears in the line below returned **one hit in 612 files**. There are
   **zero** `// ---` / `/* === */` filler banners and **zero** commented-out code, in TS or CSS.
   Whatever the owner dislikes about comment volume, it is not ceremony.
2. **What it has instead is a truth problem, and it is worst in the load-bearing comments.** The
   comments that fail are the *good* ones: measurements whose subject was regenerated, counts that
   drifted, and site-tallies for utilities that no longer exist. `roles.ts:340` says "23 sites write
   `bg-input/NN`"; the only two occurrences of `bg-input/` in the repo are that comment and its twin.
3. **Six copies of one false accessibility claim ship in the reference examples.** "SidebarInset owns
   the `<main>` landmark" — `SidebarInset` renders `ark.div` (`sidebar.tsx:349`), `DESIGN.md:143`
   says so explicitly, and none of the six pages renders a `<main>` at all.
4. **`CONVENTIONS.md:92` is the upstream source of that error**, and `DESIGN.md:264-273` argues in
   the present tense about `CardRadioGroup`, which is deleted, citing two files that do not exist.
   The governing documents are themselves the highest-drift comments in the repo.
5. **"Vendored as-is" is the most dangerous falsehood.** `index.tsx:3` and `eslint.config.js:29`
   both claim the simples are Shark-verbatim/byte-faithful. There are 37 solid `ring-ring` and zero
   `ring-ring/50` — a divergence `CONVENTIONS.md:81` took a 1.29:1 measurement to justify. The
   comment invites the exact regression the measurement exists to prevent.
6. **Density is not where it was assumed to be.** `docs/examples` is the *leanest* area in the repo
   at **4%**; `docs/showcases` is mid-pack at 17%. The concentration is `packages/palette/src` —
   **2,527 comment lines, 28% of every comment in the repo** — and `packages/theme/src` at 55%.
7. **The real cost is duplication, not length.** One paragraph ("colour is not an axis; a document
   expresses all of it at once") is written out in full **nine** times; the `.json`-subpath argument
   four times; the retired-key inventory five times. Each copy is individually defensible, and it is
   why three of them went stale independently.
8. **Archaeology is ~110 comment lines and buys little.** Eight deleted component names
   (`Toolbar`, `StatusBar`, `TopBarUtility`, `TopBarMain`, `AppShell`, `WorkspaceLayout`, `ShellBar`,
   `PageShell`) survive **only** inside comments. Under a minimal-system mandate most of this goes.
9. **The mandatory rule is being broken quietly.** `floating-panel.tsx` declares `role="separator"`
   with no keyboard handler, no `aria-value*`, no ARIA comment and no test — while carrying a
   five-line ΔE measurement about its hover colour. `Ark ships splitter`; it is not used.
10. **Recommendation:** fix Section 1 before touching anything else, delete Section 3, adopt the
    Section 6 convention. `CONVENTIONS.md` currently says nothing about comments at all.

### Headline counts

| | count |
|---|---|
| Files scanned | 612 |
| Comment blocks | 4,527 |
| Comment lines | 8,952 (16% of 54,423 non-blank lines) |
| **FALSE** | **53** (34 CONFIRMED, 19 SUSPECTED) |
| **Stale** | **31** |
| Proposed delete / rewrite | 96 |
| Missing mandatory ARIA comments | 6 |
| Commented-out code | **0** |
| Content-free banners | 11 (of 80 banner comments) |
| Pure restatements | **1** |

**In-flight caveat.** The parallel session's working set **grew during this audit**, from 29 files to
40. It now also covers `AppearanceToggle.tsx`/`.test.tsx`, three `docs/content` pages, and a rename
(`example-system.tsx` → `example-follow-os.tsx`) removing the `"system"` appearance vocabulary.
Findings on those files are tagged **IN-FLIGHT** and may already be fixed.

---

## Section 1 — FALSE comments

Ordered by severity. Each is a claim I checked against the code beside it.

### 1.1 An accessibility guarantee that does not exist — 6 sites

> `{/* SidebarInset owns the `<main>` landmark. Near-empty on purpose: this page is about … */}`

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar/example-default.tsx:100`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar/example-submenu.tsx:53`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar/example-skeleton.tsx:31`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar-nav/example-default.tsx:45`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar-nav/example-active-path.tsx:28`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/examples/sidebar-user/example-default.tsx:30`

**CONFIRMED.** `SidebarInset` renders `<ark.div … data-slot="sidebar-inset">`
(`packages/ui/src/composites/sidebar.tsx:349-365`) — a `<div>`, no landmark. `DESIGN.md:143-144`
states the decision outright: *"`SidebarInset` is a neutral offset `<div>`, not a `<main>` — it is a
styling wrapper, so it carries no landmark; the `ShellMain` you place inside it does."* None of the
six files renders `ShellMain` or `<main>`. So each page ships with **no main landmark** while telling
the reader it has one, in a reference example a consumer will copy. `ShellMain` does render
`ark.main` (`layouts/shell.tsx:102-106`), and `docs/examples/shell/example-default.tsx:64` states it
correctly — so the pattern is known and these six diverge from it.

Fix: either place a `ShellMain` inside the inset (what `docs/showcases/workspace/default.tsx` and
`app-shell/default.tsx` already do) or change the comment to say the page deliberately has no
landmark. Do not leave the sentence as it stands.

### 1.2 `CONVENTIONS.md:92` — the source of 1.1

> `- **Exactly one `<main>` per page.** `ShellMain` / `SidebarInset` own it.`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/CONVENTIONS.md:92` — **CONFIRMED FALSE.** Directly
contradicted by `DESIGN.md:143-144` and by the code. `DESIGN.md` even records *why* it diverges from
shadcn here. `CONVENTIONS.md` should read `ShellMain` owns it, with the `SidebarInset` clarification.

### 1.3 `DESIGN.md:264-273` — a present-tense argument about a deleted component

> `Everyone but Ant composes card-radios; our `CardRadioGroup` is the outlier to unwind … it composes
> `RadioGroup` + `RadioGroupCard` + `Badge` (`simples/CardRadioGroup.tsx:6-7`) … it has a genuine
> second call site (`docs/examples/form/tanstack/example-card-radio-group.tsx`)`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/DESIGN.md:264-273` — **CONFIRMED FALSE, three ways.**
`CardRadioGroup` is **deleted**: `packages/ui/src/index.test.ts:98` asserts
`expect(surface.CardRadioGroup).toBeUndefined()`, `index.tsx:175` reads "No `CardRadioGroup`", and
`simples/radio-group.tsx:20` says "the deleted `CardRadioGroup`". Both cited paths —
`simples/CardRadioGroup.tsx` and `docs/examples/form/tanstack/example-card-radio-group.tsx` — **do
not exist** (`find -iname '*card-radio*'` returns nothing). The whole ten-line paragraph is a
decision that has since been executed, written as pending work.

### 1.4 "Vendored as-is" / "byte-faithful" — 2 sites, and the regression-inviting kind

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/index.tsx:3` **IN-FLIGHT** —
  `Level 1 (simples) are Shark UI components, vendored as-is (the shadcn-style registry model)`
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/eslint.config.js:29-30` —
  `Level-1 simples are adopted from Shark UI verbatim (we own the source now, but keep it
  byte-faithful for easy diffing)`

**CONFIRMED.** Measured: `packages/ui/src` contains **37** solid `ring-ring` and **0**
`ring-ring/50`, plus **18** `bg-field` — a token Shark does not have. `CONVENTIONS.md:81` records
the divergence and its measurement (Shark's diluted ring "measured 1.29:1 on the page and 1.4.11
names a focus indicator first"); `CONVENTIONS.md:80` records the `border-input`/`bg-field` split.
These two comments tell a reader the files are Shark-faithful and therefore that our solid ring is
a defect to correct — the exact regression `CONVENTIONS.md:81` exists to prevent. This is the
highest-risk false comment in the repo.

### 1.5 A migration path the library's own test proves does not exist

> `The one thing lost: docs visitors' appearance preference used to live under next-themes' `theme`
> key. It now lives on the prefs blob (`kanzo_theme_prefs.appearance`), and the migration path reads
> the DS's own legacy key, so an existing visitor lands on `system` once and re-picks.`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/components/kanzo-provider.tsx:15-17` —
**CONFIRMED FALSE, both halves.** (a) There is no migration:
`packages/ui/src/theme/KanzoThemeProvider.test.tsx:262-263` asserts the opposite in a test named
*"reads the preference from the blob, which is its only home"* — *"There is no standalone
`kanzo_appearance` key and no migration off one: the packages are unpublished, so a second storage
location would be a compatibility path bought for nobody."* `APPEARANCE_KEY` does not exist anywhere
in the tree. (b) Nobody "lands on `system`": a stored `"system"` resolves to `null`
(`KanzoThemeProvider.test.tsx:283-293`), and `packages/theme/src/index.ts:80` is emphatic that
`"system"` is not a value in this model. `KanzoProvider` renders `<KanzoThemeProvider>` with no
props — there is no migration code in the file at all. The parallel session is currently removing
the `"system"` vocabulary repo-wide, which makes this the last comment still speaking it.

### 1.6 `packages/ui/src/styles.css:22-25` — two dead attributes and a retired owner

> `Shark's exact theme sets as data-attribute rules ([data-base] / [data-accent] / [data-radius] /
> [data-font] / [data-mono-font] / [data-font-size] …). KanzoThemeProvider writes the attributes to
> <html>; dark is next-themes' `.dark`.`

**CONFIRMED, two errors.** `[data-base]` and `[data-accent]` are gone —
`packages/theme/tokens.css:20-21` says so ("`data-base`, `data-accent`, `data-palette` and
`data-chart-scheme` are gone") and `packages/theme/src/index.test.ts:24-41` *asserts their absence*.
And `.dark` is not next-themes': `KanzoThemeProvider` owns it, and `docs/app/layout.tsx:36` disables
next-themes explicitly (`<RootProvider theme={{ enabled: false }}>`).

### 1.7 `themeData.seeds.kanzo` — a path with no such key — 2 sites

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/theme/tokens.css:13` **IN-FLIGHT**
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/theme/scripts/gen-palette.mjs:5` **IN-FLIGHT**

**CONFIRMED.** `theme-data.json`'s keys are exactly `["radii","fonts","monoFonts","densities"]`.
There is no `seeds`. The seeds are `PALETTE_SEEDS` in `packages/palette/src/seeds.ts:36` — and
`gen-palette.mjs:38` itself reads `seedInput(KANZO_ID, PALETTE_SEEDS[KANZO_ID])`, three dozen lines
below the comment naming the wrong place.

### 1.8 `--ring` "overridden 42 times in `themes.css`"

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/alpha-steps.test.ts:43` —
**CONFIRMED.** `grep -c -- '--ring' packages/theme/themes.css` → **0**. `themes.css` carries only
`--radius`, `--font-sans`, `--font-mono` and a root `font-size`; `--ring` is compiled into
`tokens.css` (lines 224, 307). The *measurement* above this sentence is correct and must stay — only
this trailing justification is false.

### 1.9 `packages/theme/tokens.css:182-184` — "the two knobs", followed by one

> `/* The two knobs that are not colour and not a `data-*` default. … */`
> `--radius: 0.5rem;`

**CONFIRMED, IN-FLIGHT.** Exactly one declaration follows; the next line is the `Kanzo extras`
banner. Density, the other candidate, is not declared here at all — it is `[data-font-size]` in
`themes.css`. Wrong since written.

### 1.10 `packages/theme/tokens.css:9` — "the density steps" are not in this file

**CONFIRMED, IN-FLIGHT.** The hand-written half is said to carry "the radius scale, the font stacks,
the density steps, two keyframes …". `grep font-size` over `tokens.css` finds only the three
`--kanzo-font-size-*` IDE sizes; the density steps (`[data-font-size="compact"|"comfortable"]`) are
generated into `themes.css`.

### 1.11 `packages/ui/vite.config.ts:52-53` — the subpath is `/analytics`, not `/charts`

> `The Mosaic/vgplot + DuckDB-WASM analytics stack — optional peers of the /charts subpath`

**CONFIRMED.** The entry three lines above is `analytics: resolve(__dirname, "src/analytics.ts")`,
and `packages/ui/src/analytics.ts:3-5` argues *against* the name `/charts` at length. There is no
`/charts` subpath in `package.json`'s `exports`.

### 1.12 `packages/ui/vite.config.ts:22` — a symbol renamed and a library never used

> `// Radix-free subpath: the CodeMirror EditorShell for brand-agnostic hosts.`

**CONFIRMED, two errors.** `EditorShell` does not exist — `packages/ui/src/editor.ts:7` records the
rename to `CodeEditor`, and the only two occurrences of `EditorShell` in `src` are this comment and
that rename note. And "Radix-free" describes an absence that was never a presence:
`packages/theme/vite.config.ts:23` says Radix is something "this project has never used".

### 1.13 `packages/ui/package.json:134` `//size-limit` — the two lists do not mirror

> ``ignore` mirrors the build's `external` list in vite.config.ts — anything externalised resolves
> from the consumer's node_modules, so counting it here measures the ecosystem, not us; keep the two
> lists in sync.`

**CONFIRMED.** There are three `ignore` lists and each is a different strict subset of
`vite.config.ts`'s `external`. It matters for one of them: the `analytics subpath (JS)` entry
(`package.json:165-176`) omits `@ark-ui/react`, `lucide-react`, `tailwind-variants` and
`@internationalized/date`, while `packages/ui/src/charts/chart-inputs.tsx:5,23,24` imports
`@ark-ui/react/factory`, `/collection` and `/locale` and pulls in `Combobox`, `FacetFilter`, `Field`,
`Input`, `Slider`, `Skeleton`. So the 56.01 kB the comment records for that budget **includes Ark's
machines and lucide's icons** — precisely the externalised weight the comment's own rule excludes.
The measurement and the rule contradict each other in one paragraph.

### 1.14 `docs/package.json:39` `//deps` — the named mechanism is the wrong one

> `@kanzo-tech/palette is imported only by the palette showcase's SERVER halves … The RSC boundary
> is what keeps it out of a browser bundle, not the dependency section.`

**CONFIRMED.** `docs/showcases/palette-onboarding/parts.tsx` is `"use client"` (line 1) and imports
from `@kanzo-tech/palette` (line 25). The import is `import type`, so nothing reaches the bundle —
but the mechanism is **type erasure**, not the RSC boundary. As written the comment is falsifiable by
one grep, and a reader who adds a value import to `parts.tsx` will believe the boundary protects
them.

### 1.15 `no-literal-hues.test.ts:20-21` — a cause two siblings disprove

> `` `process.cwd()` rather than `import.meta.url`: vitest's transform does not hand this module a
> file: URL, so `fileURLToPath` throws before a single assertion runs. ``

**CONFIRMED contradicted.** `packages/ui/src/alpha-steps.test.ts:6` and
`packages/ui/src/logical-properties.test.ts:6` are in the same directory and the same vitest project
and both do `dirname(fileURLToPath(import.meta.url))`. Either the cause is wrong or it was fixed
upstream; as written it invites someone to "fix" the two siblings. (I could not run vitest — the
audit is read-only — so the *conclusion* is unverified; the *stated reason* is falsified.)

### 1.16 `logical-properties.test.ts:10` — an excluded directory that does not exist

> `Layers only — `charts/` (SVG plot geometry) and `editor/` (CodeMirror's own DOM) are not Tailwind
> box-model code.`

**CONFIRMED.** There is no `src/editor/`; the editor is `src/editor.ts` plus
`src/composites/CodeEditor.tsx`, and `composites` **is** in `LAYERS` and therefore scanned. The
enumeration is also incomplete: `table/`, `lib/` and `theme/` are equally unscanned and unmentioned.

### 1.17 `Preferences.tsx:44` — a default hotkey that is not a default

> `of Reset · Done. Open with `t`, close with Escape.`

**CONFIRMED, IN-FLIGHT.** `hotkey` is opt-in with no default — stated thirty lines below at
`Preferences.tsx:75` (*"**Opt-in — there is no default.**"*) and in
`docs/content/docs/layout/preferences.mdx:35`. The all-in-one `<Preferences />` registers no
listener. (Escape is correct.)

### 1.18 `Preferences.tsx:235` — a surface the code removed

> `{/* Footer — canonical Shark actions bar: top separator + muted surface. */}`

**CONFIRMED, IN-FLIGHT.** The element is `border-t border-border px-4 py-3` with no `bg-*`, and
`Preferences.tsx:249-252` explains *why the fill was removed* (dark `--popover` == `--muted`, ΔE ~0).
Two comments fourteen lines apart contradict each other; leftover from commit `6e8e86d`.

### 1.19 `Preferences.test.tsx:94` — the retired `system` vocabulary

> `// The matchMedia stub reports light, so the default `system` resolves to no `.dark`.`

**CONFIRMED, IN-FLIGHT.** `DEFAULT_PREFS.appearance` is `null`, and `packages/theme/src/index.ts:80`
says `"system"` is not a value in this model. The assertion beneath compares against
`DEFAULT_PREFS.appearance`; only the comment still speaks the old vocabulary.

### 1.20 `roles.ts:340` + `roles.test.ts:382` — "23 sites" that are these two comments

> `which is why 23 sites write `bg-input/NN` — a loose opacity, guessing at a …`

**CONFIRMED, IN-FLIGHT.** `grep -rn 'bg-input/'` over `packages` and `docs` returns exactly two
hits: `roles.ts:340` and `roles.test.ts:382`. The utility was removed in `542c286`; the tally
survives it. The purest example in the repo of a measurement outliving its subject.

### 1.21 `roles.ts:389` — "ten sites … are live AA failures", zero sites

> `It is the ten `text-muted-foreground/NN` sites' honest answer — those measure 3.04–4.00 and are
> live AA failures.`

**CONFIRMED, IN-FLIGHT.** One hit repo-wide: the comment itself. Removed in `0703fe5`. "are live AA
failures" is the false half and it is the half a reader would act on.

### 1.22 Four `tokens.css` "today's / it ships" claims, all regenerated away

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/roles.ts:37-39` — "today's dark
  `--card` is `color-mix(background 98%, neutral-50)` and `--popover` 96%" → now `#0d0d0d` / `#141414`
- `…/roles.ts:319-321` — "They ship byte-identical — all three are `color-mix(neutral-950 6%,
  background)`" → now `#efefef` / `#e6e6e6` / `#d9d9d9`
- `…/roles.ts:324-325` — "Today's border is step 5 in both modes (shipped `#dddddd`, `#272727`)" →
  now `#c9c9c9` / `#353535`, i.e. step 6
- `…/roles.ts:330` — "`--ring` … **It ships at 2.48:1 in light**, a live 1.4.11 failure" → now
  `#737373`, the boundary step

**CONFIRMED.** `packages/theme/tokens.css` contains **no `color-mix` at all** any more; its colour
half is generated by `compile()`. Duplicated at `roles.test.ts:429-430` and `:445-446`.

### 1.23 Counts in the palette package

All **CONFIRMED** unless marked. Verified by counting.

| `file:line` | claim | truth |
|---|---|---|
| `packages/palette/src/roles.ts:232` **IN-FLIGHT** | "Seven kinds" of `RoleBinding` | **eight** — `step, fill, on-fill, boundary, alpha, recess, categorical, fixed`; `recess` was added by the in-flight change and the count was not |
| `packages/palette/src/palette-document.ts:236` **IN-FLIGHT** | "61 copies" | **80** custom properties per block (160 in the two-block fixture) |
| `packages/palette/src/compile.test.ts:141` **IN-FLIGHT** | "3992 bytes for 61 tokens" | **4749 bytes**, **80** tokens — `compile-v2.fixture.css` is what the test asserts byte-equality against; `README.md:14`'s "~4 KB" agrees with the file, not the comment |
| `packages/palette/scripts/gen-data.mjs:227` | "Six of its seven accents sit below the chroma floor" (Nord) | Nord declares **eight** accents and **seven** are below the floor. Three other comments state it correctly (`derive-scheme.ts:24`, `palette-check.ts:214`, `derive-scheme.test.ts:307`) |
| `packages/palette/src/palettes.test.ts:141` **IN-FLIGHT** | same Nord "six of" error | as above |
| `packages/palette/src/derive-palette.test.ts:321` **IN-FLIGHT** | "all 26" | the enumeration at `:343-357` is 25 rows **per mode**, ⇒ ≥54 |
| `packages/palette/src/derive-palette.test.ts:122` **IN-FLIGHT** | "N+10 ramps rather than twelve" | **2N+10** — each identity carries a `Record<Mode, Ramp>` pair |
| `packages/palette/src/compile.test.ts:41` **IN-FLIGHT** | "purple-600 and purple-400" | `#ad46ff` is purple-**500**; purple-400 is `#c27aff` |
| `packages/palette/src/derive-scheme.test.ts:159` | "`--destructive` is red-500" | red-**600** `#e7000b`; `derive-palette.ts:57` states the `-600` divergence explicitly |
| `packages/palette/src/palette-check.ts:11` + `gen-data.mjs:113` | "the six checks" | `checkScheme` measures **five** (`band, chroma, cvd, normal, relief`) + two structural = seven. `README.md:54` names a fourth gate, `hueDistance`, that `checkScheme` never calls — SUSPECTED |
| `packages/palette/src/ramp.ts:769` | "step 8 clears 3:1 … false in light for every seed and true in dark for every seed" | `ramp.ts:313` and `:515` measure the opposite: boundary is 8 in light for 21/118 and 9 in dark for 36/118. The "18 good ramps" in the same sentence matches no count in the suite (`ramp.test.ts:88` sweeps 18 seeds **+ 48** accents) |
| `packages/palette/src/roles.test.ts:45` | "five times under the floor" | `#6e737b` is c 0.0138 against a floor of 0.1 ⇒ **7.2×**. `derive-palette.test.ts:145`'s "five to ten times" is right — SUSPECTED (minor) |
| `packages/palette/scripts/gen-data.mjs:227` | "the neutrals are nord0–nord6 verbatim" | `base05`/`base06` are nord6/nord5 — swapped — and `base07` is nord**7**, a Frost accent — SUSPECTED |
| `packages/palette/src/derive-scheme.ts:428` | "within 3.1 ΔE of the 20.9" | `SEPARATION_BAR` is 15, so the gap is **5.9**; the sibling clause in the same sentence does exactly that subtraction — SUSPECTED |
| `packages/palette/src/ramp.test.ts:50,58` | "Tailwind's tinted greys", `#6b7280` | `#6b7280` is Tailwind **v3** gray-500; v4 (what this package resolves) is `#6a7282`. Exactly the rot `gen-data.mjs:14-15` exists to prevent — SUSPECTED |

### 1.24 Symbols named in comments that do not exist

**All CONFIRMED.** No `SchemeColors`, `Scheme` type, or `Palette.primary` exists anywhere in the repo.

- `packages/palette/src/derive-scheme.ts:674`, `:679`, `derive-scheme.test.ts:341` — `SchemeColors`
  (live names: the function `deriveSchemeColors`, the interface `SchemeDerivation`)
- `packages/palette/src/derive-scheme.ts:431`, `palette-document.ts:168` — "the contract
  `Scheme.slots` already keeps"; `slots` is a field of the JSON rows in `paletteData.schemes`
- `packages/palette/src/ramp.ts:527`, `ramp.test.ts:362`, `ramp.test.ts:516` — "the thing
  `Palette.primary` exists to refuse" (live equivalents: `neutralSeedFor`, `CategoricalSource.from`)
- `packages/palette/src/palette-document.ts:150` + `packages/palette/src/compile.ts:49`
  **IN-FLIGHT** — `` `@kanzo-tech/theme`'s version at derivation time ``. `derive-palette.ts:348`
  sets it from `import pkg from "../package.json"`, i.e. **`@kanzo-tech/palette`**'s version. The
  wrong package name is baked into the emitted stylesheet banner and thus into
  `compile-v2.fixture.css:1`
- `packages/palette/src/palette-check.ts:204` — "tritan is reported by the CLI". **There is no CLI**;
  the package's only script is `scripts/gen-data.mjs`, and `tritan` appears only in
  `palette-check.ts:51`, `:64` and this comment. Nothing reports it

### 1.25 `DESIGN.md`'s own measurements have drifted

`DESIGN.md:221` and `:229` say `field.tsx` "ships thirteen parts" and "eleven of the thirteen".
`packages/ui/src/simples/field.tsx` exports **15** values — `useField` plus 14 components.
**CONFIRMED false count**, twice. Related SUSPECTED drift in the same paragraphs: "`Field` is
imported by 39 files under `docs/`" (I measure 48), "`FieldLabel` by 12 modules inside
`packages/ui/src`" (11 non-test), "14 of 21 `*Variants` objects" (10 `export const *Variants` in
`packages/ui/src`), "42 of 56 exported `useX` context aliases" (80 distinct `useX` names).
`DESIGN.md:224` already knows this failure mode — *"That was true when it was written and is no
longer true"* — so the fix is a date stamp, not deletion. See §6.

### 1.26 `DESIGN.md:250` — a stale line number

`` `RadioGroupCard` (`simples/radio-group.tsx:98`) `` — `RadioGroupCard` is defined at
`packages/ui/src/simples/radio-group.tsx:121`. **CONFIRMED.** Line 98 is a `data-focus-visible`
class string. `DESIGN.md:266`'s citation of `composites/SidebarIdentity.tsx:31-38` **is** correct, so
the drift is per-citation and silent. See §6 on citing symbols rather than lines.

### 1.27 Contradictory figures for one measurement

**SUSPECTED.** The categorical search's headline cost is given two incompatible ways:
`packages/palette/src/index.ts:8-9` and `README.md:40` say "0.2–7.4 s";
`packages/palette/src/derive-palette.ts:42` and its table at `:140` say "median of 1.1 s and 7.5 s
at worst". Fixture-level figures scatter further (`derive-palette.test.ts:49` ~1.5 s, `:64`
0.2–7.4 s, `:69` ~0.8 s, `compile.test.ts:33` ~0.8 s). `CONVENTIONS.md:124` quotes the first.
One of the two must become the citable figure and the others must point at it.

### 1.28 Three different ramp counts for one document

**CONFIRMED.** `palette-document.ts:240` "a document has ten ramps, not one";
`derive-palette.test.ts:222` "A document has twelve ramps"; `:122` "N+10 ramps rather than twelve".
Correct: 10 shared ramp objects + 2 per identity ⇒ 12 for a single-identity document.

### 1.29 Smaller confirmed and suspected items

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/theme/src/index.ts:19` **IN-FLIGHT** —
  "How many `--chart-*` custom properties the stylesheet declares." The sheet declares **nine**
  (`--chart-1..8` **plus** `--chart-capacity`, `tokens.css:204,286`); the constant and
  `boundary.test.ts:72` count `--chart-N` only. Say `--chart-N`. SUSPECTED
- `…/packages/theme/src/index.ts:153-154` **IN-FLIGHT** — "three separate things must agree on it and
  two of them are in different packages". The three are the provider, the SSR script and
  `gen-theme.mjs`; the first two are both in `@kanzo-tech/ui`, so exactly **one** is elsewhere.
  SUSPECTED
- `…/packages/ui/src/alpha-steps.test.ts:88` — "`--muted` … Its four remaining dilutions are footers
  and a table stripe". The count of four is right (`card.tsx:171`, `table.tsx:134`, `table.tsx:162`,
  `item.tsx:53`) but the fourth is `Item`'s `muted` **variant fill**, which is the very category the
  sentence uses to justify the exemption. SUSPECTED
- `…/packages/ui/src/composites/Preferences.tsx:163` **IN-FLIGHT** — "pinned top-**right**". The code
  is `items-start justify-end`, i.e. top-**end**, which mirrors under RTL. `DESIGN.md:155` and
  `logical-properties.test.ts` make "right" the wrong word in this codebase. SUSPECTED
- `…/packages/ui/src/theme/KanzoThemeProvider.tsx:17` **IN-FLIGHT** — "(the canonical mechanism,
  matching keasy + tweakcn)". Unverifiable third-party name-drop carrying no decision; the real
  reason is already at `:36-38`. SUSPECTED
- `…/packages/palette/src/ramp.ts:468` — "at most three of these, one per rule that can bite". There
  are **four** rules calling `say(...)` (`:671-694`). The bound happens to hold, but not for the
  reason given, so a fifth rule cannot be checked against it. SUSPECTED
- `…/packages/palette/src/ramp.ts:526-527` — "Only one rule can ever land here". `Ramp.relief` is
  `checkRamp`'s complete output and can carry any obligation id.
  `palette-document.ts:302-307` states the accurate version ("In practice this is `carries-identity`
  and almost nothing else"). SUSPECTED

### 1.30 Non-comment prose with the same defect (adjacent, worth one commit)

Not comments, so not in the delete list — but the same class of false claim, in the two most-read
strings in the repo.

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/package.json:5` — `"description": "Kanzo design system —
  shared **Radix Themes** primitives & shells for **keasy, fossil and metadata-form**."` Radix is
  never used (`packages/theme/vite.config.ts:23`), the engine is Ark UI, and naming three consumer
  products is what `DESIGN.md:14`'s governing constraint exists to forbid.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/package.json:4` — "primitives (**Level 1**)
  and domain-free shells (**Level 2**)". Dead vocabulary; the layers are `simples`/`composites`/
  `layouts`, and "shells" are the third layer, not the second.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/package.json:33` — `next-themes` is a direct
  dependency that nothing imports (`docs/app/layout.tsx:36` disables it via fumadocs).

---

## Section 2 — Stale comments

Distinguished from §1: these were true when written and no longer describe the tree. Distinguished
from legitimate kept history (`DESIGN.md:224-229`, `button.tsx:37-40`): the lesson has not survived
the example, or the pointer has rotted.

### 2.1 Deleted component names surviving only inside comments

`Toolbar`, `StatusBar`, `TopBarUtility`, `TopBarMain`, `AppShell`, `WorkspaceLayout`, `ShellBar`,
`PageShell` appear **nowhere in code** — only in these comments:

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/layouts/shell.tsx:27-31` — the
  `Toolbar`/`StatusBar`/`TopBarUtility` → `ShellBar` → regions history (3 attempts)
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/layouts/shell.test.tsx:17-19` — "the
  composition that replaced `StatusBar`: it used to own a `panels` prop"
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/layouts/section.tsx:12-16` — the
  `PageShell`/`SectionHeader`/`TopBarMain` three-vocabularies merge
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/index.tsx:248` **IN-FLIGHT** —
  `// ── Level 2 — shells / patterns (domain-free composites) ──`

**Recommendation (minimality).** The *lesson* in `shell.tsx:27-31` is live and specific —
"generalising an implementation while preserving a rejected appearance is not generalising" — and
`DESIGN.md:130-137` already carries it in full. Keep **one** copy, in `DESIGN.md`, and reduce
`shell.tsx:27-31` to one line: *"A region carries no height, surface, typography or font size — see
DESIGN.md, 'the layout layer'."* `section.tsx:12-16` and `shell.test.tsx:17-19` lose nothing by
going entirely.

### 2.2 `Level 1` / `Level 2` — a vocabulary neither governing document uses

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/index.tsx:3-4` **IN-FLIGHT**
- `…/packages/ui/src/index.tsx:84`, `:159`, `:187`, `:248` **IN-FLIGHT** (four banner headings)
- `…/eslint.config.js:29`
- `…/packages/ui/package.json:4`

`CONVENTIONS.md:14-16` and `DESIGN.md:57-61` define three layers by directory name. "Level 2
(composites / shells)" also silently collapses `layouts/` into `composites/`, which is the exact
conflation `DESIGN.md`'s three-axes section exists to prevent.

### 2.3 An external repo's file paths

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/SidebarNav.tsx:73-74` —
  "(was keasy's `layout/nav-main.tsx`, merged with its near-twin `SectionNav`)"
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/SidebarUser.tsx:48` —
  "(was keasy's `layout/nav-user.tsx`)"
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/index.tsx:187` **IN-FLIGHT** —
  "sourced from keasy"

Unresolvable pointers into a repo this one must not know about. Delete.

### 2.4 A deferred-work note whose work has landed

> `Raw <pre> until the read-only CodeBlock lands — CodeEditor is for editing, not this view.`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/showcases/metadata-form/default.tsx:1061-1062` —
**CONFIRMED.** `CodeBlock` exists and shipped: `docs/components/code-block.tsx:15`, consumed by
`docs/components/preview-iframe.tsx:47` and `component-preview.tsx:60`. There is a real reason it
was not adopted here — `CodeBlock` is an `async` server component and this is a client showcase —
but the comment does not say that; it says the component does not exist yet. Also half-false now:
the JSON-LD tab renders a `JsonTreeView`, not a `<pre>`. Rewrite to the real constraint or delete.

### 2.5 Back-compat rationale in an unpublished package

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/theme/prefs-config.ts:6-7`
  **IN-FLIGHT** — "This module re-exports it so the existing import sites here keep working."
  The file is a live seam (`KanzoThemeProvider.tsx:5`, `theme-script.ts:33` import from it), so the
  *file* stays — but its justification is compatibility with import sites inside this same repo,
  which is a rename away. Rewrite: *"One local import point for the axis table, so the provider and
  the SSR script cannot drift apart."*
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/theme/KanzoThemeProvider.tsx:140-149`
  **IN-FLIGHT** — the `legacyAppearance` migration block. This is compatibility with browsers that
  stored an **unpublished** library's key. Contingent: **delete the comment when the code path
  goes**, and the code path should go. Its three restatements —
  `theme-script.ts:55-65`, `KanzoThemeProvider.test.tsx:263-264`, `:285-288` — go with it.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/theme/KanzoThemeProvider.tsx:127-130`
  **IN-FLIGHT** — the seven-name retired-key inventory (`palette`, `accent`, `base`, `baseTint`, …).
  The *whitelist-on-read* decision deserves one sentence. The inventory is duplicated at
  `theme/src/index.ts:162-164`, `KanzoThemeProvider.test.tsx:329`, `theme-script.test.ts:122-123` and
  `index.test.ts:26-32` — **five copies of one list.** Keep one.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/theme/KanzoThemeProvider.test.tsx:329` —
  "and `palette`/`accent`/`baseTint` are in browsers today." An assertion about deployed state that
  nothing in the repo can confirm and that ages badly. Name the consumer and the date, or drop it.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/docs/lib/cosmos-client.ts:9` — "The old name stays as
  the local alias its call sites already import." Same class; rename the call sites.

### 2.6 `packages/theme/vite.config.ts:22-23` — archaeology about a previous config

> `(The previous config externalised @radix-ui/*, which this project has never used.)`

The first sentence ("Nothing to externalise: the entry has no runtime dependencies") is load-bearing
and verifiable — `packages/theme/package.json` has no `dependencies`. The parenthetical is a note
about a config that no longer exists. Delete the parenthetical.

### 2.7 `packages/ui/src/styles.css:30-33` and `:43-46` — two "this moved" notes

Both describe an absence ("… now live in `@kanzo-tech/theme/tokens.css`"). The forward pointer has
some value; the "now"/migration framing has none, and the reason is stated in full at
`tokens.css:137-143` and `:157-165`. Reduce each to one line naming the destination.

### 2.8 Retired-model comments in the palette package

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/palette-check.ts:43-46` —
  "a custom `base` or `baseTint` shifts these". `base`/`baseTint`/`data-base` left the product path
  entirely (`packages/theme/src/index.ts:162`, `compile.ts:8`, `theme-script.test.ts:141`). The live
  fact — the surface is now the tenant's neutral step 1 — is what the sentence should say.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/palettes.test.ts:15-16`
  **IN-FLIGHT** — "The old file held nine tests about pairing, appearance, declared brand/status
  roles and manufactured slots; none of those concepts exists any more." Nothing live turns on it.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/palette-document.ts:123-131`
  **IN-FLIGHT** — "It used to say '…', and both halves of that are now false." The two live facts
  survive without quoting a deleted comment.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/seeds.ts:9-12` **IN-FLIGHT** —
  "The old rule — 'a palette may be dark-only; do not invent a light side for Dracula' — was true
  when a palette was a set of authored hexes." Weakest keep of the three: the lesson ("a ramp keeps
  the hue and loses the mood") stands on its own two sentences later.

### 2.9 `Preferences.tsx` archaeology

- `:269-275` **IN-FLIGHT** — "This used to be a bare `<div>` plus a hand-rolled `GroupTitle` — fixed
  typography, no `htmlFor` …". The lesson ("`Field` is precisely this, wired") is one sentence and
  is also at `:295-297`. Keep the last two lines; drop the reconstruction of the old code.
- `:519-521` **IN-FLIGHT** — "Forwards Root's props and lets the trigger be restyled or repositioned
  — it used to take none, so a consumer …". Pure "used to be"; the props are self-documenting and
  `triggerClassName` has its own JSDoc at `:510`.
- `:109-116` **IN-FLIGHT** — "It used to pin `closeOnInteractOutside={false}` …". **Keep the second
  half**: `:113-116` cites `closeOnInteractOutside: modal && !alertDialog` and it exists verbatim in
  `@zag-js/dialog@1.41.2/dialog.machine.js:53`. That is an upstream-behaviour citation of the kind
  §6 asks for. Drop only the "used to pin" opening.

---

## Section 3 — Delete list

Mechanically applicable. Grouped by file, ascending line. `DELETE` removes the comment; `REWRITE`
replaces it with the given one-liner; `FIX` means the comment is false and must be corrected, not
removed (those are itemised in §1 — repeated here only where the fix is a deletion).

**Execute §1 before §3.** Deleting a false comment is fine; deleting a *measurement* because it sits
next to a false one is not.

### `packages/ui/src/index.tsx` — IN-FLIGHT, coordinate with the live session
- `3-4` — `"Level 1 (simples) are Shark UI components, vendored as-is …"` — **FIX**: false (§1.4) and
  stale vocabulary (§2.2). Replace with: `simples/ are adopted from Shark UI and rebranded to our
  tokens; composites/ and layouts/ are ours. Divergences from Shark are recorded in CONVENTIONS.md.`
- `84` — `"// ── Level 1 — primitives (Shark UI, vendored as-is; flat compound API) ──"` — **REWRITE**
  to `// ── simples ──`
- `159` — `"// ── Level 1 — bespoke atoms (no Shark equivalent; token-native, ours) ──"` —
  **REWRITE** to `// ── simples — bespoke (no Shark equivalent) ──`
- `187` — `"// ── Level 2 — composites (domain-free, token-native; sourced from keasy) ──"` —
  **REWRITE** to `// ── composites ──`; "sourced from keasy" also per §2.3
- `248` — `"// ── Level 2 — shells / patterns (domain-free composites) ──"` — **REWRITE** to
  `// ── layouts ──`
- `44-45` — `"Never exported until now, which made the panel's own doc ('every section is exported
  flat') false and left `PrefFieldSet` reachable only as an internal."` — **REWRITE** to
  `Every section is exported flat; index.test.ts keeps the list honest.` The archaeology goes stale
  on the next change and the lesson is already enforced by a test.

### `eslint.config.js`
- `29-30` — `"adopted from Shark UI verbatim … keep it byte-faithful for easy diffing"` — **FIX**
  (§1.4). Replace with `Adopted from Shark UI and rebranded; the three rules below fire only on
  Shark's own conventions.` The three-bullet list at `31-35` is accurate (`_useX` verified at
  `simples/action-bar.tsx:350`) — **KEEP**.

### `packages/ui/vite.config.ts`
- `7` — `"Pure ESM library build (mirrors the metadata-form pattern)."` — **REWRITE** to
  `Pure ESM library build.` The cross-repo pointer is unresolvable.
- `22` — `"Radix-free subpath: the CodeMirror EditorShell for brand-agnostic hosts."` — **FIX**
  (§1.12): `The CodeMirror editor, for hosts that want it without the rest of the surface.`
- `52-53` — `"optional peers of the /charts subpath"` — **FIX** (§1.11): `/analytics`.
- `35-36`, `41-42`, `45-46`, `60-61`, `64-65`, `70-72`, `80-81` — **KEEP all.** Each records a
  failure and its cause (subpath ids silently inlined; `@internationalized/date`'s tzdata
  duplicated; Rollup stripping `"use client"`; jsdom-less tests). Model comments.

### `packages/theme/vite.config.ts`
- `22-23` — delete the parenthetical `"(The previous config externalised @radix-ui/*, which this
  project has never used.)"`; keep `"Nothing to externalise: the entry has no runtime
  dependencies."` (§2.6)

### `packages/ui/src/styles.css`
- `22-25` — **FIX** (§1.6): drop `[data-base] / [data-accent]`, and `dark is next-themes' .dark` →
  `.dark is written by KanzoThemeProvider`.
- `30-33` — **REWRITE** to `Element-level base defaults live in @kanzo-tech/theme/tokens.css so
  Tailwind-native consumers get them too.` (§2.7)
- `43-46` — **REWRITE** to `The expand/collapse keyframes live in @kanzo-tech/theme/tokens.css.`
  (§2.7)
- `48` — `"/* Scan the component source for the utilities to emit. */"` — **KEEP**: restates the
  `@source` line, but repo memory records that removing a `@source` re-hid the showcase sidebars.
  Better: **REWRITE** to name that: `@source is load-bearing — dropping it re-hid the showcase
  sidebars.`

### `packages/theme/tokens.css` — IN-FLIGHT
- `9` — **FIX** (§1.10): "the density steps" is not in this file.
- `13` — **FIX** (§1.7): `themeData.seeds.kanzo` → `PALETTE_SEEDS` in `@kanzo-tech/palette`.
- `182-184` — **FIX** (§1.9): "The two knobs" → "The one knob", or move density here.
- `29-41`, `38-41`, `137-143`, `157-165`, `190-195`, `196-198` — **KEEP all.** `29-41` is the
  `-foreground` two-meanings documentation `CONVENTIONS.md:84` promises, verified present with its
  four measured ratios. `190-195` records a token deleted for having zero consumers. `196-198` is
  the do-not-hand-edit marker with the regeneration command.

### `packages/theme/scripts/gen-palette.mjs` — IN-FLIGHT
- `5` — **FIX** (§1.7): `themeData.seeds.kanzo` → `PALETTE_SEEDS[KANZO_ID]`, which line 38 already
  reads.

### `packages/theme/scripts/gen-theme.mjs`
- `49` — `"// ── Emit ──────"` — **DELETE**: content-free divider above three `out +=` lines.
- `69-71` — **DELETE**: the fourth copy of the `.json`-subpath argument (see §3 "duplication"
  below); replace with a pointer to `packages/theme/src/index.ts`.
- `26`, `29-31`, `45-47`, `68` — **KEEP**: each banner carries content (the DS ships no font files;
  the density scale matches a consumer's rem scale).

### `packages/theme/src/index.ts` — IN-FLIGHT
- `19` — **FIX** (§1.29): `--chart-*` → `--chart-N`.
- `153-154` — **FIX** (§1.29): "two of them are in different packages" → one.
- `6-9` — **KEEP as the canonical** `.json`-subpath statement; the other three copies point here.
- `162-164` — **KEEP as the canonical** retired-key list; the other four copies point here.
- `38-75` — **STRUCTURAL FIX**: this block is orphaned (blank line, then an unrelated
  declaration), so the package-level doc attaches to nothing and sits below `CHART_SLOTS`. Move it
  to the top of the file. Same defect at `KanzoThemeProvider.tsx:15-39` and `Preferences.tsx:29-63`
  — hovering either symbol in an editor shows nothing today. Highest-value structural fix in the
  theme layer; the prose is good and currently unreachable.

### `packages/ui/src/theme/prefs-config.ts` — IN-FLIGHT
- `6-7` — **REWRITE** (§2.5): `One local import point for the axis table, so the provider and the
  SSR script cannot drift apart.`

### `packages/ui/src/theme/theme-script.ts` — IN-FLIGHT
- `45` — `"// Only the serialisable axis map is needed at runtime."` — **DELETE**: restates
  `AXES.map(a => [a.key, a.attr, a.def])`.
- `52` — `"// cookie first (server-readable), then localStorage"` — **DELETE**: restates the header
  at `3-4` and the code beneath.
- `55-65` — contingent on the `legacyAppearance` path (§2.5). Delete with the code.

### `packages/ui/src/theme/KanzoThemeProvider.tsx` — IN-FLIGHT
- `17` — **DELETE** the parenthetical `"(the canonical mechanism, matching keasy + tweakcn)"`
  (§1.29); the real reason is at `36-38`.
- `127-130` — **REWRITE** to one sentence + a pointer to `theme/src/index.ts:162` (§2.5).
- `140-149` — contingent: **delete with the `legacyAppearance` code path** (§2.5).
- `276` — `"// `undefined` → default localStorage adapter; `null` → no persistence."` — **DELETE**:
  verbatim duplicate of the `storage` JSDoc at `236`, three lines away.
- `24-28`, `215-220` — **KEEP**: the `.dark`-follows-the-preference decision and the
  identity-retired callback reason.

### `packages/ui/src/theme/KanzoThemeProvider.test.tsx` — IN-FLIGHT
- `329` — **DELETE** the clause `"— and `palette`/`accent`/`baseTint` are in browsers today."`
  (§2.5)
- `263-264`, `285-288` — contingent on the migration path.
- `99`, `168-172`, `495` — **KEEP**: each records a specific regression (a cleanup that leaked past
  unmount; a partnerless palette contradicting `.dark`; why `KanzoTheme` was deleted).

### `packages/ui/src/composites/Preferences.tsx` — IN-FLIGHT
- `44` — **FIX** (§1.17): remove `"Open with `t`"` or say the hotkey is opt-in.
- `71` — `"// ── Root: Ark Dialog (non-modal, live-preview) + hotkey ──"` — **DELETE**: restates the
  function name and the JSDoc two lines down.
- `129` — `"// ── Trigger: floating palette FAB ──"` — **DELETE**: same.
- `163` — **FIX** (§1.29): "top-right" → "top-end".
- `235` — **FIX** (§1.18): the footer has no fill; `249-252` says why.
- `267` — `"// ── Section building blocks ──"` — **DELETE**: content-free.
- `313` — `"// ── Sections ──"` — **DELETE**: content-free.
- `269-275` — **REWRITE** to the last two lines only (§2.9).
- `519-521` — **DELETE** the `"it used to take none"` clause (§2.9).
- `109-112` — **DELETE** the `"It used to pin …"` opening; **KEEP `113-116`** (§2.9).
- `7-8` — **REWRITE** to a pointer at `theme/src/index.ts:6` (duplication).
- `147-150`, `249-252`, `320-325` — **KEEP all.** `147-150` is a model ARIA comment
  (`aria-expanded` + `aria-haspopup="dialog"` over `aria-pressed`). `249-252` is a ΔE measurement.
  `320-325` is arithmetic I verified end to end: `w-80` = 20rem − 2×`px-5` − 2×`px-2.5` = 16.25rem =
  260px, −15px scrollbar = 245px; `size="md"` = `size-4` = 16px (`swatch.tsx:27`), `SwatchGroup` is
  `gap-0.5` = 2px (`swatch.tsx:66`) ⇒ `18n − 2 ≤ 245` ⇒ **13**. Exactly what §6 asks a comment to be.

### `packages/ui/src/composites/Preferences.test.tsx` — IN-FLIGHT
- `94` — **FIX** (§1.19): drop the `system` vocabulary.

### `packages/ui/src/alpha-steps.test.ts`
- `43` — **DELETE** the trailing clause `"— `--ring` is overridden 42 times in `themes.css`, a
  static alpha is not"` (§1.8). **KEEP** the measurement above it.
- `88` — **FIX** (§1.29): the fourth `--muted` dilution is `Item`'s variant fill.
- `35` — **KEEP**: "the 37 focus rings" verified — `grep -o 'ring-ring'` over non-test source = 37,
  matching `CONVENTIONS.md:81`.

### `packages/ui/src/no-literal-hues.test.ts`
- `20-21` — **FIX** (§1.15): the stated cause is falsified by two siblings.
- `6-17` — **KEEP**: records two real defects (three parallel categorical palettes, two failing; the
  Preferences swatches a Tailwind major away from their accents) and why an untokenised colour is
  unmeasurable.

### `packages/ui/src/logical-properties.test.ts`
- `10` — **FIX** (§1.16): `editor/` does not exist; the list is incomplete.
- `8-9` — **KEEP**: quotes `DESIGN.md:155-156` accurately and states why the test exists.

### `packages/ui/src/layouts/shell.tsx`
- `19` — `"// ── Header / Footer ──"` — **DELETE**: content-free.
- `61` — `"// ── Root ──"` — **DELETE**: content-free.
- `113` — `"// ── Aside ──"` — **DELETE**: content-free.
- `27-31` — **REWRITE** to one line + a `DESIGN.md` pointer (§2.1).

### `packages/ui/src/layouts/shell.test.tsx`
- `17-19` — **DELETE** (§2.1): `StatusBar` archaeology; the test itself is the record.

### `packages/ui/src/layouts/section.tsx`
- `12-16` — **DELETE** (§2.1): the `PageShell`/`SectionHeader`/`TopBarMain` merge is `DESIGN.md:176`.

### `packages/ui/src/composites/SidebarNav.tsx`
- `73-74` — **DELETE** the `"(was keasy's `layout/nav-main.tsx`, merged with its near-twin
  `SectionNav`)"` parenthetical (§2.3). Keep the rest of the block — the two-ways-to-say-active
  contract at `78-81` is genuine API documentation.

### `packages/ui/src/composites/SidebarUser.tsx`
- `48` — **DELETE** the `"(was keasy's `layout/nav-user.tsx`)"` parenthetical (§2.3).
- `50-52` — **KEEP**: "`menuItems` is the ONLY mechanism. It used to carry a second, hard-coded one"
  is a domain-free guarantee a naive reader would undo.

### `packages/ui/src/composites/SidebarIdentity.tsx` — relocation, not deletion
- `31-36` — the composition-beats-an-attribute-tree argument. **This is the most valuable comment in
  the library and it is in the wrong place.** It is a general rule about the whole API surface
  (`DESIGN.md:266` already cites it as precedent against `CardRadioGroup`), sitting in the doc
  comment of one collapse-aware avatar block. **Recommendation:** promote it to `CONVENTIONS.md` as
  its own rule, immediately after the "Export naming" rule at `:94-104`, in these words:

  > **A layout tree is children, never an attribute.** A record of `ReactNode`s
  > (`label`/`description`/`icon`) cannot be reordered, wrapped, spread onto, or given `asChild`,
  > and it fixes the type of every slot — an avatar that can only be an `<img>` plus initials, never
  > a badge or a status dot. `CardHeader`, not `<Card header={…} />`.

  Then reduce `SidebarIdentity.tsx:31-36` to: `Content is children, not an object prop — see
  CONVENTIONS.md, "a layout tree is children".`
- `38-47` — the usage snippet. **KEEP**, but see §6 on tagging these `@example`.
- `7-11`, `61-63` — **KEEP**: why the file is `"use client"`, and the measured 32px/off-centre
  clipping reason for `justify-center`.

### `packages/ui/src/simples/button.tsx`
- `37-40` — **KEEP, and hold it up as the archetype.** *"(Tailwind scans comments, so the old classes
  are not quoted here — naming one would emit a live utility for it.)"* A constraint invisible in the
  code, that a naive reader would violate by "documenting" the old class. Also `44-46` — the
  `text-white` 3.81 / near-black 4.15 / AA 4.5 measurement.

### `packages/ui/src/composites/CodeEditor.tsx`
- `176` — `"// ── Floating surfaces ──"` — **DELETE**: content-free.
- `65-67`, `102-105`, `173-175`, `470-472` — **KEEP**: each is a CodeMirror-specific failure and its
  cause (gutter desync, specificity, the inset workaround, `data-focused`).

### `packages/ui/src/simples/use-ai.ts` / `use-ai.test.ts`
- `use-ai.ts:127`, `:228`; `use-ai.test.ts:11`, `:80`, `:94`, `:198`, `:265` — **KEEP all seven.**
  Each banner names the unit below it in a long file and carries a clause of content. These are the
  banner style working.

### `packages/ui/src/composites/SidebarNav.test.tsx`
- `92`, `104`, `152`, `181`, `223` — **KEEP**: five banners naming five distinct test groups, each
  with content. Working as intended.

### `packages/palette/src/roles.ts` — IN-FLIGHT
- `232` — **FIX** (§1.23): "Seven kinds" → eight.
- `37-39`, `319-321`, `324-325`, `330` — **FIX** (§1.22): four regenerated-away "today's" claims.
  Re-tense; do not delete — each measurement is why the role exists.
- `340` — **FIX** (§1.20): the "23 sites" no longer exist. Rewrite as history with a date, or delete.
- `389` — **FIX** (§1.21): "ten sites … are live AA failures" — zero sites; not live.
- `91`, `283`, `309`, `521`, `554` — **KEEP**: banners separating genuinely distinct sections of a
  589-line file.

### `packages/palette/src/palette-document.ts` — IN-FLIGHT
- `150` — **FIX** (§1.24): wrong package named. Propagates to `compile.ts:49` and the fixture.
- `168` — **FIX** (§1.24): no `Scheme` type.
- `236` — **FIX** (§1.23): 61 → 80.
- `240` — **FIX** (§1.28): reconcile the ramp count with `derive-palette.test.ts:222`.
- `164-169` — **STRUCTURAL FIX**: two `/** */` blocks back to back, both attaching to
  `CategoricalSource`; the real `CategoricalSet` at `191` has no doc at all. Move it.
- `123-131` — **REWRITE** (§2.8) to the live facts only.
- `83`, `86`, `302-307` — **KEEP**.

### `packages/palette/src/compile.ts` — IN-FLIGHT
- `49` — **FIX** (§1.24): `@kanzo-tech/theme` → `@kanzo-tech/palette` in the emitted banner. Note
  this changes generated output, so it is a `pnpm check:generated` change too.
- `69` — **KEEP**: quotes `@custom-variant dark (&:is(.dark, .dark *))` byte-exactly against
  `packages/ui/src/styles.css:28`.

### `packages/palette/src/derive-scheme.ts`
- `428` — **FIX** (§1.23): 3.1 → 5.9.
- `431`, `674`, `679` — **FIX** (§1.24): `Scheme.slots`, `SchemeColors` do not exist.
- `344-350`, `377-389` — **REWRITE as `//`** (style, §6): JSDoc on function-local consts, where the
  rest of the package uses `//`.
- `24`, `53`, `156`, `272`, `303`, `461`, `567`, `580`, `585` — **KEEP**: measurements and
  reversed-decision reasons, all verified or plausible.

### `packages/palette/src/ramp.ts`
- `468` — **FIX** (§1.29): four rules call `say(...)`, not three.
- `526-527` — **FIX** (§1.29): `relief` can carry any obligation id.
- `527` — **FIX** (§1.24): no `Palette.primary`.
- `769-770` — **FIX** (§1.23): contradicts `:313` and `:515`; the "18 good ramps" matches no count.
- `632-638` — **REWRITE as `//`** (style).
- `168`, `250`, `448`, `729` — **KEEP**: four banners in a 782-line file.
- `19-26`, `34`, `48-52`, `66`, `73`, `90`, `100`, `111`, `178`, `192`, `264`, `280-291`, `303`,
  `360-362`, `402`, `410`, `431`, `538` — **KEEP all.** This is the densest file in the repo and
  almost every line of it is a measurement against Radix's 25 chromatic scales and five tinted greys
  (both counts verified). It is the single best-documented module here and should not be trimmed.

### `packages/palette/src/ramp.test.ts`
- `50`, `58` — **FIX** (§1.23): `#6b7280` is Tailwind v3.
- `362`, `516` — **FIX** (§1.24): no `Palette.primary`.
- `172-175`, `222`, `259`, `404`, `550`, `568` — **KEEP**.

### `packages/palette/src/derive-palette.ts` — IN-FLIGHT
- `360`, `453` — **KEEP**: banners with content.
- `42`, `140` — **FIX or reconcile** (§1.27): pick one citable search timing.
- `57`, `86`, `92`, `119`, `145`, `159-160` — **KEEP**: all verified (`FAMILY_GAP` 61.81°,
  `WHEEL_STEP` 137.5078, the four status seeds at `-600`, `TINT_REFERENCE`).

### `packages/palette/src/derive-palette.test.ts` — IN-FLIGHT
- `122` — **FIX** (§1.23): `N+10` → `2N+10`.
- `222` — **FIX** (§1.28): reconcile with `palette-document.ts:240`.
- `321` — **FIX** (§1.23): "all 26" → ≥54.
- `49`, `64`, `69` — **FIX or reconcile** (§1.27): three different timings in one file.
- `145`, `198` — **KEEP**.

### `packages/palette/src/derive-scheme.test.ts`
- `159` — **FIX** (§1.23): `--destructive` is red-600.
- `341` — **FIX** (§1.24): no `SchemeColors`.
- `85`, `211`, `221`, `307`, `420-423` — **KEEP**.

### `packages/palette/src/palette-check.ts`
- `11` — **FIX** (§1.23): "the six checks" → five measurable + two structural.
- `43-46` — **REWRITE** (§2.8): `base`/`baseTint` are gone.
- `204-205` — **FIX** (§1.24): there is no CLI.
- `99`, `214` — **KEEP** (both verified).

### `packages/palette/src/palettes.test.ts` — IN-FLIGHT
- `141-142` — **FIX** (§1.23): the Nord "six of" error.
- `15-16` — **DELETE** (§2.8).
- `45`, `62`, `140` — **KEEP**.

### `packages/palette/src/compile.test.ts` — IN-FLIGHT
- `41` — **FIX** (§1.23): purple-500.
- `141-143` — **FIX** (§1.23): 4749 bytes, 80 tokens.
- `33` — **FIX or reconcile** (§1.27).
- `158`, `183` — **KEEP**.

### `packages/palette/src/roles.test.ts`
- `45` — **FIX** (§1.23): 7.2×, not five.
- `382` — **FIX** (§1.20): the 23 sites are gone.
- `429-430`, `445-446` — **FIX** (§1.22): duplicates of the regenerated-away claims.
- `232`, `310`, `337-352`, `360`, `410` — **KEEP**: all verified, including the `text-white` defect
  recorded as a binding.

### `packages/palette/src/seeds.ts` — IN-FLIGHT
- `9-12` — **REWRITE** (§2.8): keep the "a ramp keeps the hue and loses the mood" lesson; drop the
  quoted old rule.

### `packages/palette/src/index.ts` — IN-FLIGHT
- `8-9` — **FIX or reconcile** (§1.27): the search timing.
- `35-37` — **KEEP**: "Named for what it holds rather than what it used to be. 'Palette' had come to
  mean three things" — a live naming lesson.
- `3-14` — **REWRITE as a pointer**: near-verbatim copy of `README.md:36-47` and
  `CONVENTIONS.md:124`. This triplication is how the timing figure drifted.

### `packages/palette/scripts/gen-data.mjs`
- `227-228` — **FIX** (§1.23): Nord's eight accents / seven below the floor; the neutrals are not
  nord0–6 verbatim.
- `113` — **FIX** (§1.23): "all six categorical checks".
- `26`, `100`, `144`, `318` — **KEEP**: banners with content.
- `14-15`, `29`, `103`, `146`, `216-217`, `261`, `302` — **KEEP**: the "read, don't transcribe" rule
  and the Nord/Dracula source findings, verified.

### `docs/components/kanzo-provider.tsx`
- `15-17` — **FIX** (§1.5): there is no migration and nobody lands on `system`. Delete the paragraph;
  it describes a mechanism the library's own test forbids.
- `10-13`, `19-25` — **KEEP**: the two-writers-of-`.dark` problem and why `themeScript` is not
  optional for an SSR host. `:13`'s claim that next-themes is disabled in `app/layout.tsx` is
  verified (`docs/app/layout.tsx:36`).

### `docs/app/layout.tsx`
- `31-35` — **KEEP.** next-themes `0.4.6` defaulting `enableColorScheme: true` and writing
  `documentElement.style.colorScheme` as an inline declaration that outranks every rule — a precise
  upstream-version behaviour a reader could not guess. Model comment.
- `8-12` — **KEEP**: the fonts silently falling back is a recorded observed failure.

### `docs/showcases/metadata-form/default.tsx`
- `1061-1062` — **FIX or DELETE** (§2.4): `CodeBlock` has landed.
- `1050` — `"// ── The two docked panels ──"` — **KEEP** (has content: the following two lines name
  the left→right reading).

### `docs/showcases/metadata-form/data.tsx`
- `260` — `"// Distributions"` above `v.distributions.forEach(…)` — **DELETE.** The only pure
  restatement found in 612 files.
- `12`, `78`, `114`, `121`, `195`, `273`, `291`, `352` — **KEEP**: eight banners in a 356-line
  fixture file, each naming a distinct dataset and most carrying a clause.

### `docs/lib/cosmos-client.ts`
- `9` — **DELETE** (§2.5): rename the call sites instead.

### `docs/examples/sidebar/`, `sidebar-nav/`, `sidebar-user/`
- `sidebar/example-default.tsx:100`, `sidebar/example-submenu.tsx:53`,
  `sidebar/example-skeleton.tsx:31`, `sidebar-nav/example-default.tsx:45`,
  `sidebar-nav/example-active-path.tsx:28`, `sidebar-user/example-default.tsx:30` — **FIX** (§1.1).
  Six copies of one false landmark claim. Fix the pages, then reduce the comment to one line — or
  better, state it once in the sidebar MDX and drop it from all six.

### Cross-file duplication to collapse

Not per-line deletions but the largest single win available, and the mechanism behind three of the
FALSE findings. In each case: keep **one** canonical statement, replace the rest with a pointer.

| paragraph | copies | keep at |
|---|---|---|
| "colour is not an axis; a document expresses all of it at once, before a byte is sent" | **9** — `tokens.css:19-22`, `themes.css:2`, `gen-theme.mjs:9-12`, `theme/src/index.ts:41-45`, `:161-165`, `prefs-config.ts:9-13`, `theme-script.ts:16-20`, `KanzoThemeProvider.tsx:24-28`, `Preferences.tsx:46-49` | `packages/theme/tokens.css:19-22` |
| the retired-key inventory (`palette`, `accent`, `base`, `baseTint`, …) | **5** — `KanzoThemeProvider.tsx:127-130`, `theme/src/index.ts:162-164`, `KanzoThemeProvider.test.tsx:329`, `theme-script.test.ts:122-123`, `index.test.ts:26-32` | `packages/theme/src/index.ts:162-164` |
| "a raw `.json` subpath is an ESM JSON import; Node needs `with { type: "json" }`; Rollup strips it" | **4** — `theme/src/index.ts:6-9`, `index.test.ts:11-12`, `gen-theme.mjs:69-71`, `Preferences.tsx:7-8` | `packages/theme/src/index.ts:6-9` |
| "authoring-time only; the search costs N seconds" | **3** — `palette/src/index.ts:3-14`, `README.md:36-47`, `CONVENTIONS.md:124` | `CONVENTIONS.md:124` |
| `CHART_SLOTS` "declared twice on purpose … neither copy is trusted" | **2**, verbatim — `boundary.test.ts:63-67`, `theme/src/index.ts:31-34` | `packages/theme/src/index.ts:31-34` |
| `IdentityOption` rationale | **2** — `boundary.test.ts:41-47`, `theme/src/index.ts:134-139` | `packages/theme/src/index.ts:134-139` |

---

## Section 4 — MISSING mandatory comments

`CONVENTIONS.md:89`: where Ark ships no equivalent, a bespoke part **must document its ARIA contract
in a comment** and **be covered by a test**, and must never declare a composite role without
implementing that role's keyboard contract. Ark's installed component list was checked directly
(`packages/ui/node_modules/@ark-ui/react/dist/components/`, 73 entries).

### 4.1 `FloatingPanelResizeHandle` — the flagship violation

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/simples/floating-panel.tsx:143-149`

It renders a bare `<div>` with `role="separator"` and `aria-orientation="vertical"`, a
`cursor-col-resize`, and an `onPointerDown` that resizes the panel. It has:

- no `tabIndex` — the handle is not focusable
- no `onKeyDown` — `grep -n 'KeyDown\|tabIndex\|focus'` over the file returns **nothing**
- no `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-label`
- **no ARIA-contract comment**
- **no test** — `floating-panel.test.tsx` does not exist
- **no `ark.*`** — the file does not import `@ark-ui` at all, so no `asChild` either
  (`CONVENTIONS.md:90`, "no exemption")

A focusable, resizable `separator` is the WAI-ARIA window-splitter pattern, and **Ark ships
`splitter`** (verified present) — so `CONVENTIONS.md:88` says use it. Meanwhile the same file carries
a five-line *measured* comment about the handle's hover ΔE (`:133-138`). That contrast is this
report's thesis in one file: the colour is measured to two decimals and the accessibility contract
is not mentioned.

**Required:** either compose Ark's `Splitter` (preferred — `DESIGN.md:159` already says "Resizing is
composed, not a prop"), or add `tabIndex={0}`, arrow-key resize, `aria-value*`, an ARIA-contract
comment and a test.

### 4.2 `FieldArray`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/simples/FieldArray.tsx`

`CONVENTIONS.md:87` names "field array" explicitly as a family Ark does not ship. The file's only
ARIA is `aria-label={removeLabel}` at `:72`. Every comment in it is prop-level JSDoc (`:9`, `:11-17`,
`:22`, `:24`, `:27`, `:29-32`) — good documentation of the `keyFor` focus-loss trap, but **no ARIA
contract**, and **no test** (`FieldArray.test.tsx` does not exist). Add both: what announces when a
row is added or removed, and where focus lands after a remove.

### 4.3 `sortableHeader`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/table/sortableHeader.tsx`

A sortable column header with **zero** `aria-*` attributes — no `aria-sort`, which is the one
attribute the pattern is defined by. Ark ships no table. It *has* a test
(`sortableHeader.test.tsx`), so only the comment and the attribute are missing.

### 4.4 `Suggest`

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/simples/suggest.tsx:71`, `:141`

Bespoke AI candidate popover (`DESIGN.md:280`: "`Root`/`Trigger`/`Content`/`Item`, a ✨ candidate
popover"). Has two `aria-label`s and no documented contract for the surface's role, whether it is a
listbox or a menu (`DESIGN.md:286-298` makes this the axis that matters), or how arrow keys behave.

### 4.5 `Preferences` — the hotkey has no ARIA contract

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/Preferences.tsx:74-103`

The global `keydown` listener is bespoke behaviour with no Ark equivalent. The comment documents the
*policy* (opt-in; don't claim a host key) but nothing records that the shortcut is invisible to
assistive tech: there is no `aria-keyshortcuts` on `PreferencesTrigger`, and nothing says the visible
FAB is therefore the only discoverable affordance and mandatory when `hotkey` is set. (The rest of
the panel legitimately inherits Ark Dialog's contract, and `:147-150` is a model ARIA comment.)

### 4.6 `IdentityNotice` — no politeness contract

`/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/identity-notice.tsx:66-83`
**IN-FLIGHT**

Bespoke, no Ark equivalent, and it *announces* something. `type: "info"` decides whether "Brand
updated" interrupts a screen-reader user mid-sentence or waits. The two rationale-heavy comments here
cover *why it exists* and *why it is keyed on the id*; the announcement contract is the missing one.

### 4.7 Decisions with no recorded reason

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/Preferences.tsx:196`, `:203`
  **IN-FLIGHT** — `opacity-64 hover:opacity-100` on two controls, a magic value with no reason, in a
  file where 13 swatches, 48% muted and `[&>*]:shrink-0` all have one.
- `…/Preferences.tsx:152`, `:175` **IN-FLIGHT** — `z-40` on the fixed trigger vs `z-50` on the
  positioner. The ordering is deliberate and a naive reader would tidy them to match.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/simples/spinner.tsx:14` — `role="status"`
  with a defaulted `aria-label`. Correct, but nothing records why `status` over `progressbar`.
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/compile-v2.fixture.css` — a **v2**
  fixture in a repo whose current schema is v3 (`tokens.css:200`), consumed by
  `compile.test.ts:152`. Nothing records why a v2 document must still compile, which is a
  compatibility promise the repo says elsewhere it does not make. Either document the reason or drop
  the fixture. **IN-FLIGHT** (untracked).

### 4.8 Structurally orphaned doc comments — good prose that no tool can reach

Four large `/** */` blocks are followed by a blank line and then an unrelated declaration, so they
attach to nothing. Hovering the symbol they describe shows nothing.

- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/theme/src/index.ts:38-75` **IN-FLIGHT**
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/theme/KanzoThemeProvider.tsx:15-39`
  **IN-FLIGHT**
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/ui/src/composites/Preferences.tsx:29-63`
  **IN-FLIGHT**
- `/Users/angel.ip/dev/kanzo/keasy/kanzo-ui/packages/palette/src/palette-document.ts:164-169`
  **IN-FLIGHT** — and the symbol it describes, `CategoricalSet` at `:191`, has no doc at all

This is the cheapest high-value fix in the audit: the writing is already done.

---

## Section 5 — Density

Comment lines as a share of non-blank lines. This is the table that reframes the brief.

| area | files | lines | comment | ratio |
|---|---:|---:|---:|---:|
| `packages/theme/src` | 4 | 448 | 245 | **55%** |
| `packages/theme/scripts` | 2 | 116 | 56 | 48% |
| `packages/ui/src/styles.css` | 1 | 96 | 43 | 45% |
| `packages/palette/scripts` | 1 | 340 | 150 | 44% |
| **`packages/palette/src`** | **19** | **6,534** | **2,527** | **39%** |
| `packages/ui/src/theme` | 5 | 1,062 | 354 | 33% |
| `packages/ui/src/layouts` | 3 | 500 | 144 | 29% |
| `docs/components` | 10 | 487 | 139 | 29% |
| `docs/lib` | 10 | 505 | 134 | 27% |
| `packages/theme/tokens.css` | 1 | 356 | 86 | 24% |
| `packages/ui/src/charts` | 23 | 3,675 | 829 | 23% |
| `packages/ui/src/composites` | 18 | 3,595 | 713 | 20% |
| `docs/app` | 8 | 323 | 58 | 18% |
| `docs/showcases` | 37 | 10,222 | 1,759 | 17% |
| `packages/theme/themes.css` | 1 | 44 | 5 | 11% |
| `packages/ui/src/table` | 15 | 1,330 | 143 | 11% |
| `packages/ui/src/simples` | 109 | 13,820 | 1,179 | **9%** |
| **`docs/examples`** | **327** | **10,970** | **388** | **4%** |

**Read this against the brief.** `docs/examples` was singled out and is the leanest area in the
repo — 327 files carrying 388 comment lines between them, almost all `{/* */}` notes explaining a
non-obvious API (`example-slider.tsx:44` "Slider's value is always an array — one entry per thumb",
`example-pin-input.tsx:48` "`details.valueAsString` is the joined form"). Those are the docs doing
their job. `docs/showcases` at 17% is mid-pack. **The verbose-JSDoc problem is not in `docs/`.**

`packages/palette/src` alone holds **2,527 comment lines — 28% of every comment in the repo**. Most
of it is `ramp.ts` and `roles.ts`, and most of *that* is measurement against Radix's 25 chromatic
scales, which is exactly what §6 wants a comment to be. It is also where 20 of the 53 false comments
live, because a measurement about generated output rots when the output is regenerated.

### Worst individual files

| file | lines | comment | ratio |
|---|---:|---:|---:|
| `packages/theme/src/index.ts` | 217 | 171 | **79%** |
| `packages/ui/src/theme/theme-script.ts` | 81 | 58 | 72% |
| `packages/palette/src/palette-document.ts` | 399 | 281 | 70% |
| `docs/showcases/workspace/cluster-ring.ts` | 46 | 32 | 70% |
| `docs/components/kanzo-provider.tsx` | 31 | 21 | 68% |
| `packages/palette/src/roles.ts` | 589 | 397 | 67% |
| `packages/palette/src/seeds.ts` | 51 | 34 | 67% |
| `packages/ui/src/alpha-steps.test.ts` | 144 | 90 | 63% |
| `packages/ui/src/charts/theme.ts` | 150 | 93 | 62% |
| `packages/palette/src/compile.ts` | 135 | 79 | 59% |
| `packages/ui/src/composites/identity-notice.tsx` | 75 | 43 | 57% |
| `docs/components/docs-preferences.tsx` | 53 | 29 | 55% |
| `packages/ui/src/charts/mosaic-provider.tsx` | 143 | 78 | 55% |
| `docs/showcases/workspace/graph-looks.ts` | 150 | 78 | 52% |
| `packages/ui/src/analytics.ts` | 170 | 85 | 50% |
| `packages/palette/src/derive-scheme.ts` | 704 | 349 | 50% |

By absolute volume: `roles.ts` (397), `derive-scheme.ts` (349), `palette-document.ts` (281),
`ramp.ts` (272), `derive-palette.ts` (223), `graph-canvas.tsx` (220), `graph-view.tsx` (195),
`Preferences.tsx` (188).

### Style census

| area | files | `/** */` | `/* */` | `//` runs |
|---|---:|---:|---:|---:|
| `packages/palette/src` | 19 | 280 | 2 | 258 |
| `docs/showcases` | 37 | 296 | 47 | 136 |
| `packages/ui/src/charts` | 23 | 203 | 3 | 79 |
| `packages/ui/src/simples` | 109 | 183 | 6 | 150 |
| `packages/ui/src/composites` | 18 | 86 | 18 | 101 |
| `docs/examples` | 327 | 18 | 37 | 82 |

Two facts worth codifying, because they are already near-universal:

- **JSDoc tags are essentially unused.** Repo-wide: **zero** `@param`, **zero** `@returns`.
  `@default` appears 54 times (49 in `simples/`), `@link` 22, `@example` **4** — while dozens of
  files embed a usage snippet in a doc comment *without* the tag (`SidebarIdentity.tsx:38-47`,
  `Preferences.tsx:35-41`, `floating-panel.tsx:12-18`). The house style is prose JSDoc with no tags;
  the one inconsistency is untagged examples.
- **Banners are one style, used both well and badly.** All 80 use the box-drawing form
  `// ── Name ─────`; 69 carry content, **11 do not** (`shell.tsx:19,61,113`,
  `Preferences.tsx:267,313`, `CodeEditor.tsx:176`, `gen-theme.mjs:49`, `roles.ts:283,309`,
  `graph-canvas.tsx:97,730`). Rule widths differ between `src/*.ts` (~100 cols) and
  `scripts/*.mjs` (~76), and `gen-theme.mjs` closes some banners with a trailing `──` and some not.

### `//key` idiom in `package.json` — used consistently, keep it

Eight keys across five files, all verified accurate except `//size-limit` (§1.13) and `//deps`
(§1.14):

- `package.json:16` `//check:generated` — **verified**: the five paths named match the `git diff`
  list on line 17, and theme's `gen` does run palette's first.
- `package.json:18` `//release` — **verified**: `--filter "./packages/*"`.
- `packages/palette/package.json:20` `//gen`, `:25` `//deps` — **verified**: `src/` imports only
  `../palette-data.json` and `../package.json`; `tailwindcss` is read at
  `scripts/gen-data.mjs:34`.
- `packages/theme/package.json:24` `//gen`, `:29` `//deps`, `:30` `//devDeps` — **verified**: three
  steps in that order, no React peer, palette is a devDependency and `boundary.test.ts` exists.
- `docs/package.json:39` `//deps` — see §1.14.
- `packages/ui/package.json:134` `//size-limit` — see §1.13.

The idiom is applied where a script or a dependency choice is non-obvious and omitted where it is
not, which is the right rule. The one gap: `packages/ui/package.json` has **no `//exports`**, and
its `exports` map encodes the optional-peer isolation rule that `CONVENTIONS.md:113` calls
load-bearing. That seam deserves a `//exports` key.

---

## Section 6 — A proposed comment convention for `CONVENTIONS.md`

`CONVENTIONS.md` currently says nothing about comments — a real gap given that comments are 16% of
the repo and 53 of them are false. Insert as a new section after "Testing".

The rule below is written for a minimal system: it says when a comment is **required**, so that
anything not required is by default absent. It also closes the two failure modes this audit found —
measurements outliving their subject, and one paragraph living in nine places.

---

### Comments

A comment is code that cannot be tested, so it decays silently. Write one only when the code cannot
carry the fact.

**Four comments are required.** Everything else is absent by default.

1. **A measurement.** A contrast ratio, a ΔE, a byte count, a timing, a token that failed a check.
   Cite the number and what it was measured against. `simples/button.tsx:44` — *"Was `text-white` at
   3.81 on red-500 … white 3.81, near-black 4.15, AA needs 4.5"* — is the shape.
2. **A decision a naive reader would undo.** State the reason, not the history.
   `CONVENTIONS.md:84` — *"Do not 'fix' it; it would fork us from upstream"* — is the archetype. The
   test: *if someone deleted this line, would the next reader change the code back?*
3. **An ARIA contract**, on every bespoke part where Ark ships no equivalent — see the accessibility
   rule above. Name the roles, the keys, and what is announced.
4. **A constraint invisible in the code.** `simples/button.tsx:38` — *"Tailwind scans comments, so
   the old classes are not quoted here"* — a fact no reader could infer and every reader could break.

**Do not write:**

- What the code says. `// the trigger` above a `Trigger` is noise; the type already carries it.
- A `@param` or `@returns` that restates a type. We use **none** — prose JSDoc only. `@default` and
  `@link` are the two tags in use; tag a usage snippet `@example` so tooling can find it.
- A banner with no content. `// ── Root ──` above `ShellRoot` earns nothing; `// ── Fonts — the DS
  ships no font files ──` earns its line.
- Commented-out code. There is none today; keep it that way.
- A legacy, migration or back-compat path. Nothing is published. A comment explaining
  compatibility is a comment explaining code that should not exist.

**Four rules that keep a required comment true.**

- **Write one copy.** A fact stated in two places goes stale in one of them. Nine copies of
  "colour is not an axis" is how three of them ended up wrong. State it where it is enforced —
  beside the code or the test that would fail — and point at it from everywhere else.
- **Date a measurement of something generated.** A ratio measured off `tokens.css` is a claim about
  a build artefact, and the next `pnpm gen` can falsify it. Write *"measured 2026-07, `#dddddd`"*,
  not *"today's border ships `#dddddd`"*. A count of call sites (*"23 sites write `bg-input/NN`"*)
  is the same claim and rots the same way — prefer a test that counts.
- **Cite a symbol, never a line.** ``simples/radio-group.tsx:98`` moved to 121 without anyone
  noticing. Write ``simples/radio-group.tsx`, `RadioGroupCard``. A line number is acceptable only
  when the comment quotes that line verbatim.
- **Attach the comment to the thing.** A `/** */` followed by a blank line documents nothing and no
  editor will show it. Four of the best blocks in this repo are orphaned this way.

**History.** Keep a "used to be X" only when it names the mistake it prevents, and say which
mistake. *"`menuItems` is the ONLY mechanism. It used to carry a second, hard-coded one"* prevents a
specific regression and stays. *"it used to take no props, so a consumer …"* prevents nothing and
goes. A record of a closed decision belongs in the changeset or `DESIGN.md`, not beside the code —
and in `DESIGN.md` it needs a date, because `DESIGN.md:224` has already had to say *"That was true
when it was written and is no longer true."*

---

## Appendix — verified correct, so nobody re-checks

Recorded so a second pass does not re-spend the effort. All checked against the code.

- `CONVENTIONS.md:84` — `tokens.css:29-41` **does** document both meanings of `-foreground`, with
  the `--*-content` token and four measured ratios.
- `CONVENTIONS.md:91` — the selector
  `in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3` exists verbatim at
  `simples/popover.tsx:138`, with `data-slot="popover-body"` at `:202`.
- `CONVENTIONS.md:81` — "37 sites": `grep -o 'ring-ring'` over non-test source = **37**.
- `CONVENTIONS.md:88` / `DESIGN.md:213` — `@ark-ui/react/dist/components/` **exists** (73 entries,
  resolvable from `packages/ui`).
- `DESIGN.md:108` — Ark ships `splitter` ✓. `DESIGN.md:317` — there is **no** `autocomplete`
  directory ✓. `CONVENTIONS.md:87` — Ark ships no `toolbar` ✓.
- `DESIGN.md:112`, `:200` — `.planning/LAYOUT-ARK-NATIVE-REVIEW.md` and
  `.planning/FORMS-DECISION.md` both exist.
- `DESIGN.md:266` — its citation of `composites/SidebarIdentity.tsx:31-38` is accurate.
- `eslint.config.js:33` — the `_useX` pattern is real (`simples/action-bar.tsx:350`).
- `Preferences.tsx:113-116` — `closeOnInteractOutside: modal && !alertDialog` exists verbatim in
  `@zag-js/dialog@1.41.2/dialog.machine.js:53`.
- `Preferences.tsx:320-325` — the 13-swatch arithmetic checks out end to end.
- `compile.ts:69` — `@custom-variant dark (&:is(.dark, .dark *))` quoted byte-exactly against
  `packages/ui/src/styles.css:28`.
- `theme-script.test.ts:176` — next-themes `0.4.6` is what `docs/package.json:33` pins.
- Palette measurements verified by counting: `FAMILY_GAP` yellow→lime **61.81°**; `#737373` →
  **89.9°**; **17** families; `WHEEL_STEP` 137.5078 and 9× ≡ **157.6°**; 8! = **forty thousand**;
  Radix's **25** chromatic scales and **five** tinted greys; 97+21 = 82+36 = **118** seeds;
  75+0 of 300 steps; 15×41×24 = **14,760** seeds and **86** straddlers; **29,520** ramps; **35** of
  48 chromatic base16 accents; **13** syntax roles; **15** `IDENTITY_TOKENS`; `dark:bg-field` at
  **12 of 17** sites; Nord `#88c0d0` step 9 at c 0.0626 / hue 217.5; Dracula's **seven** distinct
  accents; cyan-600 chroma 0.116; the four status seeds all at `-600`.
- `packages/palette` `//gen` and `//deps` both accurate.

---

## Appendix — method

- Comment extraction by a string-aware state machine (so a `//` inside a template literal is not
  counted), over 612 files.
- Restatement detector: every single-line comment whose every ≥3-letter word appears in the next
  non-blank non-comment line. **1 hit.**
- Commented-out-code detector: comment bodies matching statement / JSX / assignment / call / CSS
  declaration shapes. 35 candidates, all inspected — **all are usage snippets in doc comments or
  prose beginning with a keyword. Zero commented-out code.**
- Path checker: every `*.ts|tsx|mjs|css|json|mdx|md` filename inside a comment, resolved against the
  real tree. 31 candidates, all inspected.
- Symbol checker: every backticked identifier in a comment, against a corpus of all identifiers in
  all source files plus Ark's component list. 9 distinct misses, **all intentional** (naming things
  that deliberately do not exist).
- `TODO`/`FIXME`/`XXX`/`HACK`/`WIP` sweep: **zero hits repo-wide.**
- Archaeology sweep: 30 phrase patterns ("used to be", "no longer", "legacy", "migration", …) →
  109 comment lines across 60 files.
- Counts and measurements were re-derived by counting, not by trusting the comment. Six agents
  covered the six areas; their strongest claims were re-verified independently, and one was
  **rejected** — a reported `APPEARANCE_KEY` re-export break does not exist (the symbol is nowhere
  in the tree).
- Not covered: `.claude/worktrees/` (two full stale copies of the repo, out of scope) and
  `docs/content/**/*.mdx` prose (documentation, not comments) beyond spot-checks.
