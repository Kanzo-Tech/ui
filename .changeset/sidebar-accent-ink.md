---
"@kanzo-tech/theme": patch
---

**The active and hovered items of a `Sidebar` take the page ink again.** `text-sidebar-accent-foreground`
read `--accent-foreground`, which no shipped theme authors, and resolved to nothing, so those items
kept the dimmer `--sidebar-foreground`. It now falls back to `--foreground`, as
`text-accent-foreground` already did. A theme that authors `--accent-foreground` still wins.
