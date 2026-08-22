# A theme is one flat block of CSS, and one mode

- **Status** live — 2026-08-21
- **Decided** A theme is a hand-written `[data-theme="<name>"]` block in `packages/theme/themes/` —
  about fifty-five declarations: twenty-one authored colours, the shape knobs, the font stacks and
  its own `color-scheme`. It carries **one mode**; light and dark are two themes, not two blocks of
  one document. Everything else in the colour vocabulary is a **use** of one of the twenty-one,
  bridged once in `tokens.css` through `@theme inline`, never re-declared. `@kanzo-tech/palette` and
  the derivation it held are deleted, with no alias and no migration path.
- **Because** the derivation published a vocabulary the library did not use, and a two-mode document
  was what forced every mechanism built on top of it to be two of something.
- **Reversed by** a tenant who cannot express their identity in twenty-one authored colours plus the
  knobs — a requirement for a colour that must be *computed* from another at runtime rather than
  written down. Authoring cost is not that evidence: a theme is the thing you paste.
- **Held by** `packages/ui/src/simples/status.test.ts`, "has a corpus, and it is every shipped
  theme"; `packages/ui/src/lib/token-color.test.ts`, "declares a full set of slots, or none at all,
  in every theme"; `packages/theme/scripts/gen-theme.mjs`

## What the measurement was

The reference tier published **144** step utilities. Barrelled across `packages/{ui,ai,graph}/src`
— 160 files — components named **18** of them, and all eighteen were alpha steps; not one solid step
appeared anywhere. Of the 191 colour utilities the sheet declared, **126 were used by nothing**. The
command that re-derives it is in `.planning/THEME-REFOUNDATION.md` §1.

The eighteen were tints: `bg-destructive-a3` and its neighbours. `bg-destructive/7` compiles to the
same `color-mix(… transparent)`, so what eight thousand lines of ramp existed to name, CSS now
computes at the point of use. The percentages are the alpha each retired step *carried*, measured
across the six shipped documents and both modes, one number per level rather than per family.

## The clause that makes the rest of it work

The guard that banned `bg-token/NN` — deleted with this change, and named here rather than cited
because a path that resolves to nothing is worse than a description — had a measured, correct
argument: *a percentage lands on a different step in each mode* — `/4` is a3 in light and a2 in dark
— because the dark ramp is deliberately fatter at the bottom. Diluting with a percentage is the
central mechanism of the reference this refactor follows, so the two look irreconcilable.

They are not, because **the objection is conditional**: it only bites when one document serves two
modes. daisyUI's does not — verified in its published CSS, two flat blocks under `[data-theme=light]`
and `[data-theme=dark]`, no shared document. Adopt one-mode themes and the premise dissolves rather
than being overruled. That is why the ban was retired and its file deleted, and why the ninety-four
dilutions already shipping went from forbidden to correct with no edit.

## What it does not touch

The **shape** of a colour decision, only where it is written. `--*-content` is still the on-fill ink
and the status families still keep Shark's asymmetry, where `-foreground` is a readable-on-the-page
variant rather than text on the fill. `decisions/match-the-reference.md` still governs; this changes
what a token is stored in, not what it is called.

It also does not restore the contrast measurement the derivation used to make. That was given up
knowingly — see the `Reversed by` above for what would bring it back — but the artefact is still
measured: `status.test.ts` reads the shipped themes and measures five variants against every one of
them, which is a check over output rather than a guarantee at authoring time.

## The trap, which is not a compile error

`:root { --sidebar-primary: var(--primary) }` and the same line in `@theme inline` are **not**
equivalent. A custom property inherits its *computed* value, so the first resolves once on `<html>`
and a scoped `<div data-theme="dracula">` inherits the already-substituted answer — Dracula's brand
with the page's sidebar, silently. `@theme inline` puts the value in the *utility*, so it resolves
on the element wearing the class. That is why the whole vocabulary is bridged and none of it is
re-declared, and why the radius scale hangs off `--radius-field` directly rather than an
intermediate. Measured live: three levels of nesting resolve correctly, which is what retires the
alternation limit `packages/ui/src/styles.css` used to document.
