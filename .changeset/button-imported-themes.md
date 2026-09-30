---
"@kanzo-tech/ui": patch
---

**`Button variant="outline"` draws its border in `--input`, and `variant="secondary"` its text in
`--secondary-foreground`, under every theme.** Themes that leave those two out — the thirteen
imported from daisyUI for the first, the sixteen hand-written ones for the second — got a border in
the text colour and an ink inherited from the parent. Both now fall back the way `border-input` and
`text-secondary-foreground` do: to `--border` and `--foreground`.
