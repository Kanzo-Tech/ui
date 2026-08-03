---
"@kanzo-tech/palette": major
"@kanzo-tech/theme": major
---

**The reference layer is published: the ramps no longer die inside `resolveRoles`.**

The 12-step ramps were derived, measured and obliged — and then nothing downstream could name a
step. Measured before this change:

```
grep -cE '^\s+--(neutral|brand|destructive|warning|success|info)-[0-9]+:' tokens.css   → 0
```

Every reference system publishes a tier under its semantic one: Radix Themes ships
`--accent-1..12` plus `--accent-a1..12` under 13 aliases; Material 3 ships `md.ref.palette.*` under
45 system roles and `md.comp.*` over them; Panda splits `tokens` from `semanticTokens`. This system
had **one** tier, and that is why the role table grew: with no step to point at, every new need
became a new role. 46 of the table's 58 rows are a step of a ramp with a name on top of it, and 15
of those are names invented for a level — `--field`, `--faint`, `--match`, `--*-wash`.

`compile()` now emits 6 families × (12 steps + 12 alphas) into each mode block, and
`gen-palette.mjs` registers them with Tailwind so they are real utilities:

```css
.bg-base-3      → background-color: var(--base-3)     /* #efefef light, #141414 dark */
.text-base-11   .border-base-6   .bg-base-a4   .bg-brand-9   .text-destructive-11
```

Generated, which is the point: 144 properties nobody maintains, replacing names that were written
and justified one at a time.

**Breaking: the `neutral` ramp is now `base`.** Of the six families only `neutral` collided with
Tailwind's own palette, and `bg-base-3` beside `bg-neutral-300` is an error waiting to happen —
Tailwind only lets a namespace be cleared whole, so the fix is a name and not a reset. `base` is
daisyUI's word for the same family. The rename is consistent to the seed: `RampName`,
`seeds.neutral` → `seeds.base`, `neutralHue` → `baseHue`, `HueSource` `"neutral-seed"` →
`"base-seed"`, and `gen-palette.mjs --neutral` → `--base`. `PALETTE_SCHEMA_VERSION` 3 → 4.

The brand family travels with the identity, exactly as `IDENTITY_TOKENS` does: a second brand is a
second ramp, so a scoped identity block carries `--brand-1..12` and its alphas alongside the 15
brand-derived roles.

**The semantic half did not move.** `compile.test.ts` strips the 288 scale declarations and compares
the remainder to the schema-v2 fixture byte for byte: a role is now an alias for a step, and that
re-expression changed no value.

Costs ~2× the sheet — 3992 bytes of roles, 11970 with the layer — which is a decision the size test
now records rather than a drift.

See `.planning/COLOUR-REVIEW.md` §10.
