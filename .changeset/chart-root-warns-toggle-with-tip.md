---
"@kanzo-tech/ui": patch
---

`ChartRoot` now warns in development when a `ChartToggleX`, `ChartToggleY` or `ChartToggleColor` shares a plot with a mark that has `tip`. The tooltip catches the click before the toggle does, so nothing gets picked, filtered or highlighted. Remove `tip` from any plot that has a toggle.
