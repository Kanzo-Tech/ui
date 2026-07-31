# Kanzo UI — read this first

## Three standing constraints

1. **No legacy, no backwards compatibility, no deprecation shims.** Every package is `0.0.0` and
   there are no tags; nothing has ever been published. Rename and delete outright — an alias is
   permanent and a clean rename is free. A document that hedges on compatibility is wrong.
2. **Minimal and generic.** The fundamental pieces to grow from, not a catalogue of conveniences.
   **Before adding a way to express something, grep for the ways it is already expressed.** Nine
   commits here collapse two or three implementations of one idea; it is the most common commit in
   the repository.
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
  summary of it** — each carries its own reasoning, and each says what it cannot prove:
  `packages/ui/src/alpha-steps.test.ts` (seven banned token spellings), `no-literal-hues.test.ts`,
  `logical-properties.test.ts`, `client-boundary.test.ts`, `data-slot.test.tsx`, `index.test.ts`
  (the pinned surface and the tombstones), and `packages/theme/src/boundary.test.ts`.

## Four one-way doors

- **Optional peers never enter the root barrel.** `/editor`, `/table` and `/analytics` exist for
  that. A static import of an optional peer from `index.tsx` breaks `import { Button }` for
  everyone who did not install it.
- **Theme attributes go on `<html>`.** Ark's overlays portal to `document.body`, outside any
  wrapper, and density sets the root font-size the whole `rem` scale resolves against.
- **`@kanzo-tech/palette` is authoring-time.** It is a devDependency of `@kanzo-tech/theme`, and
  `packages/theme/src/boundary.test.ts` fails if that moves.
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
- Do not hand-edit generated files. `check:generated` regenerates `palette-data.json`,
  `themes.css`, `theme-data.json`, `palettes/` and the colour half of `tokens.css`, and fails on a
  diff.
- One changeset per change, addressed to a consumer. The *reason* goes in `decisions/`.
- Other sessions write to this checkout, and `.claude/worktrees/` holds further full copies of the
  repository. Attribute a stray edit before acting on it, commit by explicit path, and exclude
  those worktrees from any repo-wide count.
