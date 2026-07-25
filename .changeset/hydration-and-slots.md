---
"@kanzo-tech/ui": patch
---

**`AppearanceToggle` no longer breaks hydration, and `ComboboxTrigger` keeps its own `data-slot`.**

The resolved appearance is only knowable in the browser — localStorage, a cookie, `matchMedia` —
so the server emitted `light`, the client hydrated `dark`, and React reported a mismatch it does
not patch up. The state-bearing attributes (`aria-pressed`, `data-appearance`, `title`) are now
withheld until mount. This costs no flash: what paints is the sun/moon crossfade, keyed off `.dark`
in CSS, which `themeScript` sets on `<html>` before the first paint. That script is **not optional
for an SSR host**, and the docs app was not injecting it — now it does, and a test hydrates a
dark-themed host to keep it that way.

`ComboboxTrigger` spread `{...rest}` *after* its own `data-slot`, so composing it inside an
`InputGroupButton asChild` let the merge inject the wrapper's slot over ours and
`data-slot=combobox-trigger` matched nothing in the DOM — an escape hatch we tell consumers to rely
on instead of guessing class names. `ComboboxClear` already ordered it the other way, so the pair
was inconsistent with itself.
