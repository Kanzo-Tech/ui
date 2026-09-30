---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**A theme's relief knob is `--relief`, no longer `--depth`.** Ark's tree views set `--depth` on
every item to its nesting level, so a `Button` inside a nested tree view took the tree's depth as
its relief and gained a shadow per level. Rename the declaration in any theme you author:

```css
/* before */
--depth: 0;
/* after */
--relief: 0;
```

The value and its meaning (`0`–`1`, multiplied into a button's shadow and edge) are unchanged.
