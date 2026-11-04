---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": patch
---

Four surfaces are quieter.

- **Stat**: `StatIndicator` is a plain muted icon, with no tinted circle behind it, and `StatValue`
  uses tabular figures. `StatRoot` no longer takes `variant` — it only coloured the indicator — so
  delete `variant=` from your `StatRoot`s; for good or bad news use `StatDelta`, and for a status
  that is not a change put a `Badge` beside the figure.
- **Eyebrow** is in normal case with no letter spacing, so it shows your text as you wrote it. That
  includes the headings in `Preferences` and the *Parameters* / *Result* / *Error* labels in
  `@kanzo-tech/ai`'s `Tool`.
- **Diagnostic** cards are neutral — card background and the plain border — whatever the `variant`.
  The severity colour stays on the icon and the badge.
- **Gated** no longer fades its content, so the text inside keeps its contrast. `GatedBadge` draws a
  lock before your label and is `Badge`'s `sm` size instead of `xs`.
