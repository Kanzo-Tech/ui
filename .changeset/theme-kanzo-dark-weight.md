---
"@kanzo-tech/theme": patch
---

`kanzo-dark` carries its brand at the weight `kanzo` does: `--primary` and `--ring` are `#5cb572` rather than the neon `#1ae973`, and the first chart series `--chart-1` is the brand's green `#52b770` rather than the lime `#64c600`. The neon stays as `--success`, as in the light theme. Buttons, focus rings and the first series of every chart on a dark Kanzo page are calmer; a host that matched the old neon in its own CSS should read `var(--primary)` instead.
