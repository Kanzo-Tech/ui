# `--accent` is a surface, not a third brand colour

- **Status** live — 2026-08-23
- **Decided** `--accent` is the quiet ground a row wears when it is hovered or selected, in all
  twenty-nine themes. An imported theme does **not** take daisyUI's `accent`, which is that system's
  third brand colour; it derives one from their base scale instead — `base-300` mixed 60% toward
  `base-200`. `--accent-foreground` goes with it and is authored by nobody, falling through the
  bridge to `--foreground`.
- **Because** one word names two roles in the two systems, and the recipes that read it are Shark's.
- **Reversed by** a theme that needs a third brand fill with a name of its own — a component that
  renders one, or a client whose identity is three colours and cannot say so. Nothing renders one
  today, which is the whole reason the collision was survivable for as long as it was.
- **Held by** `packages/theme/src/themes.test.ts`, "keeps every pair at AA once resolved" — the pair
  that carries this is `--accent` against `--muted-foreground`, added to `PAIRS` for it;
  `packages/theme/scripts/import-daisy.mjs`, `blend`

## The working

`bg-accent` is written at **24 call sites across 17 files** in `ui` and `ai`, and every one of them
means *hover* or *selected* — `data-highlighted:bg-accent` in the combobox item, `active:bg-accent`
in the floating panel. That is Shark's meaning, and Shark's recipes are pasted verbatim here, which
is the clause that decides this: the name is not ours to re-point.

daisyUI's `accent` is the third brand colour, saturated on purpose. `import-daisy.mjs` mapped one
onto the other, so eleven of the twenty-nine themes carried a brand fill under every hover in the
library. Measured over the catalogue, OKLCh chroma of `--accent`:

| | chroma | themes |
|---|---|---|
| written here | 0.000–0.039 | all sixteen |
| imported | 0.052–0.230 | acid, cmyk, coffee, cyberpunk, dim, forest, lemonade, luxury, night, sunset, synthwave |

**The pair was never the failure, and that is why nothing caught it.** `--accent` against
`--accent-foreground` cleared AA in all twenty-nine — the worst was `coffee` at 5.71 — because
daisyUI authors an on-fill ink for its own brand fill and the import carried it. What fails is a
*surface* ink on it: `--muted-foreground` on `--accent` measured **1.20:1** on `dim`, 1.41 on
`sunset`, 1.48 on `night`, and under 4.5 on eleven of the twenty-nine. A fill needs one ink; a
surface needs two. That sentence is now the guard.

### The ratio is read off our own themes

Across the sixteen written here, `--accent` sits between `--muted` and `--border` at a strikingly
fixed place — 0.56 to 0.62 of the way, light and dark alike. Mixing at 0.6 reproduces **all sixteen
at ΔE ≤ 0.60, median 0.40**; 0.55 gives 1.05 worst and 0.65 gives 1.20. So the derivation is not a
new opinion about where an accent belongs — it is the place ours already are, applied to the themes
that had no answer.

## The second-order effect, which is the part worth reading

`--accent` is the surface **furthest from the page**, so it is the hardest of the three for a muted
ink. The importer searched `--muted-foreground` against two surfaces — `--muted` and, through the
chain, `--card` — and that search stopped too early once accent joined them: `lemonade` 4.03, `cmyk`
4.19, `synthwave` 4.22, `wireframe` 4.31, `luxury` 4.37, all under AA on a surface that had just
become readable. The search now runs against three, and the thirteen clear it with the worst at
4.52. Five themes moved their `--muted-foreground`; the other eight already passed.

It terminates by construction: at `p = 1` the candidate is `--foreground` itself, which clears 7.66
on the worst of the thirteen.

## What this does not touch

- **`--secondary`, which looks like the same bug and is not.** Ten of the thirteen carry a saturated
  daisyUI `secondary`, but all six `bg-secondary` call sites pair it with `text-secondary-foreground`,
  and that ink is authored and passes. The two systems disagree about what a secondary *button*
  looks like — grey here, coloured there — and that is a difference of taste inside one agreed role,
  not two roles under one name. Measured before deciding, and left alone.
- **The sixteen written here.** None of them changes; the derivation exists for themes that arrive
  without an answer.
- **Whether an imported theme is still that theme.** It is: no colour was corrected, which is the
  importer's standing rule. A token was mapped from a different source, which is what the other four
  mapping decisions in that file already do.
