# Component and documentation audit — 2026-07-30

Five parallel read-only audits against `e210a59` plus the parallel session's uncommitted identity-axis
work. Nothing in `packages/` or `docs/` was edited. The four reports beside this file are the
evidence; this one is the decision queue.

**The criterion applied**, stated by the owner mid-audit and applied retroactively to every finding:

> A minimal system — the fundamental generic pieces to grow from, not a catalogue. Genericity over
> specificity. No legacy, no backwards compatibility, no deprecation shims. **Any prior decision may
> be reopened**, including the ones `DESIGN.md` argues as settled.

The burden of proof is therefore inverted: a component built over parts that already ship needs a
positive reason to **stay**, and "it has two call sites in our own showcases" is not one —
`DESIGN.md:23` already says specific arrangements belong in showcases.

## Status

| Audit | State | Report |
|---|---|---|
| Taxonomy, duplication, gaps, surplus | delivered | `audit-taxonomy.md` (726 lines, 54 confirmed) |
| Comments | delivered | `audit-comments.md` (1,285 lines, 612 files scanned) |
| Docs site | delivered | `audit-docs-site.md` (902 lines, 106 pages, 327 examples) |
| Agent-guidance system | delivered | `audit-guidance.md` (786 lines, 16 files, ~6,300 lines) |
| Export surface | rewriting after an API session limit | `audit-exports.md` — pending |

Live verification, done in the browser against the running docs server rather than inferred from
source: **all 106 MDX pages render** — no HTTP failure, no error boundary. The `--chart-*` family
resolves in both modes and the gallery consumes it; single-series marks render neutral, which is
correct. So no page and no chart is broken. Every finding below is about *content*, not plumbing.

---

## 1. Convergent findings — independently found by two or more audits

These carry the highest confidence in the set: separate agents, separate scopes, same conclusion.

| # | Finding | Found by | Evidence |
|---|---|---|---|
| 1 | **`SidebarInset` does not render `<main>`, and four places say it does.** An accessibility conformance error readers will copy: no landmark, ambiguous skip-link | comments, docs-site, guidance | `CONVENTIONS.md:92`, `navigation/sidebar.mdx:41`, `(root)/styling.mdx:102`, six example pages — all against `composites/sidebar.tsx:347-349` (an `ark.div`) and `DESIGN.md:143`, which are right |
| 2 | **`DESIGN.md`'s longest argument is about a component that was deleted.** `CardRadioGroup` went in `06a3231`, kept dead by a tombstone assertion, and `DESIGN.md:264-273` still debates unwinding it while citing two paths that no longer exist | taxonomy, comments, guidance | `packages/ui/src/index.test.ts:95-99`; the grid it owned is now `RadioGroup`'s `columns` prop, `simples/radio-group.tsx:26` |
| 3 | **`DESIGN.md:231-240`'s export census is stale**, and the paragraph presents it as "the live version … the one to cite instead" | taxonomy, guidance | Numbers disagree between audits — see §3 |
| 4 | **`docs/blocks/` does not exist**; showcases live in `docs/showcases/` | taxonomy, docs-site | `DESIGN.md:24`, `DESIGN.md:349`, `layouts/shell.tsx:12`, `app/view/showcases/[name]/page.tsx:18` |
| 5 | **One rule is broken seven times and is written only in a doc comment on an unrelated composite** — the array/record-of-`ReactNode`s prop standing in for composition | taxonomy §3, guidance §5 | Stated at `composites/SidebarIdentity.tsx:31-36`; violated by `Breadcrumbs`, `SidebarNav`, `InstanceSwitcher`, `SidebarUser`, `EmptyState`, `Ribbon`, `TextField`. Two hand their record straight back into `SidebarIdentity` itself |
| 6 | **`README.md` and `packages/ui/README.md` are the stalest files in the repo — and both are the npm landing page.** Six symbols that do not exist | guidance, docs-site | `TopBar`, `StatusBar`, `WorkspaceLayout`, `CommandPalette`, `EditorShell`, `GhostEditor`; plus an `accent` axis deleted in `1975b9a` |
| 7 | **The design reasoning ships nowhere a consumer looks.** The three axes, admission rules, the ladder, the engine rule and the minimality rule exist only in `DESIGN.md` | docs-site, guidance | Three pages link "the engine rule" to `/docs/philosophy`, which does not contain it: `charts.mdx:417`, `table.mdx:16`, `stat-tile.mdx:19` |

**The single most consequential of these is #7.** The library's value is that it explains itself, and
the explanation is in a file consumers never open.

---

## 2. The queue — what to apply, in order

Each block is independently mergeable. Sizes are the auditors' estimates, not measurements.

### Block A — Falsehoods. Do first, cheap, and every one is a claim a reader will act on.

1. The `SidebarInset` / `<main>` lie, four sites (#1 above).
2. **53 false comments**, 34 confirmed. Not ceremony — the *load-bearing* ones failed: measurements
   whose subject was regenerated, counts that drifted. `roles.ts:340` says "23 sites write
   `bg-input/NN`"; the only two occurrences of `bg-input/` in the repo are that comment and its twin.
3. **"Vendored as-is" is the most dangerous one.** `index.tsx:3` and `eslint.config.js:29` claim the
   simples are Shark-verbatim; there are 37 solid `ring-ring` and zero `ring-ring/50`, a divergence
   `CONVENTIONS.md:81` took a 1.29:1 contrast measurement to justify. The comment invites the exact
   regression the measurement exists to prevent.
4. **Four dead exports documented on the charts page** — `Fixed`, `from`, `plot`, `coordinator`
   (`charts.mdx:128,559-561`), all deliberately deleted with the reasoning recorded in `analytics.ts`.
5. `installation.mdx:36` — "Two peers are optional" omits `/analytics` and its four peers, and
   `@kanzo-tech/palette` is absent from a page titled "Two packages".

### Block B — The cut. 18 deletions and 2 relocations: ~122 files → ~104, 881 exports → ~690.

Ordered by value in `audit-taxonomy.md` §2b. The head of the queue:

1. **`InstanceSwitcher` + `SidebarUser` are one component with two names** — byte-identical trigger,
   identity row and menu body, down to copy-pasted justification comments. This is the same charge
   `DESIGN.md` upheld against `SectionHeader`/`PageShell`/`TopBarMain`, which merged.
2. **`Breadcrumbs`** — verified against the reference: Shark ships one breadcrumb, the compound, and
   does *Collapsed* and *With menu* as hand-composed examples. Our plural forced a synonym
   (`BreadcrumbEntry`, because `BreadcrumbItem` was taken) — a component that makes you rename an
   existing concept is arguing against itself. Its `min-w-0` fix moves onto the primitive; its
   collapse becomes an example.
3. `SidebarNav`, `EmptyState`, `Ribbon`, `MadeWith` (which hard-codes English *and* the brand name
   "Kanzo" in a library whose first admission rule is domain-freedom), `TextField`/`NumberField`,
   `theme/prefs-config.ts` (a pure re-export shim whose own comment says it exists "so the existing
   import sites here keep working" — the exact shape `CONVENTIONS.md:67-70` already deleted once),
   `table/DataTable.tsx`, `DateField`, the `Link.tsx`/`link.tsx` case-collision pair.
4. **The 150 zero-consumer capitalised exports.** The trap `DESIGN.md:236-240` names is real:
   `ProgressTrack`, `CheckboxIndicator` and the `Calendar Table*` parts are rendered by their own
   root — delete the *export*, keep the *symbol*. There is no compatibility question; nothing
   consumes them.

**Explicitly not cut, against the minimality instinct:** the 43 chart mark/interactor wrappers with
no call site. They fail admission rule 2 outright and the auditor still keeps them — one-line `vg.*`
descriptors over a grammar where a mark you write yourself is a mark you write wrong. But the only
place that argues this is a comment in `analytics.ts:148-150`, and as written the admission rules
condemn it. **That argument needs to move into `DESIGN.md` or the exception needs to go.**

### Block C — Live defects the audits found on the way past

1. **A class-wide `data-slot` collision.** Components that write `data-slot` *before* `{...rest}` let
   a caller's value erase the primitive's own. Three confirmed sites (`chart-inputs.tsx:565`, `:408`,
   `:580`) silently break two `field.tsx` recipes that select `[data-slot=field]`. One-line fix:
   move `data-slot` after the spread. The pending export audit is counting the full blast radius.
2. **`chart-inputs.tsx:523` contains a raw NUL byte**, which makes the file binary to `grep` and
   `file` — it silently excluded the largest chart file from three of the auditor's own searches.
3. **`ShellAside` carries `bg-card`** — a surface, in the layer whose headline rule (`DESIGN.md:126`)
   is that regions carry no aesthetic.
4. **`floating-panel.tsx` declares `role="separator"`** with no keyboard handler, no `aria-value*`,
   no ARIA comment and no test — while carrying a five-line ΔE measurement about its hover colour.
   Ark ships Splitter; it is not used. `CONVENTIONS.md:89` calls this "worse than no role at all".
5. **71 of 122 source files have no sibling test**, including `composites/sidebar.tsx` (850 lines, a
   global keydown listener, cookie writes, `Math.random()` in a `useMemo`) and `simples/table.tsx`.
6. **`links: doc:` frontmatter on 55 pages renders nowhere** — `app/docs/[[...slug]]/page.tsx` never
   reads `page.data.links`. Half the site's curated upstream links are invisible, and `DESIGN.md:322`
   cites that frontmatter as evidence for an argument.
7. **`llms.txt` bakes the build host into all 106 links** (`http://localhost:3100/...`), in the one
   file whose entire audience is machines.
8. **A live example is silently dead** — `examples/charts/example-interactor.tsx:69-71` wraps
   `ChartHighlight` in `Show`, and `chart-spec.ts:102-104` skips any descriptor inside a consumer
   component. The house `Show` style and the chart grammar are incompatible and nothing says so.

### Block D — Documentation: 106 pages → ~82, eight groups → six

Full proposed sidebar tree and the ten highest-value fixes in `audit-docs-site.md`. The shape of it:
write the reasoning onto `philosophy.mdx` (71 → ~250 lines) so the three dangling "engine rule" links
land somewhere; merge nine families (24 pages → 9); move `Preferences` and `AppearanceToggle` out of
`layout/` into `Theming`; delete 24 sites of migration prose including a 7-row rename table.

**The minimality evidence is measurable:** 17 pages open by disambiguating themselves from a sibling,
6 mirrored pairs where both halves do it, the same "when to use which" rule written in 3–5 wordings,
and 39 of 106 pages have no inbound link from any other page. A page that must spend its opening
paragraph explaining how it differs from its neighbour is evidence the two should be one page — or
one component.

Also measured: `## Usage` on 86/106 pages, Anatomy on 53, an API section on 75, **accessibility or
keyboard on 13**, and `<TypeTable>` on **0** despite being registered in `mdx-components.tsx:31`.

### Block E — The agent-guidance system: 16 files / ~6,300 lines → 9 files / ~600

**The cold-start cost, measured.** No `CLAUDE.md`, no `AGENTS.md`; `.claude/` holds four lines of
permissions. `README.md` — the only file a newcomer opens — never names `DESIGN.md` or
`CONVENTIONS.md`, and nothing else cross-references them either. An agent meets the repo's most
strictly enforced rules as a red test: `alpha-steps.test.ts` bans seven token spellings and
`CONVENTIONS.md:80` documents two.

Three proposals, in `audit-guidance.md`:

1. **A 46-line `CLAUDE.md`** carrying only what exists nowhere else: the three standing constraints
   (which today are transmitted solely by the owner repeating them in chat), the discovery map, the
   four one-way doors, and the build order. Drafted in full.
2. **A four-field decision record** — `what` / `because` / `reversed by` / `status` — one per file
   under `decisions/`, so `DESIGN.md` becomes a ~60-line index and **reopening a decision costs
   editing a field rather than winning an argument again**. This is the direct answer to "any
   decision may be reopened": today `DESIGN.md` patches itself in prose (`DESIGN.md:224` — *"That was
   true when it was written and is no longer true"*), which is honest and unreadable by an agent that
   cannot tell which paragraph won.
3. **Delete 8 of 11 `.planning/` files (~3,400 lines) and 61 of 62 changesets (~1,900 lines)**, after
   harvesting 18 named arguments into decision records. `ARCHITECTURE-AUDIT.md` has never been edited
   since the initial commit while 177 commits of remediation landed on top of it; ~34 of its 40
   findings are resolved and every path it cites was renamed or deleted. Nothing is published, so
   there is no changelog to preserve.

**The recurrence inventory (`audit-guidance.md` §5) is the real specification for all of this.** Seven
mistakes recur: N-ways-to-do-one-thing (9 instances), untokenised colour (3, now caught by a test),
`data-slot` omitted (3, no test), a role claimed without its keyboard contract (2), a component
designed then redesigned (5 families), a docs-vs-source fix applied at the wrong layer (2), and dead
names surviving a rename in prose (7 sites). A rule nobody breaks does not need writing down; a
mistake made nine times needs to be unmissable.

---

## 3. One unresolved discrepancy — do not act on either number yet

Two audits independently recounted the export census and **disagree**:

| | `DESIGN.md:231-240` claims | Taxonomy audit | Guidance audit |
|---|---|---|---|
| Exported values | 733 | **881** | 733 reproduces exactly |
| Referenced nowhere | 139 | **293** | 60 |
| In exactly one example dir | 122 | **108** | 95 |
| `useX` aliases unused | 42 of 56 | 38 of 58 | — |
| `*Variants` unused | 14 of 21 | 2 of 10 | 10 total |

The gap is almost certainly a method difference — what counts as an export (type-only? re-exports?
subpath barrels?) and what counts as a consumer (the barrel itself? tests? examples?). The export
audit is being rewritten now and has been asked to adjudicate explicitly and state its method.

**Both agree on the direction and on the conclusion that matters:** the numbers in `DESIGN.md` are
wrong, and the paragraph containing them presents itself as the authoritative correction to an
earlier wrong count. That paragraph should cite a script, not a number.

---

## 4. Corrections to the audit's own premises

Recorded because the standing lesson in this repo is that audit documents have been wrong before:

- **`CardRadioGroup` does not exist** — the brief assumed it did, following `DESIGN.md`.
- **`composites/sidebar.tsx` does not hand-roll Separator/Input/Skeleton/Tooltip/Sheet/Button.** All
  six are imported and delegated to; it is the best citizen in the set on "adopt, don't rebuild".
- **The codebase has no restating-comment problem.** A mechanical sweep for comments whose every word
  appears in the line below returned **one hit in 612 files**; there is **zero** commented-out code
  and there are **zero** filler banners. The volume complaint is real but the cause is duplication
  and staleness, not ceremony: one paragraph is written out in full **nine** times, and that is
  precisely why three copies went stale independently.
- **`docs/examples` is the leanest area in the repo at 4% comment density**, not the worst. The
  concentration is `packages/palette/src` — 28% of every comment in the repo — and
  `packages/theme/src` at 55%.
- **`--chart-*` is a real bounded eight-slot family now**, verified live in both modes.

---

## 5. What has not been audited

- **The export surface** — report pending.
- **The parallel session's identity-axis work**, which grew from 27 to 40 files during the audit.
  Findings landing on it are tagged IN-FLIGHT in the reports and may already be fixed.
- **Visual regression.** Pages were verified to render and to be free of client errors; nobody
  compared them against a reference for appearance.
- **`.claude/worktrees/`** — two further stale copies of the repo, out of scope.
