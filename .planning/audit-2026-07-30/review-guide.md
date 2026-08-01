# How to review these 93 commits

Two branches are mergeable; five waves are readable. Those are different numbers and the gap
between them is the most useful thing on this page.

## The two merge units — verified, not assumed

| Branch | Commits | Verified |
|---|---|---|
| `ds-review-a-audit-cut-and-docs` (`3c5f1e2`) | 74 | `build`, `typecheck`, `lint`, ui tests |
| `ds-review-b-reference-and-guards` (`cef72a1` = HEAD) | 19 | same, plus `check:generated` and `smoke` |

**Why not five.** The intended split was one branch per theme, then one per wave. Neither survives
contact with the history:

- **Themes cannot split, because the history reverses itself.** `1afc195` restores exactly what
  `83f96e9` removed, and `97878d5` restores what `fbfec90` withheld — 17 files in common. A themed
  branch would show you deletions that a later branch undoes, so you would be approving work that
  no longer represents the outcome. The reversals are not mistakes: they are the decisions the owner
  reopened, and the precedence rule invalidating a sweep of our own.
- **Waves cannot split, because there is no green point to cut at.** The docs build broke at
  `a3a5c98` (the directive sweep, commit 33) and was not repaired until `3c5f1e2` (commit 75).
  **42 commits with a broken RSC build**, and nothing caught it: `pnpm typecheck` and `pnpm test`
  both pass throughout, and the full build only ran at the end.

That second point is the finding. It is the same defect class the whole audit was about — a check
that passes while the thing it stands for is broken — except this time the gap was in *how the work
was verified*, not in the code. **The docs build belongs in the loop, not at the end of it.** It is
the only check that evaluates the client boundary; `smoke` compares bytes and `typecheck` cannot see
a serialisation error at all.

## The five waves, for reading

Reading order, not merge order. Each is a coherent unit of intent.

| Wave | Range | What happened |
|---|---|---|
| 1 · audit and guidance | `476deaf`…`fed5429` | Five parallel audits; `CLAUDE.md` created; `DESIGN.md` 356 → 163 lines; `decisions/` established; 8 planning docs and 57 changesets deleted; the `SidebarInset`/`<main>` falsehood fixed in four places |
| 2 · the cut | `a3a5c98`…`f4c2fe3` | 18 deletions and 2 relocations; the export sweep; the `slot` conversion across 428 elements; `AlertDialogAction` fixed; the font axis fixed |
| 3 · comments and accessibility | `9bbae6d`…`33c177c` | Comment truth sweep in palette and theme; ten keyboard contracts read out of the machines; the RSC break found and fixed; the browser findings |
| 4 · the reference wins | `a0855fe`…`4f5c2dd` | The alias reversal; the precedence rule; three new guards and six hardened |
| 5 · parity | `97878d5`…`cef72a1` | The 38 restorations; `SkipNav` adopted; part naming settled; `Steps` closed |

## What to look at, and what you can skip

**Look at:**

- `CLAUDE.md`, `DESIGN.md`, `CONVENTIONS.md` — the rules an agent reads first. Short by design.
- `decisions/` — 32 records. The ones carrying real arguments: `a-measurement-overrules-the-reference`,
  `a-name-shark-ships-is-ours`, `a-primitive-owns-its-slot`, `a-house-principle-withholds-no-name`.
- The delete list in wave 2, if you want to second-guess any cut.
- `.planning/audit-2026-07-30/open-browser-findings.md` — three wrong hypotheses and what killed each.

**Skip unless something looks off:** the handoff files (records of a moment, not rules), the
mechanical half of the `slot` conversion, and the comment corrections in `packages/palette`.

## What is still open

- **The rebase** — 18 commits behind `ds-ai-and-shark-alignment`, 15 of them touching `docs/`. It is
  the trigger for the `layout/` re-cut and for `prose-that-is-hashed-is-data`.
- **`pnpm size`** — the `analytics` subpath is over by ~6 kB. Verified byte-identical at `e210a59`,
  so it predates all of this.
- **`packages/palette` tests are flaky under CPU load.** Diagnosed, reproducible with
  `taskpolicy -b npx vitest run`; the fix is the other session's call.
- **20 parity items**, pinned so none can appear or close without a reviewed edit.
- **The Zag report** on `Steps`, drafted and not filed — filing it is yours.
