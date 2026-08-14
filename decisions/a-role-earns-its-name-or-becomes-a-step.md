# A role earns its name, or it is a step wearing one

- **Status** live — 2026-08-13
- **Decided** A colour role exists only if it carries a **measured property** a step index cannot
  express — `fill`, `on-fill`, `boundary`, `quietest-ink`, `recess` — or is a name **Shark's recipes
  paste in verbatim**. Seventeen level-names failed both tests and are gone: `--secondary-wash`,
  `--accent-wash`, the twelve status tints (`-wash`, `-wash-strong`, `-border` across destructive,
  warning, success and info), `--selection`, `--match` and `--match-active`. Each call site spells
  the reference step instead.
- **Because** every one of them was a pure `alpha` binding, and the reference layer publishes that
  binding under a name of its own. Measured across all six shipped documents and both modes, each
  retired token was byte-identical to the step it named in every block, so the sheet was carrying two
  spellings of one value and asking a reader to learn which. A second vocabulary for one level is the
  defect the role table was built to remove, and it had grown one back.
- **Reversed by** a level that stops being expressible as a step — a wash that had to composite
  against something the reference layer does not publish, or a tenant whose document made one of the
  seventeen differ from its step in any block. Neither exists: `compile.test.ts` re-measures all
  seventeen against the schema-v2 fixture on every run, and a divergence fails there first.
- **Held by** `packages/palette/src/compile.test.ts`, "compiles a single-identity document to the
  bytes v2 compiled it to", which pins each of the seventeen to the step that replaced it;
  `packages/palette/src/roles.ts`, `ROLES`

The admission rule is mechanical on purpose, and that is what makes it hold. A binding is `step` or
`alpha` in the source, so "is this a level with a noun on top?" is a property of the table rather
than a matter of taste — the same shape as the rule that keeps `--editor-active-line` out.

**What was lost, said plainly: readability at the call site.** `bg-accent-wash` announced its
intent, and the step it became does not. That is the real cost and it was paid deliberately, because
the alternative was two names for one colour, and this system has already measured what that costs —
`--muted`, `--secondary` and `--accent` were byte-identical for exactly that reason before the ramp
separated them.

**`--field` and the four `-content` inks stayed**, and they are the rule working rather than an
exception to it. `--field` is a `recess`: the alpha step *if it recedes*, else the page, because in
dark every alpha step composites lighter than its ground. `-content` is `on-fill`. Neither is a level.

**Nothing moved under identity switching**, which was the one real risk. `--selection` was an
identity token — it followed the brand — and `--brand-a5` is in the identity block too, so a
sub-brand's selection wash re-points exactly as it did. `IDENTITY_TOKENS` went from 15 to 14 and the
emitted identity block is unchanged in what it can express.
