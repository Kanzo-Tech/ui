---
"@kanzo-tech/ui": minor
---

**One Ark machine had two components in front of it, told apart by a single capital letter — `FieldSet` and `Fieldset`. `fieldset.tsx` is deleted; the two parts it owned that were not duplicates moved into the `Field*` family as `FieldSetHelper` and `FieldSetError`.**

`field.tsx` exported `FieldSet` / `FieldLegend` over `Fieldset.Root` / `Fieldset.Legend`; `fieldset.tsx` exported `Fieldset` / `FieldsetLegend` over the *same two Ark parts*, with near-identical Tailwind and adjacent lines on the root barrel. Six consumers used the `FieldSet` spelling, one used the other, and two doc pages taught the same Ark part in almost the same sentences — a reader landing on `/docs/forms/fieldset` had no way to tell they were not on `/docs/forms/field`. `FieldLegend` also carries `variant="legend" | "label"`, and `FieldsetLegend`'s only styling — `mb-3 font-medium text-sm leading-snug` — is exactly what `variant="label"` already renders, so the second component was a hard-coded special case of the first.

What was **not** duplication is the reason this is a fold rather than a deletion. `FieldsetHelperText` / `FieldsetErrorText` wrap `Fieldset.HelperText` / `Fieldset.ErrorText`, which are the *fieldset* machine's message parts: their ids land in the `<fieldset>`'s own `aria-describedby`, so they are announced for the group. `FieldHelper` / `FieldError` wrap the *field* machine's, wired into one control's `aria-describedby`. Identical typography, different scope, and `field.tsx` had no group-scoped message at all — so they survive as **`FieldSetHelper`** and **`FieldSetError`**, named off `FieldSet` the way `FieldHelper` / `FieldError` are named off `Field`, with slots `field-set-helper` / `field-set-error` matching the existing `field-set`. `FieldSetError` still renders only while its root is `invalid`, so it can sit in the tree unconditionally like `FieldError` does.

`useFieldset` goes with the file. It re-exported Ark's `useFieldsetContext` and had no consumer, in the repo or in the docs; the context it hands back is the fieldset machine's internals, which is not a public surface we have any use for yet. **No back-compat aliases** for any of the removed names — the package is unpublished, so a clean break costs nothing and an alias would be permanent noise.

One class moved with the merge: `FieldSet` now carries `data-invalid:text-destructive` (and its dark counterpart), which `Fieldset` had and `FieldSet` did not. `Field` already tints itself that way, so a group root that accepts `invalid` and showed nothing for it was the odd one out. No existing consumer passes `invalid` to a `FieldSet`, so nothing on screen changes today.

Two things the tests pinned down, and the second corrects the page that was deleted:

- **`disabled` cascades from a `FieldSet` to the `Field`s inside it.** Half of that is the platform — a real `<fieldset disabled>` disables its controls — and half is Ark: `useField` defaults `disabled` to `Boolean(fieldset?.disabled)`.
- **`invalid` does not cascade.** `useField` defaults it to plain `false` with no fieldset fallback, so an invalid set marks itself, reveals `FieldSetError` and tints its own text, while every `Field` inside keeps its own validity. The old fieldset page claimed both props "cascade to every `Field` inside it", which was true of one of them. Group-level and field-level validity are separate claims and the docs now say so.

This supersedes one line of an earlier unreleased changeset: the Ark-expansion batch counted `Fieldset` among ten new primitives, without noticing that `field.tsx` had wrapped the same two Ark parts since before it. Nothing shipped in between, so the net effect of the two changesets together is that `FieldSet` gained the group-scoped messages it was missing.

Docs follow the components: `/docs/forms/fieldset` is gone and its material is a **Field set** section on `/docs/forms/field`, the page that already taught `FieldSet`; `docs/examples/fieldset/example-default.tsx` is rewritten against the surviving API as `docs/examples/field/example-field-set-messages.tsx`, next to the `example-field-set` that page already previews. One directory per component page, and `fieldset` is no longer a component page.
