# An invalid boundary needs no dark branch

- **Status** live — 2026-08-13
- **Decided** The `dark:` overrides that repainted an **invalid control's border and ring** with
  `--destructive-foreground` are removed from twelve recipes. The `text-` half of the same
  overrides **stays**. This is a deliberate divergence from Shark UI, which writes all three.
- **Because** `--destructive` already clears the bar a boundary owes, in every document this
  repository ships and in both modes — measured, and the figures are below. The override bought no
  contrast on a border or a ring; it bought a different hue for its own sake, in one mode only, at
  the cost of every one of those recipes carrying a mode branch the token layer exists to make
  unnecessary.
- **Reversed by** a document whose destructive fill stops clearing WCAG 1.4.11 against its own dark
  page. None does, and a client's destructive seed is not overridable — the four status families are
  Kanzo's, so the only way to reach it is a change to the ramp, which `palettes.test.ts` re-measures
  per tenant.
- **Held by** `packages/ui/src/simples/input.tsx`, `inputVariants`, which carries the measurement and
  is the site the other eleven point at

**The measurement.** Step 9 of the destructive ramp against that document's own page, over all six
compiled documents (2026-08-13): **4.15:1** in dark, **4.56–4.57** in light. WCAG 1.4.11 asks
**3:1** of "the visual information required to identify a control or its state", so the border and
the ring clear it in both modes with the base token alone.

**The `text-` half is not the same question and the same measurement is why it stays.** Text owes
AA's **4.5** and dark's 4.15 misses it. So `dark:data-invalid:text-destructive-foreground` is doing
real work on every one of those recipes, and removing it would have been the defect this record is
avoiding, one rung down. The measurement licenses exactly the divergence it measures — the rule in
`CONVENTIONS.md`, *The reference, and what overrules it* — and here it splits one Shark line into a
part that was earning its place and a part that was not.

**Focus rings were not touched**, and they look identical in a grep. A focus ring answers a different
measurement — the diluted one measured 1.29:1, which is what banned diluting `--ring` at all — so
`dark:focus-visible:ring-destructive/40` on `Badge` and the `data-focus-visible` pair on `Checkbox`
stay. Two of them were removed in the first pass of this change and restored; the lesson is that
`invalid` and `focus-visible` are separate cases wearing one spelling.

`shark-parity.test.ts` does not see this and cannot: it compares the **export surface** against
Shark's registry, and a recipe's internals are outside its corpus. That is the blind spot this record
covers, and it is why the divergence is declared here rather than in
`shark-parity.divergences.ts`.
