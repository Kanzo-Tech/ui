---
"@kanzo-tech/palette": major
"@kanzo-tech/ui": major
---

**Appearance becomes a class on the element that carries the theme, never on an ancestor — which is
what makes a light preview inside a dark page possible.**

`KanzoTheme` shipped without an `appearance` prop, and the reason given was that forcing *light*
inside a dark page could not work: `compile` emitted `.dark [data-palette="x"]` as a descendant, so
a scope carrying `.light` tied with it at (0,2,0) and the winner came down to emit order. That was a
correct diagnosis of a defect one layer down, and the fix belongs there.

The descendant member is gone. Every appearance selector now names the element itself:

| element carries | light block | dark block | wins |
|---|---|---|---|
| `<html>` + attr | `…:root` (0,2,0) | — | light |
| `<html>` + attr + `.dark` | `…:root` (0,2,0) | `….dark:root` (0,3,0) | dark |
| div + attr | `…` (0,1,0) | — | light |
| div + attr + `.dark` | `…` (0,1,0) | `….dark` (0,2,0) | dark |
| div + attr + `.light`, inside `.dark` | `….light` (0,2,0) | *no match* | **light** |

No pair is tied, so nothing depends on emit order. It is Radix Themes' rule, and it **costs no
bytes**: `.light` joins the selector list the light block already has rather than duplicating it.

- `KanzoTheme` gains `appearance`, and **always writes the resolved class** — a scope naming a
  palette but leaving the side to inheritance would match its document's light block on a dark page.
- `styles.css`'s dark variant becomes `&:is(.dark, .dark *:not(.light, .light *))`, so Tailwind's
  `dark:` utilities agree with the tokens inside a scoped preview. Without it a light preview would
  be light surfaces with `dark:bg-field` decisions on top. Three levels of alternation resolve the
  innermost wrapper but not its descendants — "nearest ancestor wins" is not expressible in a CSS
  selector, and Radix and daisyUI have the same bound. Two levels is exact.

Verified in the browser against a dark page, reading computed values: a scoped
`[data-palette="dracula"].light` resolves `--background` to `#f9fafb` while `<html>` stays `#0a0a0a`,
and the default document forced light gives `#fafafa`.

**The contract this asks of a caller**, confirmed by the same probe: whatever sets `data-palette`
must also set the appearance class. A bare attribute on a div inside a dark page renders that
document's *light* half. `KanzoTheme` upholds it; hand-written attributes must too.
