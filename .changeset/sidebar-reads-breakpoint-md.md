---
"@kanzo-tech/ui": patch
---

The sidebar turns into its mobile sheet below your theme's `md` breakpoint (`--breakpoint-md`), not
below a fixed 768px, so a host that moves `md` in its `@theme` moves the sidebar with its `md:` classes.
