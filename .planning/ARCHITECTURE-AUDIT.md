# Kanzo UI — Architecture Audit

Audit of `@kanzo-tech/theme` + `@kanzo-tech/ui` against `CONVENTIONS.md`, the Ark UI / Shark UI reference architecture, and the settled distribution model (published, versioned npm packages). 50 findings survived adversarial verification; duplicates surfaced by multiple dimensions are merged below.

Both packages are at **version 0.0.0** and `git log` reports **no commits on `main`**. Nothing has ever been published. That single fact governs the whole remediation plan: every breaking change proposed here is free today and expensive after the first `changeset publish`.

---

## Verdict

### What is already good

These are not consolation prizes — they are load-bearing decisions that hold up under inspection.

- **The three-layer separation is real in the primitives.** The kebab-case primitives genuinely do Behaviour=Ark / Appearance=tv+tokens / API=props. `packages/ui/src/primitives/button.tsx:113` extends `React.ComponentProps<typeof ark.button>`, `:24` declares a `tv` variant axis, `:153` spreads `...rest`. No appearance decisions leak into the `.tsx` beyond picking recipe variants. This is the pattern the conventions describe, and ~50 files follow it.
- **`data-slot` discipline in primitives is rigorous and load-bearing.** 59 of 62 primitive files tag their parts, and the recipes themselves depend on those tags — `packages/ui/src/primitives/popover.tsx:131` uses `in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3`. That is a real consumer escape hatch, not decoration.
- **The token pipeline is generated and reproducible.** `packages/theme/scripts/gen-theme.mjs` re-run against the checked-in `themes.css` (805 lines) and `theme-data.json` (847 lines) produces **byte-identical** output. Generation is deterministic and the current state is coherent.
- **Attribute-driven theming on `<html>` is the correct mechanism, and the reason is documented.** `packages/ui/src/theme/KanzoThemeProvider.tsx:29-32` explains that Ark overlays portal to `document.body`, so tokens must live on the root — a subtlety most design systems get wrong.
- **Dark mode is dependency-inverted, deliberately.** `KanzoThemeProvider.tsx:27-28,42-50` defines an `AppearanceController` contract and refuses to own `.dark`, delegating to next-themes when the host provides it. `:258` (`if (appearance) return;`) proves the provider genuinely stays out of the way. This is good design, not an omission.
- **Subpath isolation works — for TanStack.** `dist/index.js` contains zero `@tanstack` imports; only `dist/table.js` does. The stated goal at `packages/ui/vite.config.ts:22-24` is met for the table layer.
- **Domain-freedom largely holds.** Across ~90 components there are exactly two leaks (below). For a library extracted from a product, that is a strong result.
- **`Preferences` is composable, not monolithic.** `Preferences.tsx:184-193` renders `children ?? <defaults>` and every section is individually exported (`:556-575`), so hosts can replace any part.
- **Changesets + semver intent are in place**, with 7 changesets already written describing behaviour changes.

### The 5 things that actually matter

1. **The published artifact is broken for two whole consumer classes.** Every `"use client"` directive is stripped by the build (60 source files → 0 in `dist`), and the root barrel statically imports `@codemirror/*` — which is declared *optional*. `npm i @kanzo-tech/ui && import { Button }` fails today without CodeMirror installed. → §1
2. **The release pipeline publishes ungated, and CI has never been green.** `release.yml` runs `pnpm build && changeset publish` with no `needs:` on CI; 3 of CI's 5 steps fail on a clean checkout. → §2
3. **There are two theme providers, the documented one is the broken one, and both READMEs describe a mechanism that does not exist.** Every documented on-ramp to theming is wrong. → §3
4. **`CONVENTIONS.md` is wrong about its own most load-bearing claims** — the `intent` vocabulary does not exist anywhere in the code, the `forwardRef` recipe is obsolete under React 19 and followed by 3 of 87 files, and the "reference implementation" path does not exist at that casing. → §7
5. **There is effectively no test suite** (3 test files, one of them a failing debug repro) and **no public API-surface guard**, on a package about to make semver promises to three downstream products. → §2

---

## Findings, prioritized

| # | Finding | Sev | Effort | Breaking? | §
|---|---------|-----|--------|-----------|---|
| 1 | `"use client"` stripped from every published bundle | critical | medium | no | §1 |
| 2 | Root barrel hard-imports optional `@codemirror/*` peers | high | small | **yes** | §1 |
| 3 | `@internationalized/date` bundled instead of externalized | high | trivial | no | §1 |
| 4 | Release workflow publishes without test/typecheck/lint | high | small | no | §2 |
| 5 | CI red on clean checkout (3 of 5 steps fail) | high | small | no | §2 |
| 6 | ~90 components, 1 real assertion — no test suite | high | large | no | §2 |
| 7 | Two competing theme providers; documented one can't theme portals | medium | small | **yes** | §3 |
| 8 | Both READMEs document a class API + `appearance` prop that don't exist | medium | small | no | §3 |
| 9 | `theme-data.json` inlined into the ui bundle (39 kB, version-skews) | medium | small | no | §1 |
| 10 | `CONVENTIONS.md` prescribes `intent`; all 12 recipes use `variant` | medium | medium | no (doc) | §7 |
| 11 | No system / `prefers-color-scheme` support; Preferences clobbers next-themes `"system"` | medium | small | no | §4 |
| 12 | `density` axis is a silent no-op on `<KanzoTheme>` (`rem` needs root) | medium | small | **yes** | §3 |
| 13 | Hydration mismatches: `Math.random()` in render, `localStorage`/DOM in `useState` init | medium | medium | no | §4 |
| 14 | `-foreground` status tokens invert the contract `tokens.css` itself states | medium | medium | **yes** | §5 |
| 15 | No CI check that `themes.css`/`theme-data.json` match the generator | medium | small | no | §2 |
| 16 | `size-limit` fails (177 kB vs 25 kB); 232 kB stylesheet unbudgeted | medium | small | no | §2 |
| 17 | No public API-surface snapshot (49 `export *`, 3 asserted symbols) | medium | small | no | §2 |
| 18 | `SidebarUser` hard-codes a logout flow + untranslatable English copy | medium | small | **yes** | §5 |
| 19 | `TwoPaneLayout` renders a second `<main>` landmark | medium | trivial | no | §5 |
| 20 | `__repro.test.tsx` committed; jsdom env never configured | medium | trivial | no | §2 |
| 21 | `preserveModules: false` — no per-file boundaries, no server-safe entry | medium | medium | no | §1 |
| 22 | `CONVENTIONS.md` silent on the client/server boundary | medium | small | no (doc) | §7 |
| 23 | Axis→attribute→default table duplicated 3× across the package boundary | low | medium | no | §3 |
| 24 | `composites/slot.tsx` is unreachable dead code | low | trivial | no | §5 |
| 25 | RDF vocabulary in `--kanzo-syntax-prefixed-name` / `-iri` | low | small | **yes** | §5 |
| 26 | Stale "Radix" references in shipped JSDoc | low | trivial | no | §5 |
| 27 | `forwardRef` recipe obsolete; 3 of 87 files follow it | low | small | no (doc) | §7 |
| 28 | `variant` overloaded across 4 unrelated meanings; size scales diverge | low | medium | **yes** | §6 |
| 29 | `data-slot` absent from all 6 shells and 12 of 15 composites | low | medium | no | §6 |
| 30 | ~9 primitives declare closed prop interfaces (no DOM passthrough) | low | large | no | §6 |
| 31 | `lib/tv.ts` shim bypassed by 21 of 24 recipe files | low | small | no | §7 |
| 32 | `--kanzo-control-*` documented but never defined; `--kanzo-focus-ring` dead | low | trivial | no | §7 |
| 33 | Font axis never sets `--font-heading` → mixed typefaces | low | trivial | no | §4 |
| 34 | `exports` maps omit `"./package.json"` | low | trivial | no | §1 |
| 35 | `scripts/` published in `files` but unreachable via `exports` | low | trivial | no | §1 |
| 36 | No LICENSE file, no `repository`, no `publishConfig` | low | trivial | no | §1 |
| 37 | `Preferences` ships a global bare-`t` hotkey with no opt-out | low | small | **yes** | §5 |
| 38 | `PopoverContent.showCloseButton` JSDoc says `true`, code says `false` | low | trivial | no | §6 |
| 39 | No `publint` / `attw` / install smoke test | low | medium | no | §2 |
| 40 | File naming splits 63/25 kebab vs Pascal; no rule anywhere | low | large | no | §6 |

---

## §1 — The published artifact

### 1. `"use client"` is stripped from every bundle (critical)

60 files under `packages/ui/src/` begin with `"use client";` — `primitives/dialog.tsx:1`, `theme/KanzoThemeProvider.tsx:1`, `shells/EditorShell.tsx:1`, `table/DataTable.tsx:1`, and 56 more. After `pnpm build`:

```
dist/index.js:0   dist/editor.js:0   dist/table.js:0
dist/chunks/EditorShell-sOcDpNpc.js:0   dist/chunks/table-zos-QSye.js:0
```

`head -c 120 dist/index.js` → `var ha = (e) => { throw TypeError(e); };` — no directive prologue. The only surviving occurrences in `dist/` are inside `.js.map` `sourcesContent`.

Cause: `packages/ui/vite.config.ts:46` sets `preserveModules: false`; the config registers only `react()` and `dts()` (`:8-16`) with no `rollup-plugin-preserve-directives` and no `output.banner`. The build emits **no warning**, so the failure is invisible in CI.

This is drift from the declared reference architecture, not taste: `@ark-ui/react@5.37.2` preserves the directive across 1567 dist files (e.g. `dist/components/popover/popover-root.js:1`).

Consequence: a Server Component importing the barrel hits `useState only works in a Client Component` at first render. `packages/ui/src/theme/theme-script.ts:8-10` actively documents a Next.js/RSC `useServerInsertedHTML` recipe for a package that cannot be imported from a server component. Note the scope honestly — a consumer whose own module declares `"use client"` is fine; the defect is that the library forces every consumer to author its own boundary, contrary to what `theme-script.ts` advertises.

**Fix.** Preferred: `preserveModules: true` + `preserveModulesRoot: 'src'` + `rollup-plugin-preserve-directives`, which also restores per-file boundaries (finding 21). Minimum viable: `output.banner: '"use client";'` on the `index` and `table` entries — note the three entry barrels (`index.tsx`, `table.ts`, `editor.ts`) do not themselves carry the directive, which is why a bundle-level banner is required rather than sufficient. Then add a build assertion (`grep -q 'use client' dist/index.js || exit 1`) so it cannot silently regress.

### 2. The root barrel hard-imports optional CodeMirror peers (high)

`packages/ui/package.json:55-75` marks all six `@codemirror/*` plus `@lezer/highlight` `peerDependenciesMeta.optional`. But `src/index.tsx:107-108` exports `GhostEditor` (which statically imports `@codemirror/state|view|commands` at `primitives/GhostEditor.tsx:5-7`) and `:170-171` exports `EditorShell` (`shells/EditorShell.tsx:4-25` imports all seven). `dist/index.js` statically imports `@codemirror/commands|state|view` plus `./chunks/EditorShell-sOcDpNpc.js` (12,961 bytes), which imports the remaining four. Zero dynamic `import()` anywhere.

Reproduced empirically: with stubs for every *required* dep and none of the optional ones, importing the root entry fails with `ERR_MODULE_NOT_FOUND: Cannot find package '@codemirror/state' imported from dist/index.js`. Types leak identically (`dist/index.d.ts:115` → `EditorShell.d.ts:1-3`).

The `/editor` subpath is currently pointless: `dist/editor.js` only re-exports the same chunk `index.js` already pulls. `CONVENTIONS.md:50` designates `/editor` as the CodeMirror subpath — the subpath was added but the barrel exports were never removed. The problem is masked in-repo because `playground/package.json:9-12` installs CodeMirror as a hard dependency.

**Fix.** Delete `GhostEditor` (`index.tsx:107-108`) and `EditorShell` (`:170-171`) from the root barrel; `@kanzo-tech/ui/editor` becomes their only entry — exactly the `./table` pattern. Add a CI smoke test that packs the tarball, installs only non-optional peers, and imports the root entry. **Breaking** — do it now.

### 3. `@internationalized/date` is bundled, not externalized (high)

`packages/ui/vite.config.ts:32-44` omits it from the external predicate though it is a runtime `dependencies` entry (`package.json:79`). It is **fully inlined**: `grep -c internationalized dist/index.js` → 0, while `dist/index.js.map` lists 7 inlined modules (`GregorianCalendar.mjs`, `CalendarDate.mjs`, `manipulation.mjs`, …) totalling 78,995 of 437,266 source bytes (18.1%).

Worse than a dedup issue: `primitives/DateField.tsx:3` imports `parseDate` and `toDateValues()` (`:40-47`) mints `DateValue` objects that flow into `calendar.tsx:3` → `@ark-ui/react/date-picker`, which **is** externalized. Values from the inlined copy cross into Ark, which resolves the consumer's own copy — a dual-copy object-identity boundary inside one render path.

**Fix.** Add `/^@internationalized\//.test(id)` to the external predicate. One line; already a declared dependency, so consumer resolution is guaranteed.

### 9. `theme-data.json` is inlined into the ui bundle (medium)

`vite.config.ts:36` externalizes with an exact-string test `id === "@kanzo-tech/theme"`, which the subpath import at `composites/Preferences.tsx:8` (`@kanzo-tech/theme/theme-data.json`) cannot match. Verified: `dist/index.js:236` begins `const Bo = /* @__PURE__ */ JSON.parse('{"slate":{"light":{"--background":"var(--color-slate-50)"…`, and lines 236-243 are 38,870 bytes. The predicate's own comment (`:30-31`) states the intent to "never bundle … the theme package" — the code violates its own documented invariant.

`.changeset/config.json` has `"fixed": []` and `"linked": []`, so the two packages version independently: a consumer on `ui@1.2.0` + `theme@1.3.0` renders from 1.3.0's `themes.css` while `Preferences`' "Copy theme CSS" emits the frozen 1.2.0 snapshot.

Scope honestly: the payload is `/* @__PURE__ */`-annotated and gzips to 3,396 of 58,034 bytes, so tree-shaking bundlers drop it; the only broken output is one dev-facing clipboard action.

**Fix.** `id === "@kanzo-tech/theme" || id.startsWith("@kanzo-tech/theme/")`.

### 21. `preserveModules: false` leaves no server-safe entry (medium)

All 114 modules collapse into a single 304,385-byte `dist/index.js` whose prologue unconditionally imports `react`, `react/jsx-runtime`, `@ark-ui/react/dialog`, `@ark-ui/react/portal`. The barrel re-exports genuinely server-safe values from that same module: `themeScript` (`index.tsx:32` — pure string generation at `theme-script.ts:27`, zero React imports), `cn` (`:38`), `tv` (`:39`).

Once directives are restored (finding 1), the only place `"use client"` can go is the top of that single module — so `import { themeScript } from "@kanzo-tech/ui"` in a Next root layout either breaks or drags the whole library across the boundary. It also blocks ever shipping server-renderable primitives; `Heading`, `Text`, `card`, `StatCard`, `PageShell`, `Toolbar`, `SectionHeader`, `TwoPaneLayout`, `AppShell`, `TopBar`, `SidePanel` are all hook-free today.

Note: `sideEffects: ["**/*.css"]` + pure ESM means statement-level tree-shaking *does* work, so `CONVENTIONS.md:50`'s "tree-shakeable" claim is not false. The defect is boundary granularity, not shaking.

**Fix.** (a) `preserveModules: true` + a wildcard `"./*"` subpath export, or (b) at minimum add `./theme-script` and `./cn` as server-safe entries in `build.lib.entry` and `exports`.

### 34-36. Packaging metadata

- **`"./package.json"` missing from both `exports` maps** (`packages/ui/package.json:16-30`, `packages/theme/package.json:11-19`). `require.resolve('@kanzo-tech/ui/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. One line each. (Scope note: most tooling reads the manifest off the filesystem, so this is future-proofing, not a live break.)
- **`scripts/` is in `packages/theme/package.json:8` `files` but absent from `exports`.** `npm pack --dry-run` confirms `scripts/gen-theme.mjs` (12.7 kB) ships. It writes to `join(__dirname, "..", "themes.css")` (`gen-theme.mjs:19`) — i.e. into `node_modules` if a consumer ran it. Unreachable dead weight; drop `"scripts"` from `files`.
- **No LICENSE file** despite `"license": "MIT"` in both manifests, and no `repository` / `homepage` / `bugs` in any manifest including the root. npm renders no license text and no source link. Note: a root LICENSE is **not** copied into `packages/*` tarballs under pnpm — a per-package file or copy step is required. `repository` is also what enables npm provenance display, which `release.yml:23` (`id-token: write`) is already set up for.
- Normalize `sideEffects` — theme declares `["*.css"]`, ui declares `["**/*.css"]`. Currently harmless by accident (theme's CSS sits at package root); becomes a silent bug if a CSS file ever moves into a subdirectory.

---

## §2 — Pipeline, tests, release safety

### 4. Release publishes without running tests (high)

`.github/workflows/release.yml:8-10` triggers on every push to `main`; the only substantive step is `changesets/action@v1` with `publish: pnpm release` (`:37-41`). Root `package.json:15` → `"release": "pnpm build && changeset publish"`. There is no `needs:`, no `pnpm test`, no `pnpm typecheck`, no `pnpm lint` anywhere in the file. `ci.yml` and `release.yml` are independent workflows on the same trigger — they race, and CI's result cannot gate the publish.

This is not theoretical: `pnpm typecheck` fails on `main` right now. Mitigating: `changesets/action` publishes only when a version PR it authored is merged, which is a second human gate.

**Fix.** Inline `pnpm typecheck && pnpm lint && pnpm test` before `changesets/action`, or extract CI as a `workflow_call`. Also scope the release build — `pnpm build` currently also builds the disposable playground (`pnpm-workspace.yaml` lists it), adding an unrelated failure mode to the publish path. Use `pnpm -r --filter "./packages/*" build`.

### 5. CI is red on a clean checkout (high)

`.github/workflows/ci.yml:22-26` runs typecheck · lint · test · build · size. Reproduced locally:

- `pnpm typecheck` → `playground/vite.config.ts(1,25): error TS2307: Cannot find module 'node:path'` (playground is in the workspace, has a `typecheck` script, and has no `@types/node`).
- `pnpm test` → `src/__repro.test.tsx` 2 failed: `TypeError: Cannot read properties of undefined (reading 'Symbol(Node prepared with document state workarounds)')` at `userEvent.setup()`.
- `pnpm size` → `Package size limit has exceeded by 152.1 kB / Size limit: 25 kB / Size: 177.1 kB`.

`lint` and `build` pass. `git log` → `fatal: your current branch 'main' does not have any commits yet` — the workflow has literally never run, and it is staged to be red from the first push while `release.yml` publishes off that same push ungated.

### 20. No test environment is configured at all (medium)

Neither `packages/ui/vite.config.ts` nor `packages/theme/vite.config.ts` declares a `test` block, and no `vitest.config.*` exists anywhere. Vitest reports `environment 0ms` — it runs in the **node** environment with no `document`, while `jsdom ^29.1.1` sits in `packages/ui/package.json:100` as an unused devDependency. **No DOM-rendering test can currently exist in this repo.**

`packages/ui/src/__repro.test.tsx` is a committed debug bisect (`"opens without StrictMode"` / `"opens with StrictMode"`, `:30,:41`) and is the only failing test. Its own question — does Popover open under StrictMode? — has never been answered, because execution dies at `userEvent.setup()` before the click. It does not ship (`files: ["dist", "README.md"]`), so consumer impact is zero; the cost is a permanently-red gate that also conceals whether `build` and `size` would pass.

**Fix.** Add `test: { environment: "jsdom", setupFiles: [...] }` to `packages/ui/vite.config.ts`; then either promote the repro into `primitives/popover.test.tsx` as a real spec (StrictMode double-invoke is a genuine Ark hazard) or delete it.

### 6. There is effectively no test suite (high)

Three test files total. `packages/ui/src/index.test.ts` (10 lines) asserts `UI.Button`, `UI.KanzoTheme`, `UI.Preferences` are `typeof function`. `packages/theme/src/index.test.ts` (9 lines) asserts `typeof KanzoTheme === "function"` and a `displayName` — it would pass if the body were `return null`. Against 63 primitives, 15 composites, 7 shells, ~111 exported identifiers.

Zero assertions about rendering, keyboard, ARIA, controlled/uncontrolled state, `asChild`, `ref` forwarding, or SSR. `CONVENTIONS.md:45` says "Accessibility comes from Ark — don't reinvent" — but nothing verifies that our wrappers forward Ark's props and refs. The changesets show churn on exactly those seams: `.changeset/primitive-semantics.md` changes `Card` to `<article>` and `CardTitle` to `<h3>`; `.changeset/composites-and-shells.md` adds landmark roles across TopBar/PageShell/SidebarNav/WorkspaceLayout. All untested.

**Fix (sequenced — jsdom first, everything else is blocked on it).** A minimum bar per component: renders without crashing; `className` merges rather than replaces; `ref` reaches the DOM node; `asChild` swaps the element. Then `vitest-axe` as an a11y smoke pass over every export, one keyboard test per interactive primitive (Dialog focus trap + Esc, Menu arrows, Combobox type-ahead), and a `renderToString` SSR suite — critical given the package ships an SSR story it cannot currently prove.

### 17. No public API-surface snapshot (medium)

`packages/ui/src/index.tsx` is 175 lines containing **49** bare `export *` statements (`:53-100,150`) plus Ark re-exports (`:44-47,50`). The only guard is the 3-symbol check above. No `.api.md`, no api-extractor, no `publint`/`attw` in CI. Deleting or renaming any export in any of ~90 files silently changes the public API, and the semver decision in the changeset is made from memory — against `CONVENTIONS.md:51`'s explicit "Semver via changesets" commitment.

**Fix.** `expect(Object.keys(UI).sort()).toMatchSnapshot()` — cheap, catches every accidental removal, forces a deliberate diff review in PRs. Add `publint` + `@arethetypeswrong/cli` as CI steps.

### 16. `size-limit` measures the wrong thing (medium)

`packages/ui/package.json:107-124` ignores react, react-dom, lucide-react and the CodeMirror/Lezer scope — but not `@ark-ui/react`, `@internationalized/date`, `tailwind-variants`, `tailwind-merge`, `clsx`, `@kanzo-tech/theme`, all external per `vite.config.ts:30-42` and therefore resolved and counted. Adding those six to `ignore` drops 177.1 kB → **42.49 kB**, still over the 25 kB limit. So the budget is unmeetable under either policy and must be re-baselined from measurement.

Note the existing list is defensible on its own terms — every ignored package is a `peerDependency` the host already has; every omitted one is a hard `dependencies` entry npm installs for the consumer. "Ignore peers, count deps" is a coherent policy; the limit is simply wrong.

Meanwhile `npm pack --dry-run` shows `dist/styles.css` at **231,926 bytes** — larger than the JS — with no `size-limit` entry at all. `dist/editor.js` is 195 bytes and `dist/table.js` is 4.7 kB, so per-entry budgets there are near-worthless.

**Fix.** Re-baseline the `dist/index.js` limit from measurement plus headroom, and add a budget for `dist/styles.css`. Consider an import-shaped entry (`{ "path": "dist/index.js", "import": "{ Button, Dialog }" }`) — the only form that actually proves tree-shaking.

### 15. No generator-drift gate (medium)

`ci.yml` has no regenerate-and-diff step. `themes.css` (805 lines) and `theme-data.json` (847 lines) are both shipped via `files` and carry a `/* GENERATED … Do not edit by hand. */` header (`gen-theme.mjs:143` — written into `themes.css` only; `theme-data.json` gets no marker at `:220`).

More dangerous: `tokens.css` is **hand-written** and duplicates the generator's math. `tokens.css:194-253` (the `.dark` block) restates `baseDark("neutral")` from `gen-theme.mjs:57-79`, and a comment at `tokens.css:204-206` records that the two **had already drifted once**. They match today. If they drift again, the shipped default theme silently stops equalling `data-base="neutral"` and the "Copy CSS" export.

**Fix.** Two parts, because they close different holes. (a) CI: `pnpm --filter @kanzo-tech/theme gen && git diff --exit-code packages/theme` — note this is inert until `themes.css`/`theme-data.json` are actually committed (they are untracked today), and there is no root `gen` script. (b) A regenerate-diff **cannot** catch the `tokens.css` drift, since nothing regenerates `tokens.css`. Either emit the `:root`/`.dark` default block from `baseLight('neutral')`/`baseDark('neutral')` into a generated partial that `tokens.css` imports, or add a unit test comparing `tokens.css`'s `.dark` block to `theme-data.json`'s `bases.neutral.dark`.

---

## §3 — The theming layer (two providers, wrong docs)

This is where four separately-surfaced findings converge on one root cause.

### 7. Two competing providers; the documented one cannot theme portals (medium)

- `packages/theme/src/index.tsx:63-90` exports `KanzoTheme` — a stateless component writing `data-base`/`data-accent`/`data-radius`/`data-font`/`data-mono-font`/`data-font-size` onto a wrapper `<div>` (`:75`), plus a `data-kanzo-theme` attribute (`:77`) that **no CSS rule in the repo matches**.
- `packages/ui/src/theme/KanzoThemeProvider.tsx:157-213` exports a second, stateful provider writing the same six attributes to `document.documentElement`, and its docstring (`:29-32`) states exactly why: *"Ark overlays (Dialog, Popover, Menu, Select, Tooltip…) portal to `document.body`, OUTSIDE any wrapper, so the tokens must live on `<html>`."*

That is a direct statement that `KanzoTheme`'s mechanism cannot theme Dialog, Popover, Menu, Select, Tooltip, Toast, ContextMenu, HoverCard or Command. Yet `KanzoTheme` is the *documented* entry point (`CONVENTIONS.md:43,49`; `README.md:26,49-59`; `packages/theme/README.md:11-21`), while a repo-wide grep for `<KanzoTheme` returns **zero** JSX usages. The only real consumer is `playground/src/gallery-main.tsx:15,22` → `KanzoThemeProvider`.

`packages/ui/src/index.tsx:11` re-exports the dead one next to the live one (`:23`) with no disambiguating signal, and both `index.test.ts` files pin it.

Scope honestly: `themes.css` uses bare attribute selectors (`[data-base="slate"]`, `.dark [data-accent="red"]`), not `:root`-anchored ones, so the `<div>` *does* correctly theme its in-tree subtree — it fails only for portaled surfaces, and with all-default props emits no attributes at all.

**Fix.** Keep exactly one provider. Delete `KanzoTheme` from `packages/theme/src/index.tsx`, its re-export at `packages/ui/src/index.tsx:11`, and both test pins — which also lets `packages/theme/package.json:26-29` drop its React peer deps and become CSS + types only. If it is kept instead, document it explicitly as a scoped-subtree preview wrapper that does not cover portals or density, and give it a rendering test asserting the emitted attributes. **Breaking** — do it now.

### 12. The `density` axis is a silent no-op on `<KanzoTheme>` (medium)

`gen-theme.mjs:171` emits `[data-font-size="…"] { font-size: … }` → `themes.css:800` `[data-font-size="compact"] { font-size: 14px; }`. `packages/theme/src/index.tsx:84` sets that attribute on a plain `<div>`. But every size in the system is `rem` (`--kanzo-font-size-base: 0.8125rem`, `--radius: 0.5rem`, Tailwind `h-9`/`text-sm`), and `rem` resolves against the **root** only. The generator's own header (`gen-theme.mjs:9`) says so: "`data-font-size` sets the density (root font-size)". `KanzoThemeProvider.tsx:201` writes it to `documentElement` correctly.

So `<KanzoTheme density="compact">` puts the attribute in the DOM, matches a real CSS rule, and changes nothing. It is the only one of the six axes that is broken on the div — the other five set inheriting custom properties.

**Fix.** Falls out of deleting `KanzoTheme`. If kept: drop `density` from its props (it is inherently root-scoped) or write it to `documentElement` via an effect.

### 8. Both READMEs document a mechanism and a prop that do not exist (medium)

`packages/theme/README.md:3,11-13` and `README.md:49-51` both claim `KanzoTheme` "applies the corresponding classes (`bg-<base> theme-<accent> radius-<radius>` + `.dark`)". The implementation applies **attributes** (`index.tsx:74-86`), and `gen-theme.mjs:5-6` states the opposite of the READMEs outright: "theming is driven by `data-*` attributes on `<html>` (NOT classes)". No `bg-slate` / `theme-blue` / `radius-md` selector exists anywhere in `themes.css`.

`packages/theme/README.md:18`'s sole usage example is `<KanzoTheme base="neutral" accent="indigo" radius="md" appearance="light">`. `KanzoThemeProps` (`index.tsx:53-61`) has no `appearance` prop, and since it extends `ComponentPropsWithRef<"div">` **the example is a type error**. `index.tsx:26-27` confirms `Appearance` is vestigial: "Kept for compatibility; dark is owned by next-themes."

`packages/theme/package.json:4` likewise says "class-driven". These are the npm landing pages for a published package, and the flagship snippet does not compile.

**Fix.** Rewrite both READMEs around: `data-*` attributes on `<html>`, `KanzoThemeProvider`, `.dark` owned by the host/next-themes, `themeScript()` for SSR, `cookieStorageAdapter`. Fix `package.json:4`'s description. Delete the `Appearance` type. Also fix `CONVENTIONS.md:43,49` — it says `@kanzo-tech/theme` ships "tokens + `KanzoTheme` provider" and never mentions `KanzoThemeProvider`, `useKanzoTheme`, `themeScript` or `Preferences` at all.

### 23. The axis table is duplicated three times across the package boundary (low)

1. `packages/theme/src/index.tsx:63-84` — six axes hardcoded as JSX literals with defaults inline.
2. `packages/ui/src/theme/prefs-config.ts:43-50` — the same six as data (`AXES = [{ key, attr, def }, …]`), consumed at `KanzoThemeProvider.tsx:202-212` and serialized into the SSR script at `theme-script.ts:29,38`.
3. `packages/theme/scripts/gen-theme.mjs:151-171` — decides which selectors actually exist.

Nothing cross-checks them. `AXES` types `attr`/`def` as free-form `string`, so a missed edit produces no type error: miss the generator and the provider writes an attribute no CSS matches; miss `prefs-config.ts` and the SSR script stops applying it, reintroducing the exact FOUC `theme-script.ts` exists to prevent.

Scope honestly: the three agree today, the *value* types (`KanzoBase`/`KanzoRadius`/`KanzoDensity`) already live in `@kanzo-tech/theme` and are imported by `prefs-config.ts:4-11`, so value renames do type-error. Only the attribute strings, default strings and axis set are unchecked, and the axis set is closed.

**Fix.** Publish one axis table from `@kanzo-tech/theme` (move `AXES`, `DEFAULT_PREFS`, `STORAGE_KEY`, `APPEARANCE_KEY` and the `ThemePrefs` types there) and import it in the provider and SSR script. Note the generator leg needs more than `AXES` — it also needs the value lists (`RADII`/`FONTS`/`MONO_FONTS`/`DENSITIES`/`ACCENTS`, `gen-theme.mjs:113-137`).

---

## §4 — SSR, hydration, and dark mode

### 13. Three hydration-mismatch sources (medium)

1. **`Math.random()` in render.** `primitives/sidebar.tsx:718-721` — `React.useMemo(() => \`${Math.floor(Math.random() * 40) + 50}%\`, [])`, written into markup as a `--skeleton-width` inline style. Server and client emit different `style` attributes.
2. **`localStorage` in a `useState` initializer.** `shells/WorkspaceLayout.tsx:122-124` — `useState(() => loadPanel(storageKey, defaultPanel))`; `loadPanel:67-69` returns `defaultPanel` on the server and the persisted panel on the client's hydration render, and `activePanel` selects which panel body renders.
3. **DOM read in a `useState` initializer.** `theme/KanzoThemeProvider.tsx:253-255` — `useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"))`. `theme-script.ts:45` sets `.dark` pre-hydration, so the server renders `appearance: "light"` and the client reads `"dark"`. It reaches markup via `Preferences.tsx:274,280` (`value={appearance}`). Same pattern at `:176-181`, which calls `storageAdapter?.get()` during render (`localStorageAdapter:59-60` returns `null` on the server).

React 19 discards the server HTML for the mismatched subtree and re-renders client-side — a perf regression and a visible flash, in the exact paths the `themeScript` no-flash machinery exists to prevent.

Scope honestly: the `<html>`-level token application is outside the hydrated tree and still works, so base/accent/radius/density do not flash. Damage is confined to those three subtrees.

Related dead path: `setAppearance` (`KanzoThemeProvider.tsx:283-284`) writes **only** `localStorage.setItem(APPEARANCE_KEY, next)` — never a cookie — yet `theme-script.ts:44` reads a cookie as the appearance fallback. No server can read appearance, and `theme-script.ts:13` documents pairing with `cookieStorageAdapter` — exactly the config that mismatches.

**Fix.** (1) Deterministic widths keyed off index, or a CSS-only shimmer. (2)+(3) Initialize from the server-deterministic default and reconcile in a mount `useEffect` (or `useSyncExternalStore` with a `getServerSnapshot`). Better for (3): let the host pass server-read cookie values via the existing controlled `value`/`onChange` path (`:144,:178`, already documented at `:24`). Make `setAppearance` write the cookie whenever prefs storage is cookie-backed.

### 11. No `prefers-color-scheme` support anywhere (medium)

`grep -rn "prefers-color-scheme|matchMedia"` across `packages/theme` and `packages/ui/src` returns exactly one hit — `primitives/use-is-mobile.tsx:11`, a viewport query. Zero in any theme file.

`theme-script.ts:44-45` honours only a stored value (`if(ap==='dark')…else if(ap==='light')…`) with no else-branch, so a first-time visitor on a dark-mode OS gets light. `KanzoThemeProvider.tsx:253-255` seeds from the DOM class, never from `matchMedia`, and never subscribes to OS changes. `packages/theme/src/index.tsx:27` types `Appearance = "light" | "dark"` with no `"system"`.

Worse: when a host *does* delegate to next-themes, `KanzoThemeProvider.tsx:278` calls `appearance.setTheme(next)` with only `"light"`/`"dark"`, and `Preferences.tsx:282-285` offers only two options — so the moment a user touches the appearance toggle, next-themes' `"system"` setting is overwritten. The DS structurally cannot read it back: `AppearanceController` exposes `resolvedTheme` (already resolved to light/dark) and never `theme`.

Scope honestly: a next-themes host with `defaultTheme="system"` gets correct *first-load* behaviour, since `KanzoThemeProvider.tsx:258` (`if (appearance) return;`) keeps the provider out of the way and next-themes runs its own script. And `PreferencesPanel` is replaceable, so the clobbering default is escapable. The irreducible gap is that the public `Appearance` vocabulary cannot express `"system"` at all, and the built-in fallback has zero OS awareness.

**Fix.** Add `"system"` to `Appearance` and `theme` to `AppearanceController`. In the fallback, resolve via `matchMedia("(prefers-color-scheme: dark)")` when no stored value exists and subscribe to `change` while the pref is `system`. In `themeScript`, add `if(!ap){ap=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`. Add a third `System` segment to `AppearanceSection`.

### 33. The font axis never sets `--font-heading` (low)

`tokens.css:74-78` declares three font tokens; `gen-theme.mjs:167-168` emits only `--font-sans` and `--font-mono`. No `--font-heading` rule exists in the generated fonts block (`themes.css:779-797`), and `ThemePrefs` has no heading-font axis. Four shipped components use the utility: `Preferences.tsx:164`, `card.tsx:113`, `alert.tsx:82`, `dialog.tsx:295`.

Tailwind v4 inlines the fallback (`.font-heading{font-family:var(--font-heading,ui-sans-serif, system-ui, sans-serif)}`), so headings resolve to the literal system stack. In the team's own playground, selecting Geist yields Geist body text with `ui-sans-serif` dialog/card/alert titles.

**Fix.** Have `[data-font="…"]` also set `--font-heading` to the same stack (with an optional separate `data-heading-font` axis if headings should diverge), or drop `--font-heading` and use `font-sans` for headings.

---

## §5 — Layering and domain-freedom

### 18. `SidebarUser` hard-codes an auth flow (medium)

`CONVENTIONS.md:11` names auth explicitly: "The library is domain-free: nothing about RDF / SHACL / fossil / graphs / **auth**." `composites/SidebarUser.tsx` builds one in: `onLogout`/`logoutLabel`/`confirmLogout` props (`:32-35`), a destructive `LogOutIcon` item (`:110-119`), and an AlertDialog with untranslatable body copy — `<AlertDialogTitle>Log out?</AlertDialogTitle>` and `<AlertDialogDescription>Are you sure you want to log out?</AlertDialogDescription>` (`:127-128`), plus `"Cancel"` (`:131`) and `logoutLabel = "Log out"` (`:58`). No override prop exists for any of it. Consumed at `playground/src/scenes/AppScene.tsx:168`.

The file's docstring (`:50-53`) claims it is domain-free because "the caller supplies `menuItems` and `onLogout`" — but `menuItems` is already the general mechanism; logout is a second, domain-specific one.

Caveat that changes the fix: `SidebarUserMenuItem` (`:20-26`) exposes only `label`/`icon`/`href`/`onSelect` and has **no `variant`** field, while `MenuItem` does support `variant="destructive"` (`primitives/menu.tsx:147-160`). So the logout branch reaches a capability the generic path cannot express today.

**Fix.** Add `variant` to `SidebarUserMenuItem`, then delete the logout props and the AlertDialog. Logout becomes one `menuItems` entry with `variant: "destructive"`; the product owns its confirmation and its copy. If a confirm affordance is wanted in the library, expose it generically: `confirm?: { title, description, confirmLabel, cancelLabel }`. **Breaking.**

Related, broader: hardcoded English is library-wide — `primitives/sidebar.tsx:307,319`, `spinner.tsx:11`, `SuggestMenu.tsx:139,165`, `Preferences.tsx:128,174`, `WorkspaceLayout.tsx:59,169,204`, plus `aria-label="Close"` in dialog/sheet/popover/toast/action-bar. `SidebarUser` is the worst case (visible body copy, not aria-labels), but an i18n strategy is a separate, larger decision worth making before 1.0.

### 25. RDF vocabulary in the token names (low)

`tokens.css:186-187` (and `:248-249` for dark) define `--kanzo-syntax-prefixed-name` and `--kanzo-syntax-iri`. "Prefixed name" and "IRI" are Turtle/SPARQL terms of art. `shells/EditorShell.tsx:59-60` maps purely generic Lezer tags onto them — `t.typeName, t.className, t.namespace, t.tagName, t.labelName, t.macroName` → `--kanzo-syntax-prefixed-name`; `t.url, t.link` → `--kanzo-syntax-iri`. Every other token in the block is neutral (`keyword`, `string`, `number`, `comment`, `identifier`, `operator`, `punctuation`).

The leak is nominal, never behavioural — a TypeScript or Python editor is already coloured correctly. But `tokens.css` is a published subpath export (`packages/theme/package.json:16`), so renaming later is breaking.

**Fix.** Rename to `--kanzo-syntax-type` and `--kanzo-syntax-url` (matching the tags actually mapped). Four call sites: `tokens.css:186-187`, `tokens.css:248-249`, `EditorShell.tsx:59-60`. **Breaking — free today, not later.**

### 19. `TwoPaneLayout` renders a second `<main>` landmark (medium)

`composites/TwoPaneLayout.tsx:26`: `<main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>`. Its two structural siblings deliberately do the opposite and document why:

- `composites/PageShell.tsx:41-42` — "`<section>` (not `<main>`) so PageShell can safely nest inside an AppShell that already owns the page's single `<main>` landmark."
- `shells/WorkspaceLayout.tsx:165-166` — "`<section>` (not `<main>`): this shell is designed to sit inside a `SidebarInset`, which already provides the page's single `<main>` landmark."

Both `shells/AppShell.tsx:23` and `SidebarInset` (`primitives/sidebar.tsx:347`, `ark.main`) render a `<main>`. `TwoPaneLayout` is nested by construction — its root is `h-full w-full` (`:19`) where the top-level `AppShell` is `h-screen`, and its docstring (`:5`) calls it "the settings / section shape". So the documented composition produces nested `<main>`: an HTML conformance error and a duplicated landmark that makes "skip to main content" ambiguous.

**Fix.** `<main>` → `<section>` at `:26`, with the same explanatory comment its siblings carry. Optionally an `as` prop for the rare standalone case. Zero call sites today, so this is free.

### 24. `composites/slot.tsx` is unreachable dead code (low)

Defines `SlotProps` (`:12`) and `Slot` (`:16`). Grep across `packages/ui/src`, `packages/theme/src` and `playground/src` returns no importers — only the definition, `EditorShell.tsx:282,326,356` (`langSlot`, an unrelated CodeMirror `Compartment`) and `TextField.tsx:24` (`data-slot`). `index.tsx` contains zero occurrences of `Slot`, and its only wildcard (`export * from "./primitives/sidebar.js"`) cannot pick it up. `editor.ts`/`table.ts` don't reference it. The sidebar uses Ark's native `asChild` instead (`sidebar.tsx:3,577,785`; consumed at `SidebarNav.tsx:53,83`, `SectionNav.tsx:43`).

Cost is bounded: `grep -c cloneElement dist/index.js` → 0, and `composites/slot` does not appear in `index.js.map` — it is fully tree-shaken, and `exports` does not expose it. The cost is ~48 unread lines plus a docstring claiming it exists "for the handful of sidebar/menu components that need `asChild`", which is false.

**Fix.** Delete the file.

### 26. Stale "Radix" references in shipped JSDoc (low)

`index.tsx:6` states the stack: "Everything runs on Ark UI + tailwind-variants + tokens + tw-animate-css. **No @radix-ui/themes**." But `primitives/SuggestMenu.tsx:11` says "in a portalled **Radix** `Popover`" while importing `./popover.js` (Ark-based, `popover.tsx:3-8`), `shells/EditorShell.tsx:35` and `:261` mention "the **Radix**-tokened theme" / "the Radix theme", and `primitives/GhostEditor.tsx:15` says "Radix tokens only". No `@radix-ui` dependency exists.

These are JSDoc blocks emitted into shipped types (`dist/shells/EditorShell.d.ts:26` carries "the Radix theme"), so consumers see the false claim on IDE hover.

**Fix.** Replace "Radix" → "Ark" / "Kanzo tokens" at `SuggestMenu.tsx:11`, `EditorShell.tsx:35,261`, `GhostEditor.tsx:15`. Note `slot.tsx:5` is *not* a leftover — "Avoids a `@radix-ui/react-slot` dependency" is a correct rationale; it goes away with the file.

### 14. The status `-foreground` tokens invert the contract `tokens.css` itself states (medium)

`tokens.css:16-17` states the rule: *"The base name is the FILL; the same name with `-foreground` is the text/icon colour meant to sit on it."* Then `:144-151` defines `--destructive: var(--color-red-500); --destructive-foreground: var(--color-red-700);` and the same shape for info/success/warning. red-700 on red-500 is ~1.9:1 — unreadable.

The `.dark` block proves the real meaning is "variant of the hue, not on-fill text": `:213-220` makes `--destructive-foreground` red-400. All 23 component usages treat it that way (`menu.tsx:153-155`, `field.tsx:22,189,297`, `radio-group.tsx:22,60,62`, `native-select.tsx:24`, `switch.tsx:25`, `input.tsx:23-24`, `textarea.tsx:26-27`, `checkbox.tsx:37,41-42`, `input-group.tsx:27`, `button.tsx:45`), and `badge.tsx:66-67` uses it in *light* mode with no `dark:` prefix, so the inversion is not dark-mode-only.

Because no on-fill token exists, components leak raw `text-white` — `status.tsx:18-21` (all four variants), `button.tsx:42`, `slider.tsx:116`, `color-picker.tsx:303` — violating `CONVENTIONS.md:42`'s "Only token-backed utilities… no raw palette".

The tokens ship publicly via `@theme inline` (`tokens.css:35-42`), `package.json:16-18`, and `gen-theme.mjs:72-73,178-199` propagates the pair into every generated theme.

Nothing renders red-on-red today, because every internal use matches the real meaning. The defect is a latent API contract that contradicts itself in writing, plus the `text-white` leaks. (Note: current shadcn/ui removed `--destructive-foreground` and hardcodes `text-white` itself, so the "collides with shadcn" argument holds for legacy/third-party code, not today's upstream.)

**Fix.** Rename to what they are — `--destructive-emphasis` (or `-text`) — and introduce a genuine `--destructive-foreground` for on-fill text so `status.tsx` can drop `text-white`. Update the contract paragraph at `tokens.css:16` and `CONVENTIONS.md:42` to describe both families. **Breaking across two packages and every generated theme — free today.**

### 37. `Preferences` ships product policy the library shouldn't own (low)

`composites/Preferences.tsx:93` defaults `hotkey = "t"` and `:96-109` registers a bubble-phase `window` keydown firing on a bare `t`; the only guard is `INPUT`/`TEXTAREA`/`isContentEditable` (`:100-103`). `:132` hard-codes `"fixed bottom-4 right-4 z-40"`. `DENSITY_PX` (`:424`) re-hardcodes `14px/16px/18px`, duplicating `gen-theme.mjs:137` and `theme-data.json.densities` — even though the file already imports `themeData` (`:8`) and reads `d.densities` at `:527`.

The load-bearing part: the all-in-one `<Preferences />` (`:559`, and exactly what `playground/src/App.tsx:69` uses) takes **no props**, so a consumer cannot rebind or disable the global single-key listener or reposition the FAB. The only off switch is the undocumented accident that `hotkey=""` never matches — unreachable from the all-in-one.

Scope honestly: the guard is adequate (Ark Combobox/Editable render real `<input>`s; CodeMirror is contenteditable), the FAB is mostly overridable since `cn` is `twMerge(clsx(...))`, and the "Copy CSS in the end-user panel" contradiction is a stale doc comment (`:57-59`) versus a deliberate later decision (`.changeset/preferences-panel.md:5`).

**Fix.** Default `hotkey` to `undefined` (opt-in) and require a modifier when set; expose the props on the all-in-one. Derive `DENSITY_PX` from `themeData.densities`.

---

## §6 — Component API consistency

### 28. `variant` means four unrelated things (low)

| Component | `variant` options | Actual axis |
|---|---|---|
| `button.tsx:24` | default outline destructive secondary ghost link | visual style |
| `badge.tsx:21` | default secondary outline success info warning destructive | style **+** status colour |
| `alert.tsx:20` | default destructive info warning success | status colour |
| `status.tsx:16` | default success info warning destructive | status colour |
| `Text.tsx:14` | default muted primary destructive | tone |
| `card.tsx:36` | default icon image | layout kind |
| `tabs.tsx:45` | default underline | shape |
| `Link.tsx:14` | default subtle plain | emphasis |
| `menu.tsx:148` | default destructive | status colour |

Size scales diverge too: `button.tsx:67` `xs sm md lg xl` + five `icon-*`; `badge.tsx` `xs sm md lg`; `input`/`avatar`/`toggle`/`native-select`/`status` `sm md lg`; `dialog.tsx` `sm md lg xl 2xl 3xl 4xl 5xl 6xl fullscreen`. There is also a fifth axis in the table (`striped`).

Knowing `<Badge variant="warning">` works teaches nothing about `<Card variant>`, and `<Button variant="warning">` is a type error even though Badge/Alert/Status accept it.

Be honest about how much of this is taste: per-component `variant` enums with different meanings is *precisely* the shadcn/Shark convention the team chose, and Ark is headless so it takes no position. The non-taste kernel is that `CONVENTIONS.md:9,22` prescribes `intent` and no code uses it (see §7).

**Fix (optional, and a judgement call).** If you want the semantic vocabulary the conventions describe: reserve `variant` for visual treatment, add a distinct axis for the shared `success | info | warning | destructive` set applied uniformly (including Button), and rename the outliers — Card's → `layout`, Tabs' → `appearance`, Text's → `tone`. All breaking; batch into one changeset. If you don't, delete the aspiration from `CONVENTIONS.md` instead. Do not leave both checked in.

### 29-30. `data-slot` and closed prop interfaces

**`data-slot` is absent from all 6 shells** (`AppShell`, `EditorShell`, `SidePanel`, `StatusBar`, `TopBar`, `WorkspaceLayout`), **12 of 15 composites**, `table/sortableHeader.tsx`, `GhostEditor.tsx` and `SecretField.tsx` — while 59 of 62 primitive files carry it. The shells and composites are the largest, hardest-to-restyle surfaces. `AppShell.tsx:6-17` makes this concrete: it accepts only `topBar`/`left`/`right`/`children` — no `className`, no `...rest` — so a consumer has no override surface at all.

Scope: `data-slot` is a secondary escape hatch, not the contract. `CONVENTIONS.md:43` establishes token overrides as the intended re-theming path and `:31-33` makes `className` passthrough standard. Purely additive to fix.

**~9 primitives declare closed prop interfaces** with no DOM passthrough — `CardRadioGroup`, `ComingSoon`, `DateField`, `EmptyState`, `FieldArray`, `GhostEditor`, `SecretField`, `SuggestMenu`, `TextField`. E.g. `SecretField.tsx:12-43` enumerates 18 props and extends nothing, so `<SecretField aria-describedby=…>` is a type error while `<Button aria-describedby=…>` works. This is the real consumer-visible gap; additive and non-breaking to close.

Note: this does **not** correlate with filename case, contrary to a tempting reading. `Heading.tsx:10-25`, `Link.tsx` and `Text.tsx` are PascalCase and fully follow the kebab/CONVENTIONS shape (tv recipe, `extends React.ComponentProps`, `...rest`, `data-slot`), and all 15 composites lack `tv()` including the lowercase `link.tsx`/`slot.tsx` — the absence is layer-driven.

### 40. File naming (low, taste)

63 kebab vs 25 Pascal, plus `table/sortableHeader.tsx` as a third convention. `CONVENTIONS.md` never mentions naming. For a published package whose consumers import from the barrel and never see filenames, this is cosmetic — but pick one and write it down so the split stops widening. Note the direction is not obvious: kebab dominates by headcount, but `CONVENTIONS.md:37` names `Button.tsx` (PascalCase) as the reference and its recipe imports `../lib/tv.js`/`../lib/cn.js`, the style the *Pascal* files follow.

Related and inert: `.js` import extensions correlate perfectly with case in primitives (kebab → extensionless, Pascal → `.js`), but `tsconfig.base.json:6` sets `moduleResolution: "Bundler"`, under which both resolve. No consequence; normalize opportunistically.

### 38. `PopoverContent.showCloseButton` doc/code mismatch (low)

`primitives/popover.tsx:51-56` documents `@default true`; `:60` destructures `showCloseButton = false`. Sibling components (`dialog.tsx:164,171`; `sheet.tsx:140,147`; `tour.tsx:157,163`) all document *and* implement `true`, so popover is the sole self-inconsistent case. The JSDoc reaches consumer IDE tooltips via `vite-plugin-dts`.

**Fix.** Change the JSDoc to `@default false` — not the code. `SuggestMenu.tsx:143` and `playground/src/Gallery.tsx:1336` both render `PopoverContent` without the prop and without a close button.

---

## §7 — `CONVENTIONS.md` itself needs updating

The document is the governing artifact and is stale on several of its most load-bearing claims. Each of these is a doc edit, not a code change.

| Line | Says | Reality | Action |
|---|---|---|---|
| **9** | "our own semantic vocabulary (`intent` / `size` …)" | `grep -rn intent packages/ui/src` → **one prose comment** (`FieldArray.tsx:41`). Zero components expose `intent`. All 12 recipes with a style axis use `variant`. `index.tsx:3-5` states the opposite doctrine outright: "Level 1 (primitives) are Shark UI components, vendored as-is (the shadcn-style registry model)." | **Pick one and delete the other.** Recommended: accept reality — rewrite `:9` and `:20-24` around `variant`, matching Shark/shadcn and consumer expectation, and weaken "decoupled from Ark/Tailwind internals" to "stable across upstream refactors". If `intent` is genuinely wanted, it is a deliberate, changeset-gated rename of ~12 components in one commit — not an aspiration. |
| **22-23, 31** | Recipe template uses `variants: { intent: … }`, `defaultVariants: { intent: "primary" }`, destructures `{ intent, size, className }` | Same as above | Rewrite to `variant` |
| **17** | `import { tv } from "../lib/tv.js"` | 21 of 24 `tv()` callers import `tailwind-variants` directly, including `button.tsx:3` — the file `:37` calls the reference implementation. Only `Heading.tsx:2`, `Link.tsx:2`, `Text.tsx:2` obey. `lib/tv.ts` is a bare re-export with no `twMergeConfig`. | Decide: delete `lib/tv.ts` and the re-export at `index.tsx:39` and document `tailwind-variants` directly; **or** keep it as the `twMergeConfig` seam, codemod the 21 imports, and add a lint rule banning `from "tailwind-variants"` outside `lib/`. Note `lib/cn.ts` calls bare `twMerge(clsx(…))` with no config either, so the shim is not the single seam it claims to be. |
| **26-34** | `React.ComponentPropsWithoutRef` + `React.forwardRef` recipe | `ComponentPropsWithoutRef` appears **zero** times in 87 source files (good — it silently drops `ref`). `forwardRef` appears in 4 sites across 3 files (`TextField.tsx:28,55`; `composites/link.tsx:16`; `composites/slot.tsx:16`). React peer is `>=19` (`package.json:48`), where `ref` is a normal prop. `button.tsx:113,130` — the named reference — uses `React.ComponentProps<typeof ark.button>` + a plain arrow component. | Rewrite to the React 19 idiom: props extending `React.ComponentProps<typeof ark.x>` (which already includes `ref`), plain function component, no `forwardRef`, no `ComponentPropsWithoutRef`. Then convert the 3 holdouts — **except** `slot.tsx`, which spreads `...slotProps` onto a child and needs explicit ref-merging, and which is being deleted anyway (§5). `forwardRef` is not deprecated in React 19, so this is cleanup, not a fix. |
| **37** | "Reference implementation: `packages/ui/src/primitives/Button.tsx`" | The file is `button.tsx` (lowercase). Resolves on macOS/APFS, **breaks on case-sensitive CI**. And it contradicts the recipe above it. | Fix casing; fix the recipe so the reference is actually exemplary. |
| **42** | Lists `--kanzo-control-*` among the Kanzo extras | Repo-wide grep for `kanzo-control` returns **only** this line (and `.planning/NEW-COMPONENTS.md:675`, which already logged it as drift). Defined nowhere, used nowhere. `--kanzo-focus-ring` is defined once (`tokens.css:176`) and consumed by **zero** components — all 38 focus rings use `focus-visible:ring-[3px] focus-visible:ring-ring/32`. `tokens.css:167` heads that block "only what Tailwind/Shark don't cover **+ is used**", so the dead token violates its own file's contract. | Delete `--kanzo-control-*` from `:42`. Then either delete `--kanzo-focus-ring` and document `ring-[3px] ring-ring/32` as the convention, or adopt the token in the button/input recipes and drop the ad-hoc utilities. |
| **42** | "Only token-backed utilities… no raw palette" | Violated by `text-white` at `status.tsx:18-21`, `button.tsx:42`, `slider.tsx:116`, `color-picker.tsx:303` — a consequence of the missing on-fill status tokens (§5, finding 14). | Fix the tokens, then the rule becomes enforceable. Consider a lint rule. |
| **42** | Documents the `-foreground` naming implicitly | `tokens.css:16-17` states one contract; the status tokens implement the inverse | Document **both** families once renamed |
| **43, 49** | `KanzoTheme` is the theming mechanism; `@kanzo-tech/theme` ships "tokens + `KanzoTheme` provider" | The real runtime is `KanzoThemeProvider` + `useKanzoTheme` + `themeScript` + `Preferences`, and it lives in **`@kanzo-tech/ui`**. `KanzoTheme` cannot theme portaled surfaces. None of the real names appear in `CONVENTIONS.md`. | Rewrite to describe the actual theming runtime and state which package owns which half (or move the provider into `@kanzo-tech/theme` and make the doc true instead). |
| **47-51** | Distribution section | Never mentions RSC, `"use client"`, the client/server boundary, SSR, or hydration. `/editor` is designated the CodeMirror subpath but the barrel still exports both editors. | Add a **Client boundary** section: *a file gets `"use client"` iff it calls a React hook, registers an event listener, or imports a module that does; hook-free presentational components must NOT have it so they stay server-renderable.* Add a lint rule — and note a source lint rule alone changes nothing until the build stops stripping directives (§1). Document the actual entry-point rule for optional-peer components. |
| — | Nothing about landmarks | `PageShell.tsx:41` and `WorkspaceLayout.tsx:165` encode a real single-`<main>` rule as inline comments; `TwoPaneLayout.tsx:26` breaks it | Write the rule down: exactly one `<main>`, owned by `AppShell`/`SidebarInset`; every nestable container uses `<section>`. |
| — | Nothing about `data-slot` | 59/62 primitives follow an unwritten rule; 6 shells and 12 composites don't | Write it down: every element a consumer might target carries `data-slot="<component>-<part>"`. |
| — | Nothing about file naming | 63/25/1 three-way split | Pick one, state it. |
| — | Nothing about testing | 3 test files, no jsdom env | State the minimum bar per component (§2, finding 6). |

The directive drift is also structurally invisible to the team's own harness: `playground/` is a plain Vite SPA (`Gallery.tsx:145` imports the barrel) and Vite ignores `"use client"` entirely, so no amount of playground testing surfaces it. A minimal Next.js App Router fixture in CI is the only thing that will.

Also worth noting: `packages/ui/src/index.tsx:8`'s admission rule reads "nothing that knows about RDF / SHACL / fossil / graphs" and **omits auth**, while `CONVENTIONS.md:11` includes it. Align the two lists.

---

## Sequenced remediation plan

### The governing constraint

Both packages are `0.0.0`. `git log` reports no commits on `main`. Nothing has been published, no consumer has installed anything, and no version has been pinned. **Every breaking change in this report costs nothing today.** After the first `changeset publish`:

- renaming `--destructive-foreground` requires a major bump across *two* packages plus every generated theme and every consumer's "Copy CSS" output;
- renaming `--kanzo-syntax-prefixed-name` breaks anyone who themed an editor;
- removing `GhostEditor`/`EditorShell` from the barrel breaks every import;
- deleting `KanzoTheme` breaks anyone who followed the README;
- removing `SidebarUser`'s logout props breaks the one composite most likely to be adopted first;
- renaming `variant` axes breaks essentially everything.

Npm versions are immutable and cannot be unpublished after 72 hours. **Do all breaking changes before the first publish.** That is the single highest-leverage sequencing decision available.

### Wave 0 — Unblock the pipeline (do this first; everything else is unverifiable without it)

Nothing below can be validated while CI is red and no DOM test can run.

1. Add `test: { environment: "jsdom" }` to `packages/ui/vite.config.ts`. `jsdom` is already a devDependency.
2. Delete or promote `packages/ui/src/__repro.test.tsx`.
3. Add `@types/node` to `playground/devDependencies` (fixes `typecheck`).
4. Re-baseline `size-limit`: extend `ignore` deliberately (decide "ignore peers, count deps" or "our code only"), set the limit from measurement, add a budget for the 232 kB `dist/styles.css`.
5. Gate the release: inline `typecheck && lint && test` before `changesets/action` in `release.yml`, and scope `release` to `pnpm -r --filter "./packages/*" build` so the disposable playground is off the publish path.
6. Protect `main`, requiring CI.

*Why first:* Wave 1 changes the build output. Without a working test env and a green baseline you cannot tell whether a fix worked, and without a gated release an in-progress fix can ship.

### Wave 1 — Make the artifact correct (blocks publish)

7. **Restore `"use client"`.** `preserveModules: true` + `preserveModulesRoot: 'src'` + `rollup-plugin-preserve-directives`. Do this before Wave 2's subpath work — it changes the emitted file layout. Add the `grep -q 'use client' dist/index.js` build assertion.
8. **Externalize `@internationalized/date`** (one line) and **the theme subpath** (`id.startsWith("@kanzo-tech/theme/")`).
9. **Remove `GhostEditor`/`EditorShell` from the root barrel** — `/editor` becomes their only entry. *Breaking.*
10. Add `"./package.json"` to both `exports` maps; add per-package LICENSE files and `repository` fields; drop `"scripts"` from `packages/theme` `files`; normalize `sideEffects` to `["**/*.css"]`.
11. Add an **install smoke test** to CI: pack both tarballs, install with only non-optional peers into a scratch ESM project, import the root entry, and `renderToString` a server entry. This is what would have caught findings 1, 2 and 3 automatically. Add `publint` + `attw`.
12. Add server-safe entries (`./theme-script`, `./cn`) or rely on `preserveModules` granularity — decide once, since (7) may make this moot.

### Wave 2 — Collapse the theming layer to one story (all breaking; must precede publish)

13. **Delete `KanzoTheme`** (`packages/theme/src/index.tsx:63-90`), its re-export (`packages/ui/src/index.tsx:11`), both test pins, the dead `Appearance` type, and `packages/theme`'s React peer deps. This single deletion resolves findings 7, 8, 12 and half of 23 at once. `@kanzo-tech/theme` becomes CSS + types (+ the axis table, below).
14. Move the axis table (`AXES`, `DEFAULT_PREFS`, `STORAGE_KEY`, `APPEARANCE_KEY`, `ThemePrefs`) from `packages/ui/src/theme/prefs-config.ts` into `@kanzo-tech/theme`; import it in the provider and SSR script. Note `gen-theme.mjs` additionally needs the value lists.
15. **Rewrite both READMEs and `packages/theme/package.json:4`** around `data-*` on `<html>` + `KanzoThemeProvider` + `themeScript()` + `cookieStorageAdapter`. Delete the non-compiling `appearance="light"` example.
16. Add the generator-drift CI gate — and, separately, a test comparing `tokens.css`'s `.dark` block to `theme-data.json`'s `bases.neutral.dark`, since a regenerate-diff cannot catch that duplication.

### Wave 3 — Breaking API cleanup (last chance; batch into one changeset)

17. **Rename the status tokens.** `--destructive-emphasis` etc., plus a genuine on-fill `--destructive-foreground`; then delete every `text-white` leak. Update `tokens.css:16` and `CONVENTIONS.md:42`.
18. **Rename `--kanzo-syntax-prefixed-name` → `--kanzo-syntax-type`, `-iri` → `-url`.** Four call sites.
19. **Strip auth from `SidebarUser`** — add `variant` to `SidebarUserMenuItem` first, then delete the logout props and dialog.
20. **`Preferences`**: `hotkey` defaults to `undefined`; expose props on the all-in-one; derive `DENSITY_PX` from `themeData.densities`.
21. **Decide `variant` vs `intent`** (§7) and either execute the rename here or delete the aspiration from `CONVENTIONS.md`. Do not carry both past 1.0.
22. Delete `composites/slot.tsx`.

### Wave 4 — Non-breaking correctness and hygiene (can land after publish)

23. Fix the three hydration sources; make `setAppearance` write the cookie when storage is cookie-backed.
24. Add `"system"` appearance end-to-end (type, `AppearanceController.theme`, `matchMedia` fallback + subscription, `themeScript` fallback, third `AppearanceSection` segment).
25. `TwoPaneLayout`: `<main>` → `<section>`. Add `"use client"` to `SidebarNav.tsx`.
26. `[data-font]` also sets `--font-heading`.
27. Fix the JSDoc: `showCloseButton @default false`; Radix → Ark at four sites.
28. Backfill `data-slot` across 6 shells + 12 composites; open the ~9 closed prop interfaces to `React.ComponentProps` + `...rest` (both purely additive).
29. Add the API-surface snapshot test.

### Wave 5 — Build the safety net (largest, ongoing)

30. The per-component minimum bar (renders / `className` merges / `ref` reaches DOM / `asChild` swaps), `vitest-axe` smoke pass, keyboard tests per interactive primitive, SSR `renderToString` suite, and a minimal Next.js App Router fixture in CI.

### Rewrite `CONVENTIONS.md` at the end of Wave 3

Not before — the document should describe the code that exists after the breaking changes land, not the code as it is now and not an aspiration. Every row in §7's table should be resolved in that single rewrite, and the result should be true enough that a new contributor following it produces code identical to `button.tsx`.
