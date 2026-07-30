# Match the reference; do not invent

- **Status** live — 2026-07-22
- **Decided** Before changing a token, a recipe or a convention that came from Shark UI, read
  Shark's source — `gh api "repos/vinihvc/shark-ui/contents/<path>" --jq '.content' | base64 -d`.
  Docs sites go stale; the repo does not.
- **Because** an audit called the status tokens self-contradictory, `--destructive-foreground` was
  renamed to an invented `--destructive-emphasis`, and Shark turned out to define the identical
  pair and use the second as a background. Fully reverted. Fixing a defect that is an upstream
  convention forks the library for nothing.
- **Reversed by** a divergence we can measure and Shark cannot answer — which has happened once
  and is recorded: the solid focus ring, kept against Shark's diluted one on a contrast
  measurement.
- **Held by** `CONVENTIONS.md`, the `-foreground` rule; `packages/ui/src/alpha-steps.test.ts`,
  the ring ban and the measurement that justifies the divergence
