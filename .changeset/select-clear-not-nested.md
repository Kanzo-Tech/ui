---
"@kanzo-tech/ui": patch
---

**`SelectTrigger showClear` no longer renders a `<button>` inside a `<button>`.**

Shark UI puts `Select.ClearTrigger` *inside* `Select.Trigger`, and we vendored that verbatim. It is
invalid HTML, and the cost was larger than a console warning: React logged `validateDOMNesting` and
then **failed hydration for the whole subtree** ("this tree will be regenerated on the client") on
any SSR host. The nested button was not predictably reachable by keyboard or screen reader, and its
click bubbled into the trigger — so clearing the value also opened the listbox.

Ark's anatomy is `Select.Control > Select.Trigger + Select.ClearTrigger`, the clear being a
sibling, and that is what we render now. **Declared divergence from Shark**, commented in the file.

No API change: `<SelectTrigger showClear>` is unchanged, and the result is pixel-identical — the
indicator group reserves the clear's room only while the clear is visible (Ark marks it `hidden`
otherwise) and the clear is pulled back over that room with logical margins that net to zero
intrinsic width, so shrink-to-fit parents and RTL are unaffected. Verified by measuring both
states, not by eye.

`Select` and `Combobox` had no tests at all; both now have them, including one that pins the
absence of nested buttons. `Combobox` turned out to be fine — its `asChild` chain collapses through
Ark's `cloneElement`, so only one button ever reaches the DOM.
