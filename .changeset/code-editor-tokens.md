---
"@kanzo-tech/ui": patch
---

**`CodeEditor` paints its selection, search hits, matching brackets and word matches again.** They
read colours the theme no longer publishes and drew nothing, so a selection was invisible and a
search showed no hits. They are now tints of `--primary`, `--warning`, `--destructive` and
`--foreground`. Under themes that do not author `--popover`, `--input`, `--faint` or
`--secondary-foreground`, the autocomplete popup, the go-to-line field, comments and the gutter
now fall back to the same colours the rest of the library uses instead of rendering transparent
or in the inherited ink. The editor's font sizes no longer carry their own fallback: they follow
`--kanzo-font-size-base` and `--kanzo-font-size-small` exactly.
