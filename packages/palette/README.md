# @kanzo-tech/palette

The colour derivation. **Two seeds in, a measured tenant palette document out.**

```ts
import { derivePalette, compile } from "@kanzo-tech/palette";

const doc = derivePalette({ id: "acme", label: "Acme", brand: "#7f22fe", neutral: "#6b7280" });
const css = compile(doc); // :root { … } .dark { … } — both modes, every token, ~4 KB
```

`derivePalette` grows six ramps (the client's brand and neutral, plus Kanzo's four fixed status
families) in both modes, spins a categorical set off the brand hue, resolves the role table, and
writes down everything that did not go exactly as asked in `doc.record`. The gate policy is
**adjust and publish** — never accept-and-warn, never refuse, because the record is written to be
read by a person on an onboarding screen.

## Authoring-time only

**A browser must never import this package.** A tenant's palette is derived and measured once, at
onboarding, and stored as data; the runtime does nothing but apply the stored document. The
categorical search alone costs 0.2–7.4 s.

That is why this is a package rather than a subpath of `@kanzo-tech/theme`: out of the dependency
graph the search *cannot* reach a client bundle, rather than merely should not.
`@kanzo-tech/theme` depends on this as a **devDependency** and its `boundary.test.ts` fails if that
ever changes.

Nothing here reads the DOM and nothing here is a React component.

## What's in it

| Module | What it owns |
|---|---|
| `ramp` | one seed → twelve steps, each carrying a measured obligation, plus the alpha scale |
| `palette-check` | the six categorical gates — contrast, CVD separation, hue distance, chroma floor |
| `derive-scheme` | a hue wheel snapped to families, searched and ordered for CVD separation |
| `derive-palette` | the whole pipeline: seeds → ramps → categorical set → roles → record |
| `roles` | the role table — which token is bound to which ramp, step, elevation or slot |
| `palette-document` | the `TenantPalette` schema and its engine hash |
| `compile` | a document → one stylesheet, literal hex, both modes |
| `seeds` | the shipped seed pairs: Kanzo's own and four borrowed identities |

## Generated tables

`palette-data.json` holds the tables the derivation *reads* — Tailwind's chromatic families, the
named greys a neutral seed can be picked from, the default categorical scheme, the base16 sources
and their seed pairs, the base16 → syntax role mapping, and the four status seeds. They are inputs
to the maths, not outputs of it.

Import them through the JS entry as `paletteData` / `BASE16_SLOTS`, never as a raw `.json` path: an
ESM JSON import at runtime needs `with { type: "json" }`, which Rollup strips when bundling.

The values are read off Tailwind's own `theme.css` rather than transcribed, because transcription
is how they rot — the swatch tables once carried v3 hexes while the theme resolved v4. **Edit
`scripts/gen-data.mjs`, not the output**; `pnpm gen` regenerates it and rebuilds, and CI fails on
any diff.

## base16 identities are seeds

Dracula, Nord and the two Catppuccins ship as `PALETTE_SEEDS` and go through `derivePalette`
exactly as a client does — a brand hue and a neutral hue, nothing more. There is one shape in the
system, and two shapes for one idea is the defect this layer exists to remove.

A ramp keeps a foreign seed's *hue* and gives up its mood, so a light Dracula is a **reading**
rather than an invention. Measured: Dracula's `#50fa7b` comes back as `#00a843` at step 9 — same
hue, different place.
