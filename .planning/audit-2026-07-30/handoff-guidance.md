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
| a1 | `packages/ui/src/simples/alert-dialog.tsx:76-80` | **`AlertDialogAction` does not close the dialog.** It types itself `React.ComponentProps<typeof DialogClose>` and renders a plain `<Button variant={variant} {...rest} />`. The type promises the close behaviour and the body does not deliver it. Confirmed by reading both. |
| a2 | `packages/theme/themes.css` | **The font axis does not move headings.** `--font-heading` is consumed at `simples/card.tsx:113`, `simples/alert.tsx:85`, `simples/dialog.tsx:295` and `composites/Preferences.tsx:179`, and `tokens.css:134` declares it as a self-referencing fallback — but `themes.css` contains zero occurrences of `font-heading`, so no `[data-font]` rule ever sets it. Changing the font axis leaves every heading on the fallback. |
| a3 | `packages/ui/src/simples/progress.tsx:54` | **`ProgressTrack` is exported and rendered unconditionally by its own root** (`<ProgressTrack><ProgressRange /></ProgressTrack>` inside `Progress`). A consumer who follows the export gets two troughs. Delete the export, keep the symbol. Corrects `DESIGN.md`'s old "ideal case" framing; recorded in `decisions/an-export-needs-a-second-call-site.md`. |
| a4 | `packages/ui/src/charts/chart-inputs.tsx:565`, `:402`, `:580` | **A `data-slot` passed down into another component erases that component's own slot.** `<Field … data-slot="chart-search" {...rest}>` arrives in `Field`'s rest spread and overwrites `data-slot="field"`, breaking every recipe selecting `[data-slot=field]`. The rule is now written at `CONVENTIONS.md`, "Structure and props"; the sites are not mine. |
| a4b | `packages/ui/src/charts/chart-inputs.tsx:523` | **A raw NUL byte, at byte offset 19443.** Confirmed: `file` reports the source as `data`, not text, so `grep` skips it silently unless forced with `-a`. It excluded the largest chart file from several of the auditors' own searches. |

### False claims a reader will act on

| # | Where | What |
|---|---|---|
| a5 | `package.json:5` | Root description: *"shared **Radix Themes** primitives & shells"*. Nothing in the tree uses Radix. Flagged in `.planning` eight days before the audit and still there. |
| a6 | `packages/ui/package.json:4` | Description still speaks of "Level 1 primitives" and "Level 2 shells", a vocabulary neither governing document has used since the layers were renamed. |
| a7 | `packages/ui/src/index.tsx:3` and `:82`, `eslint.config.js:30` | **"Vendored as-is" / "byte-faithful".** The most dangerous stale comment in the repo: it invites exactly the regression the solid-focus-ring measurement exists to prevent, since the rings *deliberately* diverge from Shark. Say "vendored, with declared divergences" and name where they are declared. |
| a8 | `packages/ui/src/layouts/shell.tsx:12` | Cites `docs/blocks/`, which does not exist — the directory is `docs/showcases/`, renamed in `c6cad41`. |
| a9 | `docs/content/docs/navigation/sidebar.mdx:41`, `docs/content/docs/(root)/styling.mdx:102`, and the example pages the docs audit lists | The `SidebarInset` / `<main>` claim. Both governing documents now say the opposite, correctly; the docs copies are another agent's. (Several of these files were being edited concurrently while I worked — check before applying.) |
| a10 | `scripts/smoke-install.mjs:71` | The leak guard checks for `EditorShell` and `GhostEditor`, two symbols that no longer exist. It is guarding nothing. The symbols to guard are the current `/editor` exports. |

### Tests worth writing

| # | What | Why |
|---|---|---|
| a11 | **A `data-slot` guard.** | Three rounds of omission, one regression, a written rule, and no enforcement. `decisions/a-rule-broken-three-times-becomes-a-test.md` names it as the next one. It should also catch a4's shape: a `data-slot` reaching another component's props. |
| a12 | **A dead-name guard over the guidance tree.** | Grep `CLAUDE.md`, `DESIGN.md`, `CONVENTIONS.md`, `decisions/*.md`, `docs/CLAUDE.md` and every `README.md` for backticked identifiers, and fail when one resolves to no export, file or token. This is the mechanism that stops the whole class of defect the audit found. `packages/theme/src/boundary.test.ts` is the template: forty lines, with the reason beside the assertion. |
| a13 | **Record integrity.** | Every `Held by` path in `decisions/` exists; every `Status: superseded by <slug>` resolves; no `Because` line contains a digit. I verified all three by hand today; nothing keeps them true. |
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

8. **`llms.txt` baking in the build host — not reproduced.** `docs/app/llms.txt/route.ts:25` derives
   the origin from the incoming request (`new URL(request.url).origin`). It may still resolve to the
   build host under a static export, but I could not confirm that without running a build, which I
   was told not to do. Treat the finding as unverified.

9. **The changeset count was 62 in the audit and is 57 here.** The difference is the parallel
   session's in-flight files, which are in the main checkout and not on this branch. `.changeset/`
   now holds `config.json`, `README.md` and one changeset. **If the in-flight session adds its
   changesets back on merge, they will need the same treatment**, including the two that litigate
   the appearance axis against each other.

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

3. **I did not ask for a repo-wide `data-slot` reordering.** The taxonomy audit frames the bug as
   `data-slot` written before `{...rest}`, but that is the ordering in every component including
   the reference implementation, and in most of them it is harmless. The rule I wrote is narrower
   and, I think, the true one: a wrapper must not pass a `data-slot` *into another component*. If
   you want the broader rule instead, it is a real change to `simples/button.tsx` and everything
   shaped like it.

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
