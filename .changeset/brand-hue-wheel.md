---
"@kanzo-tech/theme": minor
---

**The categorical set is spun off the brand hue, not read off Kanzo's scheme.**

`derivePalette` built its chart colours from "the tenant's brand, then the default scheme's eight
slots, deduplicated by hue family". Nine families for a search that can order eight, and the subset
rule then spends whichever buys the least separation — a rule that is not wrong, it just has no
opinion about whose palette it is. Measured over thirteen brands, one per family, that produced **six
distinct schemes**: a `#009689` teal brand and a `#8e51ff` violet brand came back byte-identical in
light, and for the teal it was the teal that got dropped. A chart with nothing of the client in it,
twice over — against the one requirement the document exists for.

`categoricalSource` is now a **brand wheel**: `WHEEL_SPOKES` (9) hues at `WHEEL_STEP` from each
other starting at the brand's own, each snapped to its nearest family, deduplicated with spoke zero
first. Every hue in a client's charts is their own hue plus a published multiple of the golden angle.

**`WHEEL_STEP` is the golden angle and not `360 / spokes`, which is the whole point.** An evenly
spaced wheel is invariant under rotation by its own spacing, so two brands one spoke apart are handed
the same angles. Swept over the hue circle at 0.01°, an even nine-spoke wheel yields **17 family sets
for the entire world**, each shared by 7–12 brand families: 11.58% of brands in different families
collide. Nine golden-angle steps do not close, so the brand's hue survives the snap — **137 sets and
0.33%**, a 35× reduction. Nine spokes is the measured knee (8 → 1.10% and a whole category of
capacity; 10 → 0.11% for 3.3× the search; 12 → 0.12%, past the floor).

Against the source it replaces, over 24 brands one every 15°: capacity 7.46 (min 7) against a flat 8,
separation 19.6/18.3 light/dark against 21.6/21.6, and **1.17 light slots under 3:1 against 1.92** —
the two known offenders, `#00c950` at 2.13 and `#ff8904` at 2.28, are no longer in most tenants' sets
at all. The set is smaller and slightly less separated, and it is the client's.

- **`DeriveOptions.require`** (new) — families no subset may leave out. Membership only: the order
  stays `orderScheme`'s, so Decision 13 holds and the brand is *present*, never forced into slot 1.
  `derivePalette` requires the brand's own family, which is what makes "the tenant's hue is in the
  charts" an assertion rather than a hope.
- **`CategoricalSet.source`** (new, `PALETTE_SCHEMA_VERSION` → 2) — `{ from, hue, family, spokes }`.
  A brand below `CHROMA_FLOOR` has no hue to spin a wheel from, so it gets Kanzo's default scheme and
  the document says `from: "default-scheme"` rather than leaving it to be inferred. Manufacturing a
  hue for a grey brand is what this layer refuses everywhere else.
- **`familyAtHue`, `familyStandard`, `FAMILY_GAP`** (new, from `derive-scheme`) — the hue half of
  `familyOf` without a colour to carry it, the colour a family's hue was measured off, and the widest
  gap between adjacent family hues (61.8°, yellow→lime), which is why a wheel has to dedupe at all.
- `categoricalSource(brand, spokes?, step?)` keeps its name and its first argument; the second
  argument is no longer a scheme.
