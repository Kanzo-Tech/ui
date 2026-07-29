---
"@kanzo-tech/ui": patch
---

**`ItemTitle` is a flex row again; clamping is opt-in.** It asked for two `display` values at once
— `flex` for the row and `line-clamp-1` for the truncation — so tailwind-merge kept the clamp and
dropped the `flex`, and with it the `gap-2`. Every title with more than one child rendered them
flush together. The clamp is gone; a title whose text is genuinely unbounded takes
`className="line-clamp-1"` at the call site, trading the row for the clamp deliberately.
