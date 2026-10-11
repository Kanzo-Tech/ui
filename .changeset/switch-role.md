---
"@kanzo-tech/ui": patch
---

**`Switch` is a switch to assistive technology.** Ark renders a native `input type="checkbox"` and left
it at its implicit role, so an on/off setting — every toggle in `Preferences`, the graph's *Vignette*
and *Dot grid* among them — reached the accessibility tree as a checkbox. It now carries
`role="switch"`, the WAI-ARIA APG Switch pattern, which ARIA in HTML allows on a checkbox input; the
state is still the native `checked`.

**What to change:** a test or harness that found a `Switch` by `role: "checkbox"` finds it by
`role: "switch"` (Testing Library's `getByRole("switch", { name, checked })` reads the same state).
`Checkbox` is unchanged.
