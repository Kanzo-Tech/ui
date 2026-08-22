# Match the reference; do not invent

- **Status** live — 2026-07-22
- **Decided** Before changing a token, a recipe or a convention that came from Shark UI, read
  Shark's source — `gh api "repos/sharkui-inc/shark-ui/contents/<path>" --jq '.content' | base64 -d`.
  Docs sites go stale; the repo does not. (`vinihvc/shark-ui` was the old owner and still redirects,
  which is why the wrong name went unnoticed. `sharkui-inc` is the one to write.)
- **Because** an audit called the status tokens self-contradictory, `--destructive-foreground` was
  renamed to an invented `--destructive-emphasis`, and Shark turned out to define the identical
  pair and use the second as a background. Fully reverted. Fixing a defect that is an upstream
  convention forks the library for nothing.
- **Reversed by** a divergence we can measure and Shark cannot answer — which has happened once
  and is recorded: the solid focus ring, kept against Shark's diluted one on a contrast
  measurement. That clause is now general, and says what a measurement is and what it is not:
  `decisions/a-measurement-overrules-the-reference.md`.
- **Held by** `CONVENTIONS.md`, the `-foreground` rule; `packages/ui/src/simples/button.tsx`, `buttonVariants`,
  which carries the solid focus ring and the measurement that justifies the divergence
