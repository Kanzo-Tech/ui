---
"@kanzo-tech/ui": patch
---

**The arrows on `Popover`, `HoverCard` and `Menu`, and the tooltip box on charts, are filled under
every theme.** They read `--popover` directly, which only the eight hand-written dark themes
author, so under every other theme they were transparent. They now fall back to `--card` exactly
as `bg-popover` does.
