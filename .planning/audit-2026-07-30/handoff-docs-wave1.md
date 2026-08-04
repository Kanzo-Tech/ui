# Docs wave 1 — handoff

Written 2026-07-30 by the wave-1 docs agent, on branch `ds-component-and-docs-review`.
Scope worked: `docs/**` minus `docs/CLAUDE.md`, minus the pages and examples of the components
being cut concurrently. Everything below is either **not mine to fix**, **an audit finding I
concluded was wrong**, or **deliberately left for the IA wave**.

Verification standard used: every `file:line` in the audit was opened; every upstream URL was
fetched; the docs app typechecks clean (`npx tsc --noEmit`, exit 0) and all 106 pages' internal
links and anchors resolve (checked mechanically, 0 broken).

---

## What shipped in wave 1

| Commit | What |
|---|---|
| `e87b310` | `philosophy.mdx` 71 → ~250 lines; the three dangling `#the-engine-rule` links land; `section.mdx` rename table deleted |
| `0bda1fa` | `charts.mdx` stops documenting `Fixed`, `from`, `plot`, `coordinator` |
| `66b2314` | `SidebarInset` does not render `<main>` — `sidebar.mdx`, `styling.mdx`, 3 examples |
| `7e714d9` | `installation.mdx` — the `/analytics` row, all peers named, `@kanzo-tech/palette` |
| `8bca3a3` | `links.doc` schema + renderer; 41 of 43 broken Ark URLs corrected |
| `1e5e247` | `llms.txt` origin, section key, packages block |
| `91d8ee3` | the dead `Show` in the chart interactor, and the exception documented on both pages |
| `3920a58`, `f0113c9` | 15 sites of legacy/migration prose, rewritten forward or deleted |
| `dc80b2b` | the four `### When to use which` sections and the three palette paragraphs collapsed |
| `54bca44` | docs imports follow the token helpers off `/analytics` (see A-1) |
| `04ea797` | `BLOCKS` → `SHOWCASES`; `forDisplay` implemented instead of being a no-op |
| `4b56a83` | the landing page said "Six axes"; `AXES` has four |

---

## (a) Belongs to `packages/**` — not mine to fix

**A-1 — RESOLVED IN PASSING, but note the coupling.** `40ecc00` moved `CHART_SLOTS`,
`categoricalColor`, `categoricalCapacity`, `resolveTokenColor`, `useThemeTick` and
`useChartCapacity` from `@kanzo-tech/ui/analytics` to the root barrel. Five `docs/` files still
imported them from the subpath and the app did not typecheck. I repointed them (`54bca44`):
`docs/lib/css-color.ts:13`, `docs/showcases/workspace/graph-model.ts:6`,
`graph-canvas.tsx:6`, `graph-view.tsx:63`, `use-graph-look.ts:5`.
**The lesson for the cut agent: a `packages/**` export move breaks `docs/**` in the same commit,
and `pnpm --filter docs typecheck` is what catches it.** Nothing else in `docs/` imports a moved
name today.

**A-2 — the same false landmark comment survives in three example files, on pages of components
being cut.** Identical to the three I fixed:
- `docs/examples/sidebar-nav/example-default.tsx:45`
- `docs/examples/sidebar-nav/example-active-path.tsx:28`
- `docs/examples/sidebar-user/example-default.tsx:30`

If `SidebarNav` / `SidebarUser` survive in any form, the comment must say that `SidebarInset`
carries no landmark. If they are deleted, this dies with them. **Do not "fix" it by adding a
`ShellMain`** — an example renders inline inside the docs page's own `<main>`, so a second one is
the very error the comment is wrong about. The showcases (`docs/showcases/app-shell/default.tsx`,
`workspace/default.tsx`) render in an iframe route and already do it correctly.

**A-3 — `packages/ui/src/styles.css:22-25` is false in two ways.** It names `[data-base]` and
`[data-accent]`, which `packages/theme/tokens.css:20-21` says are gone and
`packages/theme/src/index.test.ts:24-41` asserts the absence of; and it says *"dark is
next-themes' `.dark`"*, which `docs/app/layout.tsx:36` disproves (`<RootProvider theme={{ enabled:
false }}>`). Comment audit §1.6.

**A-4 — `packages/ui/src/simples/floating-panel.tsx:147` declares `role="separator"`** with no
keyboard handler, no `aria-value*`, no ARIA-contract comment and no test. `CONVENTIONS.md` makes
that mandatory for a bespoke composite role, and Ark ships `Splitter`. Comment audit §9.

**A-5 — `Preferences.tsx` still ships a dot-notation namespace** (`Object.assign`, the statics
noted at `:429` as not surviving RSC) while `styling.mdx` and `CONVENTIONS.md` say the library
never speaks that dialect. `layout/preferences.mdx` currently teaches **both** — flat parts in a
`warn` callout, `Preferences.Root` as its API headings, and a dedicated `Static` column. I did not
touch it: the fix is a library decision (drop the namespace), and the page is in flight for the
identity axis. Audit §3-2.

**A-6 — `ToggleGroup` / `ToggleGroupItem` have no page, no example directory and no prose.** The
only mention on the whole site is an unnarrated fence at `layout/shell.mdx:54-56`. It is the one
export family with zero documentation; whether it gets a page is a component decision, not a docs
one. Audit §1b.

**A-7 — `IdentityNotice`, `IdentityRetiredCopy`, `PreferencesIdentity` and the `data-identity`
axis are live code with zero docs**, and `layout/preferences.mdx:40` still says *"Four sections,
and none of them is a hue"* — which the identity section makes false in the strongest possible
way. This was audit top-10 item 6 and explicitly **not** in my brief; it is still open and it is
the largest remaining factual defect on the site.

---

## (b) Audit findings I concluded were **wrong**

**B-1 — `llms.txt` does not bake the build host in.** `route.ts:25` derived the origin from the
incoming request, so the `localhost:3100` URLs in the report were the auditor's own request
origin. The coordinator has withdrawn this in `README.md`, and my fix never assumed the bake: the
change I made is for the *real* risks — behind a reverse proxy `request.url` carries the internal
bind address, and there was no way to pin the origin for a production build. `NEXT_PUBLIC_SITE_URL`
now wins, forwarded headers are the fallback, `request.url` is the last resort. **The
Forms-filed-under-Getting-started bug in the same file was genuine** (`page.slugs.length > 1` is
false for `forms/index.mdx`) and that fix stands.

**B-2 — `forms/combobox.mdx:12` is not duplicated guidance.** Audit §6-1 lists *"Autocomplete is a
Combobox presentation"* as a restatement of `forms/controls.mdx:56-63`. On reading both: the
callout on `combobox.mdx` documents **that component's own prop** (`showTrigger`) on its own page,
and `controls.mdx` explicitly delegates to it (*"Same machine, same props, one page: Combobox"*).
That is the correct division, not drift. Left as it stands; the other four in §6-1 were real and
are collapsed.

**B-3 — `data-display/status.mdx:31,44` is not legacy prose.** Audit §6-4 files it under "delete
outright (pure history, no surviving lesson)". It is the evidence for a **live guard test**:
`status.test.ts` asserts that no variant repaints its colour in one mode only, and the paragraph is
the measured defect (2.35:1 in dark, through a `dark:bg-destructive-foreground` Shark ships) that
the test exists to prevent recurring. That is the house register — name the decision, say what was
rejected, cite a measurement — not archaeology. Kept deliberately.

**B-4 — audit §1c-4's count is wrong in the other direction.** It says "six optional peers across
three subpaths". `packages/ui/package.json` `peerDependenciesMeta` marks **twelve** package names
optional (1 table + 4 analytics + 7 editor). `installation.mdx` now names every one rather than
counting them, because a count is the thing that goes stale.

**B-5 — audit §1c-2's action item "fix `CONVENTIONS.md:92` in the same pass" is already done** by
another agent's rewrite; `CONVENTIONS.md` no longer mentions `SidebarInset`. Likewise §5-1's
`DESIGN.md:23,349` — `docs/blocks/` is gone from `DESIGN.md`. Only the `docs/`-side vestiges
remained, and those are fixed (`04ea797`).

**B-6 — audit §2-7b is half wrong.** `FULL_BLEED_GROUPS = new Set(["showcases", "sidebar"])` does
contain a group that does not exist (`sidebar`), but `isFullBleedComponent()` does **not** return
`false` for every slug — `showcases` is a real group. What was genuinely dead was the *doc comment*
on `component-preview.tsx:20-24`, which described derivation from a `layouts` or `blocks` group,
neither of which exists. The comment is corrected; the `"sidebar"` entry and the eight hand-passed
`fullBleed` props are left for the IA wave, because the answer depends on what the groups become.

**B-7 — DESIGN.md's own evidence was stale, and is now gone.** Audit §1d flagged
`DESIGN.md:272`'s citation of `docs/examples/form/tanstack/example-card-radio-group.tsx`, which
does not exist. The DESIGN.md rewrite has already removed that paragraph. No action left.

---

## (c) Deliberately left for the IA wave

**C-1 — every page of a component being cut.** Untouched by design: `navigation/breadcrumbs`,
`navigation/sidebar-user`, `navigation/sidebar-nav`, `navigation/instance-switcher`,
`navigation/link`, `overlays/empty-state`, `overlays/ribbon`, `layout/made-with`,
`forms/text-field`, `forms/date-field`, `data-display/data-table`. Two consequences to pick up:
- **Two upstream links are still 404** and were deliberately not rewritten:
  `forms/text-field.mdx:5` → `https://ark-ui.com/docs/forms/field` (correct target:
  `https://ark-ui.com/docs/components/field`) and `forms/date-field.mdx:5` →
  `https://ark-ui.com/docs/forms/date-picker` (correct: `.../components/date-picker`). Fix them if
  the pages survive; they go with the pages otherwise.
- **`forms/controls.mdx` links four cut names** — `TextField`, `NumberField`, `DateField` (rows
  23, 24, 98) — and `philosophy.mdx`'s engine-rule table links `DataTableRoot`, which survives. The
  controls index is now the canonical answer for the whole choice cluster, so it must be updated in
  the same commit as the cut or the site's most-linked page points at nothing.

**C-2 — audit §1c-9, the `data-table.mdx:13-14` abbreviations.** *"`DataTableRoot` / `Toolbar` /
`Search` / `FacetFilter` / …"* — those short names are not exports, and `FacetFilter` collides with
a real root-barrel export. Not fixed because `DataTable` is on the do-not-touch list. One-line fix:
spell out `DataTableToolbar`, `DataTableSearch`, `DataTableFacetFilter`, `DataTableViewOptions`,
`DataTableContent`, `DataTablePagination`.

**C-3 — the ten page merges (audit §3-4) and the group re-cut (§2-2, §2-3, §2-4, §2-5).** All of
it is IA: `segment-group` → Forms, `code-editor` → Forms, `preferences` + `appearance-toggle` →
Theming, `accordion` + `collapsible` → Disclosure, `show` + `client-only` → Rendering, the sidebar
family into one page, the date family into one, the text inputs into one. `philosophy.mdx` now
states the three axes, which is the argument those group names should be made to satisfy — the
page to cite when doing it is `/docs/philosophy#the-three-axes`.

**C-4 — the 39 pages with no inbound link (§4-2).** I closed four of them by hand — `styling`
(from the index and from `philosophy`), `tanstack-form` (from `validation.mdx:58`), `editable`
(the new Controls row), `show` (from `charts.mdx`). The rest are a linking pass that should follow
the merges rather than precede them; in particular the whole `overlays/` group is mutually
unlinked, and Popover ↔ HoverCard ↔ Tooltip needs the one-line rule that `forms/controls.mdx`
gives the listbox family.

**C-5 — `<TypeTable>` (§3-3b) is registered in `mdx-components.tsx:35` and used on 0 of 106
pages**, as are `Accordion`/`Accordions` and `File`/`Files`/`Folder`. This is a standing decision,
not a defect: adopt it and convert, or delete the registrations and standardise on the markdown
table. It blocks the 31 pages with no API section, so it should be settled before the merge pass
rewrites those tables.

**C-6 — `## Keyboard` tables (§3-3a).** 13 of 106 pages document a keyboard contract, and none of
the ten components that declare a composite role has one. This is the largest single gap against
`CONVENTIONS.md`'s accessibility clause and the missing half of the "reference-grade" claim on
`(root)/index.mdx`. Left whole: it is a per-page authoring pass, not a fix.

**C-7 — three orphan example files (§5-5)**, referenced by no page and imported by nothing:
`docs/examples/charts/example-stat.tsx` (the only live `ChartStat` + `DashboardGrid` example, while
`charts.mdx` shows the same shape as a static fence), `example-color-legend.tsx`, and
`docs/examples/forms/example-controls.tsx` (`forms/controls.mdx` has zero previews). Wire them in
or delete them — but decide after the merges, since two of them belong to sections that may move.

**C-8 — `docs/showcases/metric-card/` (§5-3)** is a six-part compound parked in the showcases
directory, imported by four `data-display/card` examples, with no page and no `/view/showcases/`
route. `forDisplay` now tells the reader where to copy it from (`04ea797`), which removes the
sharpest edge, but the deeper question — a "showcase" that is never shown — is a minimality call
for the IA wave. Under the governing constraint it should be inlined into one example file.

**C-9 — `llms.txt` still sorts alphabetically within a group** (§4-4c), discarding `meta.json`'s
curated order, so `Controls` and `Building a form` do not lead Forms and the `---Text---` /
`---Choice---` structure is lost. Left because the sort should key off the page tree, and the page
tree is what the IA wave rewrites.

**C-10 — `next.config.ts:7-11` still claims the docs consume the library from source.** They
consume `dist` (`docs/tsconfig.json` has no `@kanzo-tech/ui` alias, so resolution goes through
`exports` → `./dist/index.js`), and `docs/app/global.css:11` gets it right. `transpilePackages` is
there for the `"use client"` directives and the CSS, not for source consumption. I left it because
`docs/CLAUDE.md` is another agent's file and now states the dist rule; the comment should be
corrected to agree with it rather than contradicting it in a second place.

---

## Two things worth carrying forward as rules

1. **A count is the thing that goes stale.** "Two peers", "Six axes", "Four sections", "twenty-three
   parts" — four of the factual defects in this wave were a number that outlived its subject. Where
   the set is short, enumerate it; where it is long, do not count it in prose.
2. **An example renders inside the docs page's own `<main>`.** Any advice of the form "put a
   landmark in the example" is wrong for `docs/examples/` and right for `docs/showcases/`, which
   get their own iframe route. That distinction is not written down anywhere else.
