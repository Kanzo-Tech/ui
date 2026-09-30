---
"@kanzo-tech/ui": minor
---

**`SectionRoot` takes `fill`, so sections stack.** A section still fills its region by default. With
`fill={false}` it takes its content's height and its `SectionBody` stops scrolling, so several stack
in one scrolling pane. Replace `flex-none` / `overflow-visible` overrides on stacked sections — or a
plain `<section>` standing in for `SectionRoot` — with `<SectionRoot fill={false}>`.
