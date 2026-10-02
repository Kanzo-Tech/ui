---
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

Density is always the person's, and it follows the browser's font size.

- A tenant's `policy.theme.density` may set `default`, but `pinned` and `hidden` are now ignored: the
  density control always draws and a stored choice always applies. Both `KanzoThemeProvider` and
  `themeScript()` behave this way. The declaration carries it as `personal: true`, a new optional
  field on any preference declaration with the same meaning for a contributed section.
- The density steps are `87.5%`, `100%` and `112.5%` of the browser's font size, which used to be
  `14px`, `16px` and `18px`. A person who enlarged their browser keeps the enlargement at every step,
  and nothing changes at the browser's default of 16px. `themeData.densities` holds the percentages.

What to do: remove any `pinned` or `hidden` you set on density. If you read `themeData.densities` as
pixels, multiply the percentage by the browser's size (16px by default).
