# Density's legibility floor is a section's bar, and it is currently red

- **Status** live — 2026-08-13
- **Decided** Density is a **section** under [[a-section-brings-measurable-obligations]], because it
  has a gradeable bar: WCAG 2.5.8 Target Size (Minimum). Its obligations ship as a `Report[]` in
  `@kanzo-tech/theme`, in the same shape the graph's use. The target-size bar **fails today** and is
  pinned by id rather than hidden — a section is admitted for having a bar, not for passing it. The
  x-height bar is named and ungradeable, with what would close it. **No height and no density step
  is changed**: the measurement says the fix does not go where it first appeared to.
  - *Was `open` and recorded only a hole. Promoted the same day, on the measurement below.*
- **Because** the graph section has exactly this obligation and it is load-bearing: a look spending
  shape on identity may not go below a measured minimum radius, which is why the shape vocabulary is
  as small as it is rather than as large as the renderer allows. Density is the same physical
  question — how small can a mark get and still be read — and it has no number at all. The asymmetry
  only became visible when the sections were made to report in one shape, which is the argument for
  having done that. The figures are in the table below.
- **Reversed by** the target-size bar turning out not to be density's to grade — see *Whose bar is
  it* below, where the measurement already moved it halfway.
- **Held by** `packages/theme/src/obligations.test.ts`, "fails exactly the one it is known to fail,
  and no other"; `packages/theme/src/obligations.ts`, `OBLIGATIONS`

## What the showcases actually measure, in situ

Probed live at `compact` across three showcases, deduplicating nested targets (a checkbox is a 14×14
`<label>` wrapping a 1×1 sr-only `<input>`; counting both made every checkbox fail against itself,
which was the first draft of this probe and was wrong):

| showcase | targets | under 24×24 | saved by the 2.5.8 spacing exception | genuinely failing |
|---|---:|---:|---:|---:|
| app-shell | 45 | 8 | 8 | **0** |
| metadata-form (compact) | 26 | 4 | 4 | **0** |
| workspace | 32 | 15 | 4 | **11** |

**No `size="xs"` button failed anywhere.** The `xs`-in-a-cluster hypothesis is not the defect: every
undersized button was saved by the spacing exception, because the library's own gaps are wider than
24 px between target centres.

**The eleven real failures are a hand-rolled list row**, not a library size variant:
`docs/showcases/workspace/graph-view.tsx`'s find-panel results — `flex w-full items-center gap-2
rounded-sm px-1 py-0.5 text-xs`, measuring 187.3×**17.5** px with centres **19.3 px** apart.

## What it measures out at, today

`themes.css` sets the root font-size per `data-font-size`: **compact 14px**, default 16px,
comfortable 18px. Every size in the library is `rem`, so compact scales everything by 0.875.

| thing | default (16px root) | **compact (14px root)** | bar |
|---|---:|---:|---|
| `Button size="xs"` (`h-6`, 1.5rem) | 24.0 px | **21.0 px** | WCAG 2.5.8 Target Size (Minimum), AA: **24×24** |
| `Button size="sm"` (`h-7`) | 28.0 px | 24.5 px | same |
| `Input size="sm"` (`h-7`) | 28.0 px | 24.5 px | same |
| `--kanzo-font-size-xs` (0.625rem) | 10.0 px | **8.75 px** | none in WCAG; no house bar either |

**So the smallest button in the library is 21 CSS px at compact, against 24 for WCAG 2.5.8 AA.** It
is exactly at the bar at default density, which is the tell that nobody chose 24 — it fell out of
`h-6` and the default root, and the density axis then moved it without anything noticing.

Two honest qualifications, because the measurement licenses only what it measures. WCAG 2.5.8 has a
spacing exception: an undersized target passes if a 24px-diameter circle centred on it overlaps no
other target's circle, so whether a given `xs` button fails depends on the layout it is in, not on
the component. And 2.5.8 exempts inline targets and user-agent-controlled sizing. **What is certain
is that nothing here computes any of that** — the exception may well save most call sites, and no
test asks.

## What would close it

Three bars, in the order they are worth having:

1. **A target-size obligation.** For every interactive recipe, at every density: rendered box ≥ 24×24
   CSS px, or the spacing exception demonstrably satisfied. This is checkable in jsdom against the
   compiled stylesheet and is the one with a real external standard behind it.
2. **A minimum type size.** WCAG sets none, so this needs a house bar with a reason — the honest
   anchor is the IDE tier's own justification (`--kanzo-font-size-base` is 13px "below Tailwind
   `text-xs`"), which means the scale was already designed against a floor nobody wrote down.
3. **A floor on the axis itself.** The cheapest of the three and the most like the graph's: declare a
   minimum root font-size the density axis may emit, and let the two above be consequences.

Until one of those exists, `compact` is a setting whose smallest control is under an AA bar, offered
to users in a panel. It is now asserted rather than merely true.

## Whose bar is it, and the correction the measurement forced

The reading this started from: the base height belongs to `@kanzo-tech/ui`, the multiplier to
density, WCAG measures the product, so the obligation sits with whoever can break it — and what
moved 24 to 21 was density.

**That is half right, and the failing half matters.** Those eleven workspace rows fail at the
**default** density too — 184.3×**20.0** px, centres **22.0** px apart — and clear only at
comfortable, where all eleven pass. So density did not move a passing target to failing. It made an
already-failing one worse, and at the loosest setting it *fixes* it.

The correct division: **density is a multiplier on a bar both layers can break, and here the
component broke it first.** A 1.25rem row is under 24 px at every density the axis offers except
comfortable; no density setting rescues a base height that small, and no base height is safe from a
multiplier. The obligation is stated in `@kanzo-tech/theme` because that is where the multiplier
lives and where the axis can be graded — not because the fix belongs there. For these eleven, it
does not: it belongs to the showcase that hand-rolled a list row instead of using a component with a
height.

**And that is the finding worth more than raising `h-6`:** the system's own `xs` variant is fine in
practice, and what actually fails is hand-rolled markup with a `py-0.5`. Raising the variant would
have fixed nothing measured here. What would help is a lint or a documented minimum for
interactive rows — the third bar above.
