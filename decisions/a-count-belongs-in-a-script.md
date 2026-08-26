# A count belongs in a script, not in prose

- **Status** live — 2026-07-30
- **Decided** No guidance document carries a measurement. If a number matters, a test prints it or
  asserts it; if no test wants it, it was noise. The same applies to a `file:line` — cite a file
  and a symbol.
- **Because** the export census was written into the root design document as the authoritative
  correction of an earlier wrong count, and three careful independent recounts then produced three different
  answers, each wrong in a different direction. Prose survives; numbers and paths rot.
- **Reversed by** nothing. The recounts disagreed for reasons that generalise: the repository
  carries whole working copies of itself under `.claude/worktrees/`, so a scan that does not
  exclude them reports every symbol as consumed and no export as dead; and an intra-module
  reference join has to key on absolute declaration position, because keying on the name misses
  aliased exports and keying on the line collides with same-line parameters. A count that three
  passes get wrong three ways is a count nobody should retype.
- **Held by** `packages/ui/src/index.test.ts`, which pins the surface it cares about by name;
  `packages/ui/src/lib/token-color.test.ts`, which counts the slots in every shipped theme rather than
  trusting either constant that declares it
