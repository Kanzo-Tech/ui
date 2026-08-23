# A type and a component may not share a name across two barrels

- **Status** live — 2026-08-23
- **Decided** `@kanzo-tech/ai`'s `Suggestion` type is renamed to `Candidate`. `@kanzo-tech/ui`'s
  `Suggestion` **component** keeps the name, because it is the one Shark ships. No alias, no
  deprecation: nothing has been published.
- **Because** the two were in scope in the same file and one of them could not be written. Both sit
  on public barrels, `packages/ai/src/suggest.tsx` draws the component while typing its data with
  the type, and it was importing its **own package's** type under an alias to do it. An import that
  has to rename a symbol to be usable is the collision announcing itself, and the alias was the
  workaround rather than the answer. A consumer hits the same wall the first time they write both
  imports, with no file of ours to look at for the local name that got chosen here.
  `CONVENTIONS.md` asks which of two colliding names the reference governs: Shark ships
  `Suggestion` as a component, so that half is not ours to move, and the type is.
- **Reversed by** Shark shipping a `Suggestion` type of its own, which would make `Candidate` a
  divergence from the reference rather than a way of keeping it — or the component leaving `ui`, at
  which point the collision is gone and the shorter name is free again.
- **Held by** `packages/ai/src/types.ts`, `Candidate`; `packages/ai/src/suggest.tsx`, the import
  that no longer aliases

## What the alias was hiding

`import type { Suggestion as Candidate } from "./types.js"` sat three lines under
`import { …, Suggestion, Suggestions } from "@kanzo-tech/ui"`. It compiled, it was correct, and it
had already chosen the better name — `Candidate` is what the rest of that file calls the value, and
what `SuggestList` calls it in its own prose. The rename does not invent a word; it promotes the one
the code was already using in private.

The count, so the next collision is recognised earlier: the type appeared in seven source files and
seven documentation files, and in two showcases that consume it as a published type. None of that
is difficult, and all of it is invisible until somebody writes both imports at once.
