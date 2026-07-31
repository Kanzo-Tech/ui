---
"@kanzo-tech/palette": major
"@kanzo-tech/theme": major
---

**A tenant publishes several identities, and an identity is a brand seed and nothing else.**

One company, several product lines — a bank's retail blue and its private gold. The brand differs;
the product is still one product. So a document now carries `identities: Identity[]` and a
`defaultIdentity`, where an `Identity` is a brand seed plus everything derived from a brand seed and
nothing more: a brand ramp pair, a categorical set (the chart wheel is spun from the brand's own
hue, so it follows), the 15 tokens that resolve off either of them, and the record rows about that
seed. The neutral, the four statuses and the syntax roles stay the *tenant's*, shared across every
identity — which is what keeps "everything feels like one thing" true. If the neutral varied too, a
tenant with three identities would have three products.

`schemaVersion` goes 2 → 3, with no upgrader: the entire stored v2 population is
`packages/theme/palettes/kanzo.json`, a build artefact.

### What moved, and what did not

`TenantPalette.ramps` is now a `SharedRampSet` over the five ramps that are not a brand, and the
top-level `categorical` is gone. **`RampSet` is unchanged** and still names all six: it is
`resolveRoles`' input, and a resolution always happens against exactly one brand. `roles` still holds
the default identity's whole map, so a single-identity document has exactly the field a v2 one had —
which is what makes `compile` of such a document byte-identical to what it emitted before, banner
version aside. `packages/theme/tokens.css` regenerates as a one-line diff.

A record row goes where its `ramp` tag already said: `brand` rows to the identity, the rest to the
document, and a cross-check row wherever the token it *grades* lives — never the token it is graded
against, since every row measures against `--background` or `--popover` and both are shared. The two
lists concatenate back to the measurement v2 always made.

```ts
derivePalette({
  id: "bank",
  label: "Bank",
  neutral: "#6b7280",
  identities: [
    { id: "retail", label: "Retail", brand: "#2b7fff" },
    { id: "private", label: "Private Bank", brand: "#9810fa" },
  ],
});
```

One input shape and no `brand?: string` shorthand beside it: a second way to say the same thing puts
a branch in the compiler, the record splitter and every panel downstream, for a case a one-element
array already expresses.

### Three refusals, at derive time

**A multi-identity document needs an explicit neutral.** `neutralSeedFor` carries the brand hue into
the neutral when a client gives none, and the neutral is 90% of the pixels — so on a multi-brand
tenant that would tint the whole product with the retail blue and then paint the private gold on top
of it, a decision the client never made, taken in the field where it is hardest to see. Single-
identity documents keep the carry-over exactly as it was, `HueSource: "brand"` included.

**An id has to match `/^[a-z0-9][a-z0-9-]*$/`**, and a `defaultIdentity` has to name one. The id is
interpolated straight into `[data-identity="…"]`, so a document that could not be compiled should not
be derivable — which is also what keeps `compile` a string join with no escaping rules of its own.

### The stylesheet

`:root` and `.dark` are the default identity's, so a tenant with one brand emits what it always did.
Every other identity appends two blocks:

```css
[data-identity="private"] { … }
[data-identity="private"].dark, .dark [data-identity="private"] { … }
```

**The compound member is the one that works.** `.dark` and `data-identity` land on the same element,
`<html>`, so the descendant form alone would never match — the block simply would not apply and the
cascade would fall through to `.dark`, which is a legal palette and the wrong one. It is invisible to
every value-level test, so `compile.test.ts` asserts the selector by name. The descendant member
rides along for a host that puts `.dark` on a wrapper. Both are 0,2,0, so an identity block wins on
specificity rather than on source order.

A block carries the **declared** `IDENTITY_TOKENS` set plus `--chart-capacity`, always all of them,
never a diff against another identity. A diff shrinks when two identities happen to agree — two
brands in one hue family snap to nearly the same wheel — and the shape of the sheet would then depend
on how close a client's two blues are. No `color-scheme`: an identity is a brand, not an appearance.

### New exports

`SHARED_RAMP_NAMES`, `SharedRampName`, `SharedRampSet`, `Identity`, `IdentityInput`,
`IDENTITY_TOKENS` (the 15 brand- and categorical-bound tokens, in table order) and
`isIdentityRole(role)`.
