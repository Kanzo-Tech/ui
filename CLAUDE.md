# Kanzo UI — read this first

## Three standing constraints

1. **No legacy, no backwards compatibility, no deprecation shims.** Every package is `0.0.0` and
   there are no tags; nothing has ever been published. Rename and delete outright — an alias is
   permanent and a clean rename is free. A document that hedges on compatibility is wrong.
2. **Minimal and generic.** The fundamental pieces to grow from, not a catalogue of conveniences.
   **Before adding a way to express something, grep for the ways it is already expressed.**
   Collapsing two or three implementations of one idea is among the most common commits here —
   `git log --oneline` and read the subjects if you want the shape of it.
3. **Any decision may be reopened.** They live in `decisions/`, one file each, each carrying the
   evidence that would reverse it. Reopening is editing a field, not winning an argument again.

## Where the rules are

- `DESIGN.md` — what the system is: the axes, the layers, the engine and naming rules, admission,
  the taxonomy tests, and the index of decisions.
- `CONVENTIONS.md` — how to write a file: the reference and what overrules it, the recipe, tokens,
  props, the client boundary, naming, comments, tests.
- `decisions/` — one record per decision. `Status` `live` is today's rule; anything else is
  history, and you can skip it.
- The repo-wide guard tests are the rules nobody should have to remember. **Read the file, not a
  summary of it** — each carries its own reasoning, and each says what it cannot prove.
  `packages/ui/src/guard-corpus.ts` is what "repo-wide" means: the six appearance and boundary
  guards scan every package that declares `tailwind-variants` (`ui` and `ai` today) and report
  `<package>/<path under src>`. Widen that corpus; never copy a guard into a second package.
  `packages/ui/src/alpha-steps.test.ts` (seven banned token spellings), `no-literal-hues.test.ts`,
  `logical-properties.test.ts`, `client-boundary.test.ts`, `data-slot.test.tsx`,
  `list-semantics.test.ts`, `codemirror-dark-parity.test.ts`, `index.test.ts`
  (the pinned surface and the tombstones), `documented-exports.test.ts` (a page may not claim a
  symbol we do not export), `shark-parity.test.ts` (every difference from the reference is
  declared), `decisions.test.ts`, and `packages/theme/src/{boundary,palettes}.test.ts`.
  `CONVENTIONS.md` has the table and the three things a guard owes.

## Four one-way doors

- **Optional peers never enter the root barrel.** `/editor`, `/table` and `/analytics` exist for
  that. A static import of an optional peer from `index.tsx` breaks `import { Button }` for
  everyone who did not install it.
- **Theme attributes go on `<html>`.** Ark's overlays portal to `document.body`, outside any
  wrapper, and density sets the root font-size the whole `rem` scale resolves against.
- **A theme is source, not output.** `packages/theme/themes/*.css` and `tokens.css` are hand-written; only `themes.css` and `theme-data.json` are generated. There is no colour derivation — see `decisions/a-theme-is-one-flat-block.md`.
- **Exactly one `<main>` per page**, owned by `ShellMain`. `SidebarInset` is a neutral `<div>`.

## Working here

- **Build before typechecking.** Packages typecheck against each other's emitted `.d.ts`, so
  `pnpm typecheck` on a clean tree cannot resolve `@kanzo-tech/theme` at all. `docs/` consumes
  `dist/` for the same reason: a rename typechecks clean while the docs build fails.
- Before calling work done, in this order: `pnpm build`, `typecheck`, `lint`, `check:generated`,
  `test`, `size`, `smoke`, then `pnpm --filter @kanzo-tech/docs build`. `smoke` packs the real
  tarballs and installs them without the optional peers, which is the only check that sees the
  built artefact rather than the source. The docs build is the RSC fixture, and the only thing that
  *evaluates* the client boundary — Vite ignores the directive entirely, and `smoke` can only
  compare bytes.
  - **`size` is green, and was red for a long time before it was.** The analytics subpath sat over
    the 60 kB limit set in `5a0c880`; `eb63d16` rebaselined it to 68 kB once the theme context left
    the provider, and it measures 66.24 kB. Every step now passes on a clean tree, so treat any
    failure as yours. What you owe on this one is that your change did not make it worse — note the
    figure before and after, and raise the limit only as a decision, never quietly.
- Do not hand-edit generated files. `check:generated` regenerates `palette-data.json`,
  `themes.css`, `theme-data.json`, `palettes/` and the colour half of `tokens.css`, and fails on a
  diff.
- **Until the first publish there is one changeset**, and it describes what the packages are — see
  `decisions/one-changeset-until-the-first-publish.md`. Add to it rather than adding a second. The
  per-change rule, addressed to a consumer, resumes after that. The *reason* goes in `decisions/`.
- Other sessions write to this checkout, and `.claude/worktrees/` holds further full copies of the
  repository. Attribute a stray edit before acting on it, commit by explicit path, and exclude
  those worktrees from any repo-wide count.
