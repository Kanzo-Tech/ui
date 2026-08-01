# Handoff — the guidance refoundation

What was built is in `CLAUDE.md`, `DESIGN.md`, `CONVENTIONS.md`, `decisions/`, the two READMEs and
`docs/CLAUDE.md`. This file is the residue: what I found that was not mine to fix, what the audits
got wrong, and what I decided on my own authority.

Everything below was re-verified against this worktree at `476deaf`. Where I could not verify a
claim, it says so.

---

## (a) Fixes that live in `packages/`, `docs/`, `scripts/` or the root config

Routed here because I own only the guidance tree. Ordered by consequence.

### Live defects

| # | Where | What |
|---|---|---|
| a1 | `packages/ui/src/simples/alert-dialog.tsx:76-80` | **`AlertDialogAction` does not close the dialog.** It types itself `React.ComponentProps<typeof DialogClose>` and renders a plain `<Button variant={variant} {...rest} />`. The type promises the close behaviour and the body does not deliver it. Confirmed by reading both. **Closed 2026-08-01** — `alert-dialog.tsx:AlertDialogAction` wraps the button in `<AlertDialogClose asChild>`, the shape `AlertDialogCancel` beside it already had. Type and body now agree. |
| a2 | `packages/theme/themes.css` | **The font axis does not move headings.** `--font-heading` is consumed at `simples/card.tsx:113`, `simples/alert.tsx:85`, `simples/dialog.tsx:295` and `composites/Preferences.tsx:179`, and `tokens.css:134` declares it as a self-referencing fallback — but `themes.css` contains zero occurrences of `font-heading`, so no `[data-font]` rule ever sets it. Changing the font axis leaves every heading on the fallback. **Closed 2026-08-01** — fixed at the generator, not in the artefact: `packages/theme/scripts/gen-theme.mjs` emits `{ "--font-sans": stack, "--font-heading": stack }` for every `[data-font]` block, with the reason above it ("there is ONE font axis") and the escape hatch named — a product wanting a distinct display face overrides `--font-heading` itself. All three `[data-font]` rules in `themes.css` now set both, and `check:generated` keeps them in step. |
| a3 | `packages/ui/src/simples/progress.tsx:54` | **`ProgressTrack` is exported and rendered unconditionally by its own root** (`<ProgressTrack><ProgressRange /></ProgressTrack>` inside `Progress`). A consumer who follows the export gets two troughs. Delete the export, keep the symbol. Corrects `DESIGN.md`'s old "ideal case" framing; recorded in `decisions/an-export-needs-a-second-call-site.md`. **Reversed 2026-08-01, not closed — do not act on the instruction in this row.** The observation reproduces; the conclusion was overturned by `decisions/a-house-principle-withholds-no-name.md` (Status live), on the ground that Shark's own `progress.tsx` renders the same two parts in the same place and exports both anyway. `ProgressTrack` is exported today and pinned by `packages/ui/src/index.test.ts`; deleting the export now fails that guard and `shark-parity.test.ts`. The same reversal covers `CheckboxIndicator`, the `CalendarTable*` parts and `FieldSeparator`. What survives of `an-export-needs-a-second-call-site` is the narrower rule, governing only names the reference is silent about. Full note at `handoff-cut.md` §3f and `README.md` item 4. |
| a4 | library-wide | **Superseded 2026-07-30 — the owner took the broader rule.** This started as a `data-slot` passed down into another component (`chart-inputs.tsx:565`, `:402`, `:580`). The export census reframed it: the great majority of sites write `data-slot` *before* the spread, so a caller can silently erase any of them. The decision is now **the primitive owns its slot** — `data-slot` after `{...rest}`, everywhere, with a guard test. `CONVENTIONS.md` states it, `decisions/a-primitive-owns-its-slot.md` carries the reversal condition, and the cut agent is executing the sweep. |
| a4b | ~~`chart-inputs.tsx:523`, a raw NUL byte~~ | **CLOSED 2026-07-31.** Rewritten as the escape `\u0000`, identical behaviour, and `data-slot.test.tsx` now asserts no source file contains one — because a grep-based guard would have skipped the chart layer's largest file and reported a pass. |

### False claims a reader will act on

| # | Where | What |
|---|---|---|
| a5 | `package.json:5` | Root description: *"shared **Radix Themes** primitives & shells"*. Nothing in the tree uses Radix. Flagged in `.planning` eight days before the audit and still there. **Closed 2026-08-01** — the root `description` now reads "a domain-free component library over Ark UI, the design tokens it is themed by, and the colour derivation behind them". A grep for `Radix` across every source, manifest, doc and MDX file returns nothing outside this audit directory. |
| a6 | `packages/ui/package.json:4` | Description still speaks of "Level 1 primitives" and "Level 2 shells", a vocabulary neither governing document has used since the layers were renamed. |
| a7 | `packages/ui/src/index.tsx:3` and `:82`, `eslint.config.js:30` | **"Vendored as-is" / "byte-faithful".** The most dangerous stale comment in the repo: it invites exactly the regression the solid-focus-ring measurement exists to prevent, since the rings *deliberately* diverge from Shark. Say "vendored, with declared divergences" and name where they are declared. **Closed 2026-08-01 at all three named sites**, and the advice was taken almost verbatim: `index.tsx:3` reads "adopted from Shark UI and rebranded to our tokens — adopted, not vendored", naming `CONVENTIONS.md` as where the divergences are recorded; the `:82` `Level 1` banner is gone with the rest of the layer vocabulary; `eslint.config.js` says "adopted from Shark UI, with declared divergences" and cites the contrast finding. **Two sites this row did not name still carry the claim, and both face a consumer**: `docs/content/docs/(root)/index.mdx` ("vendored as-is in the shadcn-style registry model") and `packages/ui/README.md` ("the vendored primitive set"). Reopened as a new item under `README.md` Block A. |
| a8 | `packages/ui/src/layouts/shell.tsx:12` | Cites `docs/blocks/`, which does not exist — the directory is `docs/showcases/`, renamed in `c6cad41`. **Closed 2026-08-01** — `layouts/shell.tsx` cites `docs/showcases/`, and a repo-wide grep for `docs/blocks` returns hits inside this audit directory and nowhere else. `DESIGN.md`'s two copies went with the rewrite. |
| a9 | `docs/content/docs/navigation/sidebar.mdx:41`, `docs/content/docs/(root)/styling.mdx:102`, and the example pages the docs audit lists | The `SidebarInset` / `<main>` claim. Both governing documents now say the opposite, correctly; the docs copies are another agent's. (Several of these files were being edited concurrently while I worked — check before applying.) **Closed 2026-08-01** — the docs agent applied it. `navigation/sidebar.mdx` now opens the section "**`SidebarInset` carries no landmark**", `(root)/styling.mdx` calls it "a neutral offset `<div>` that carries no landmark — the `ShellMain` you place", and `showcases/app-shell.mdx` says the same in the sentence that places the shell inside it. The source agrees: `composites/sidebar.tsx:SidebarInset` is an `ark.div` with the reason in a comment above it, `layouts/shell.tsx:ShellMain` owns the landmark, and `CLAUDE.md` carries it as a one-way door. |
| a10 | ~~`scripts/smoke-install.mjs`~~ | **CLOSED 2026-07-31, and it was worse than reported.** The leak guard named two symbols that had never existed here, so it could not fail; and the whole script was dying inside `npm install` before its first assertion, on an upstream `workspace:^` peer range published by `@uwdata/mosaic-core`. It now makes nine real checks including the two its header had always claimed — directive preservation and optional-peer reachability — both mutation-tested. |

### Tests worth writing

| # | What | Why |
|---|---|---|
| a11 | ~~**A `data-slot` guard.**~~ | **CLOSED 2026-07-31** — `packages/ui/src/data-slot.test.tsx`, six assertions, mutation-tested. It catches a4's shape too: a bare `data-slot` on one of our components, and one on a provider-only root that never reaches the document. |
| a12 | **A dead-name guard over the guidance tree.** | Grep `CLAUDE.md`, `DESIGN.md`, `CONVENTIONS.md`, `decisions/*.md`, `docs/CLAUDE.md` and every `README.md` for backticked identifiers, and fail when one resolves to no export, file or token. This is the mechanism that stops the whole class of defect the audit found. `packages/theme/src/boundary.test.ts` is the template: forty lines, with the reason beside the assertion. |
| a13 | **Record integrity.** | Every `Held by` path in `decisions/` exists; every `Status: superseded by <slug>` resolves; no `Because` line contains a digit. I verified all three by hand today; nothing keeps them true. **Closed 2026-08-01** — `packages/ui/src/decisions.test.ts` is the run, and it went past all three: fourteen assertions across "the decisions/ records" and "DESIGN.md's index of the decisions", including *resolves every superseding record it names*, *writes no number in a Because* and *points every path it cites at a file that exists*. Its header records why resolution alone was not enough — a self-audit of ~470 claims found twenty-six false ones and every one of them passed a resolution check, because a stale claim's path resolves and its symbol still exists. So it also asserts *names a real assertion wherever it cites a test by name* (a multi-word citation beside a `*.test.ts` path must match a real `it()`/`describe()`) and *keeps every declared absence absent from the barrel* (the `` `!Name` `` convention, checked against `./index`). Both were added because the corpus's most expensive sentence was "the export has since been removed", written of `ProgressTrack` — see a3. |
| a14 | **An export-surface snapshot.** | The one open finding from the deleted `ARCHITECTURE-AUDIT.md` worth keeping. `decisions/a-count-belongs-in-a-script.md` argues the census must be a script rather than prose; nobody has written the script into the repo. The export audit's `exp-census-ts.mjs` lives only in a scratchpad. |

### Open items rescued from the deleted `.planning/` files

These had no other home. None is a decision, so none became a record.

- **`Calendar` is visually broken** — *"visualmente totalmente roto"*, from the owner's own
  walkthrough. No commit anywhere touches it since.
- **`ColorPicker` swatch click behaviour is confusing**, and `simples/color-picker.tsx:365` carries
  a `text-white` literal. That file is the single entry in `no-literal-hues.test.ts`'s `ALLOWED`
  set, which is defensible for a colour picker but means nothing checks that one.
- **`Tour`'s close button is still mis-positioned** inside the dialog; an earlier `pe-8` fix did not
  land it.
- **`Breadcrumb`'s ellipsis/number is mis-positioned.**
- **No `LICENSE` file and no `repository` field.** All three packages declare `"license": "MIT"`
  and none declares a repository; there is no `LICENSE` at the root. Both matter at first publish.
- **Three hydration reads in `useState` initialisers** (from the old audit; I did not re-verify
  which, and per `decisions/an-audit-is-a-map-not-an-oracle.md` nobody should act on that sentence
  without finding them again).

---

## (b) Where the audits — including mine — were wrong

Stated plainly, because that is the standing lesson.

1. **My own §5 said "one `MosaicProvider` per route".** Wrong, and the code says so:
   `docs/examples/charts/mosaic-boot.tsx:11-15` explains that it is one **coordinator** per page —
   the active-coordinator setter is process-wide — while each provider still gets its own pair of
   selections, so several providers on one page are fine and correct. `docs/CLAUDE.md` says the
   accurate version.

2. **My own §1 called `DESIGN.md`'s `733` "TRUE — CONFIRMED", reproducing it exactly.** The export
   audit's compiler-API census says no scope produces 733. Three independent recounts, three
   different answers. I have not replaced the number with a fourth; the paragraph is gone and
   `decisions/a-count-belongs-in-a-script.md` says why, including the two method traps that explain
   the disagreement — `.claude/worktrees/` inflating consumer counts, and the reference join having
   to key on absolute declaration position.

3. **`DESIGN.md:239`'s "`ProgressTrack` is the ideal case, not a defect" was wrong**, and my audit
   had marked it TRUE — CONFIRMED, on the strength of the docs page saying you never place it
   yourself. The docs page is right about the intent and the code contradicts it: the root renders
   the track unconditionally (a3). I verified this myself before writing anything either way.

4. **`CONVENTIONS.md:81`'s "37 sites" was defensible after all.** My audit called it stale and
   measured 40 occurrences across 30 files; the comments audit re-measured `ring-ring` over
   non-test source at exactly **37**. The discrepancy is a scope difference, not rot. I removed the
   number anyway — not because it was wrong, but because no test carries it.

5. **`CONVENTIONS.md:86`'s bespoke-code claim was worse than "false twice".** It named `GhostEditor`,
   which does not exist, and contradicted the line five below it. But the deeper problem is that the
   sentence undercounts by an order of magnitude: the sidebar, the shell, the field array, the facet
   filter, twenty-odd chart modules and nine table modules are all ours. The rewrite says so.

6. **The `Heading` / `Text` question in `REVIEW-BACKLOG.md` was already resolved** and I nearly
   carried it forward as an open item. `simples/prose.tsx` replaced both, and its own header records
   the change. Nothing to hand off.

7. **The `CodeEditor` gutter findings in `NAMING-TAXONOMY.md` did not need rescuing.** My audit
   called them "the highest-value loss in `.planning/`" if they were not commented in the source.
   They are: `composites/CodeEditor.tsx:99-140` carries the double-counted-padding argument and the
   paint-on-`.cm-scroller` reason, at more length than the planning file. Deleted with no
   extraction.

8. **`llms.txt` baking in the build host — withdrawn.** `docs/app/llms.txt/route.ts:25` derives the
   origin from the incoming request (`new URL(request.url).origin`), so the `localhost:3100` in the
   output was the auditor's own request origin. The coordinator has confirmed and withdrawn it;
   `.planning/audit-2026-07-30/README.md` §2 Block C now records it struck through rather than
   deleted, because a withdrawn finding is the cheapest possible evidence for
   `decisions/an-audit-is-a-map-not-an-oracle.md`.

9. **The changeset count was 62 in the audit and is 57 here.** The difference is the parallel
   session's in-flight files, which are in the main checkout and not on this branch. `.changeset/`
   now holds `config.json`, `README.md` and one changeset. **If the in-flight session adds its
   changesets back on merge, they will need the same treatment**, including the two that litigate
   the appearance axis against each other. That instruction no longer lives only here: it is in
   `decisions/one-changeset-until-the-first-publish.md` and in `.changeset/README.md`, where
   whoever runs `pnpm changeset` will meet it.

---

## (c) Decisions I took that you should know about

1. **`DESIGN.md` is 163 lines, not the 60 the audit promised.** Cutting it to 60 meant either
   deleting the menu-versus-listbox family table or the layout region vocabulary, and both are
   things an agent looks up rather than reads. I moved every *argument* out and kept every *rule*.
   The self-arguing passages are gone.

2. **The array-prop rule went into `CONVENTIONS.md`, not `DESIGN.md`.** It is a rule about how to
   type a prop, which is that file's charter. `decisions/a-layout-tree-is-children.md` carries the
   reason and the reversal condition, and `CONVENTIONS.md` does not restate them. The taxonomy
   audit's draft was already good; I kept its structure, added the `FieldArray` render prop as the
   sanctioned alternative, and cut its worked examples, which name components that are being
   deleted this week.

3. ~~**I did not ask for a repo-wide `data-slot` reordering.**~~ **Overtaken, and the owner was
   right.** I wrote the narrow rule — a wrapper must not pass a `data-slot` into another component —
   on the reasoning that writing it before the spread is the ordering everywhere including the
   reference implementation, so in most places it is harmless. The census showed *how* everywhere:
   the overwhelming majority of sites, against a single file that had already reversed itself in
   place after being bitten (`simples/combobox.tsx`, `ComboboxTrigger`). At that ratio it is one
   house-style decision, not three bugs, and "harmless in most places" is the wrong test for an
   attribute a caller can delete without an error. The broad rule is now
   `decisions/a-primitive-owns-its-slot.md`; my narrow rule survives inside it as the consequence
   the ordering makes impossible.

4. **`CONVENTIONS.md` no longer prints the recipe.** Twenty-seven lines became a pointer at
   `simples/button.tsx`, on the audit's evidence that no commit has ever fixed a component for not
   following it. If you disagree, the block is in git.

5. **The three standing constraints are in `CLAUDE.md` only, and are not decision records.** They
   are the frame the records are judged against, and constraint 3 would be odd applied to itself.
   `decisions/README.md` says where they live so nobody looks for them here.

6. **One record is `Status: superseded` on purpose.** `field-has-no-consumer.md` is history and
   nothing points at it as a rule. It is there because a format with no superseded record in it
   teaches nobody how to supersede one, and because the argument it lost is the reason
   `adoption-before-design.md` exists.

7. **`.planning/DOCS-QUALITY.md`, `FORMS-DECISION.md` and `LAYOUT-ARK-NATIVE-REVIEW.md` survive**
   as long-form references, with the dangling pointer at `LAYOUT-ARK-NATIVE-REVIEW.md:5` fixed and
   two stale rows in `DOCS-QUALITY.md` corrected in place rather than silently edited. The docs-site
   audit supersedes much of `DOCS-QUALITY.md`; whoever executes Block D should decide whether it
   still earns its lines.

8. **I did not touch `package.json`.** Its description is false (a5) and it was tempting, but it is
   not in my ownership list and two other sessions are editing this tree.
