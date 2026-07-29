---
"@kanzo-tech/theme": minor
---

**`deriveSchemeColors` — one family set, both modes, chosen together.**

`deriveOrderedScheme` runs per mode, and the subset rule can pick a different size for light and dark
— kanzo 7/5, catppuccin-latte 7/5, kanzo-dark 7/8. But a `SchemeColors` needs the **same families in
both**, because a series keeps its identity across a mode flip: slot 3 must be the same category
under either. Reconciling afterwards — dropping whatever either mode crowded out, then re-deriving —
is lossy, and now measured on both axes it can lose on:

| palette | reconciled | joint |
|---|---|---|
| dracula | **3** slots @ 25.6 | **4** slots @ 19.7 / 17.8 |
| kanzo | 5 slots @ **28.1** light | 5 slots @ **32.5** light |

Dracula loses a category; kanzo keeps its five and loses 4.4 ΔE of colour-blind separation instead.
A test pins each, because a check that only counted categories would have called the kanzo case a
draw.

The search descends shared subsets scored on `min(light, dark)`, and reports `separation` and
`leading` **per mode rather than as the minimum** — a scheme can be comfortable in one mode and
marginal in the other, and a panel given only the minimum would warn about the wrong one.

**A pair index makes it affordable.** The ramps hold only a few hundred colours, so an
order-independent `Map` over colour pairs — the worse of protan/deutan, plus unsimulated ΔE, plus
per-mode band/chroma and relief lookups — replaces the inner `checkScheme` calls: **9252 ms → 680 ms
(13.6×)** across the twelve palette/mode cases, worst single case 3245 → 232 ms, output byte-identical
by diff. The whole package suite went from ~10 s to **3.0 s** while gaining seven tests.

The index **ranks; it never rules**. The published `separation` in both functions now comes from the
real `checkScheme`, so a drifting index could only make the search choose badly while still reporting
the truth — a far smaller failure than publishing a figure no gate stands behind. A test checks the
one public surface that runs entirely through the index (`allPairsCap`) against a `checkScheme`-only
reimplementation, including the degenerate zero- and one-length ends, because the failure it guards
is silent: every scheme would be *reported* against the real rule while being *chosen* against a
stale one, and nothing would fail — the answers would just quietly get worse.

Every one of the six palettes' expected figures reproduced exactly. No existing test was changed,
relaxed or rewritten, which is itself the evidence that the index changed nothing.
