---
"@kanzo-tech/theme": patch
---

Reconcile the default dark `neutral` tokens with the canonical generated values (Shark's exact
math), so the shipped default equals `data-base="neutral"` and the "Copy theme CSS" export.
Tokenise the editor gutter (`--kanzo-gutter-bg` / `--kanzo-gutter-foreground`, replacing a
hand-tuned magic mix) and lighten the dark-mode syntax comment colour for legibility.
