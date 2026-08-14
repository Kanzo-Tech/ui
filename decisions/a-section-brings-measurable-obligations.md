# A section brings measurable obligations, or it is a preference table

- **Status** live — 2026-08-13
- **Decided** An appearance vocabulary is a **section** only if it publishes obligations returning at
  least one measurable claim — a number, the bar it must clear, and what the bar came from. **A
  section is admitted for HAVING a bar, never for passing it.** On that test there are **three**
  sections: colour, graph geometry, and density. Radius, font and mono font remain a **preference
  table**. The registry is built — see *The registry, and why it exists now* below.
  - *Amended 2026-08-13, same day.* This first read **two** sections and *no registry*, on the
    argument that generalising over N=2 is a mechanism arriving before its second call site.
    Density then turned out to have a bar (WCAG 2.5.8, gradeable, and currently red), which makes
    three, and at three the mechanism has the call sites the rule asks for. Reopening here is
    editing a field, not winning the argument again.
- **Because** the same test already decided the tier below it. A colour role survives only if it
  carries a measured property a step index cannot express or is a name the reference pastes in
  verbatim — the rule that retired seventeen tokens. A section is that rule one level up: without
  it, "what belongs in the appearance document?" is a matter of taste, and a document decided by
  taste becomes a drawer. With it, the answer is a property of the source.
- **Reversed by** a section turning out to have no gradeable bar after all, which would make it a
  preference table and take the mechanism back below its call-site threshold.
- **Held by** `packages/graph/src/obligations.test.ts`, "grades at least one, which is what admits
  it as a section"; `packages/theme/src/obligations.test.ts`, "fails exactly the one it is known to
  fail, and no other"; `packages/theme/src/sections.test.ts`, "keeps a section whose package is not
  installed"

## Having a bar, not passing it

**This is the clause that will decide future cases, so it is stated on its own.** Density's
target-size obligation is **red today** — the smallest control measures 21 CSS px at compact against
WCAG 2.5.8's 24 — and that is precisely why density is a section. If passing were the criterion,
fixing a defect would demote a section to a preference and introducing one would promote it, which
is absurd. A bar you can break is what a section *is*.

The obligation may also be named and ungradeable, which is a third state and not a loophole:
`link-fade` in the graph and `x-height` in density both ship `measured: null` with what would close
them, because a bar nobody established cannot be cleared and reporting it green is how a guard comes
to test a corpus of zero. What admission asks is at least one claim that *can* be graded.

## Two names for a DECISION, never for a value

The rule that retired seventeen tokens is easy to misquote as *two tokens may not resolve to the
same value*, and that version is measurably wrong. Over `@atlaskit/tokens@16.7.0`: 466 active colour
tokens, **130 distinct values**, and **434 of them (93%) share a value with another token** —
`#1868db` alone is seventeen tokens. The naive rule would delete roughly 72% of a healthy shipped
API.

What was actually applied is narrower and is the distinction to carry forward: the seventeen were
retired because each was **a second name for one decision** — a pure `alpha` binding whose value the
reference layer already publishes under a name that says which ramp and which level it is. Two names
for one decision is the defect. Two names for one value is often correct, and the eight
`--sidebar-*` roles are the local proof: byte-identical to their non-sidebar counterparts in every
shipped document, and kept, because they are a contract the reference pastes in verbatim.

## The registry, and why it exists now

The mechanism is deliberately the smallest thing that works, and it is built on two properties taken
from systems that already ship them.

**Resolution is Neovim's hierarchical fallback.** A dotted name falls back to its parent —
`--graph-point-size-min` → `--point-size-min` → the manifest's default. The property that earns it
over everything else surveyed: **contributing is *using* a name, not declaring one in the core.**
The core never learns a section exists, so the one-way door stays shut structurally rather than by
discipline — `packages/theme` gains no reference to `packages/graph`, and `boundary.test.ts` keeps
passing by text match rather than by good intentions.

**Validation is the half Neovim does not have.** There, a typo degrades silently to the parent. Here
the manifest *declares* its tokens, so resolution goes by fallback and validation goes against the
declaration. That combination is what the survey found nobody doing: VS Code's `contributes.colors`
and Emacs contribute without validating the namespace; Vanilla Extract validates completely and
therefore cannot have optional sections; StyleX retracted that shape. It is unmapped ground, and
`sections.test.ts` states its blind spots rather than implying it has none.

**A default may be derived, and that is what makes white-label flow.** VS Code spells this as
imperative transforms (`darken`, `transparent`, `oneOf`); we already had the better form. A section
token's default is a **binding** — `--graph-marquee` is `(brand, alpha 5)` — declarative against the
tenant's ramps, exactly like the role table. A bank changes its palette and the marquee moves with
it, without the core knowing what a graph is and without anyone copying a hex.

**This is not the thing that was refused.** Minting a *role* in the core's vocabulary for one
consumer is how the seventeen happened. A section token lives in the owner's namespace, is declared
by the owner, and costs nothing to whoever never installs the package. The live example is
`graph-canvas.tsx`'s `SELECTION_WASH = "var(--brand-a5)"`: correct layer-three practice, and nailed
down — a tenant cannot move it. Declared as a section token it holds the same value and gains the
capacity to be redirected by a document.

## What the rule found on its first two runs

Both are the argument for having it, and neither was visible before the sections were made to report
in one shape.

- [[density-has-no-legibility-floor]] — density sets the root font-size the whole `rem` scale
  resolves against and had no floor at all, while the graph's floor is load-bearing enough to fix
  the shape vocabulary. Same physical question, one number between them.
- **The graph's own floor was justified by a false argument.** `shape-floor` was written as *shapes
  collapse below four pixels*; Smart & Szafir (CHI 2019, doi:10.1145/3290605.3300899) measured 16
  shapes across six sizes and found discrimination robust to size — significant variation only at
  6 px, and 4.5 accuracy points. The conclusion survived and the reason did not: what the floor
  protects is the **size and luminance channels from shape's interference**, which is Ink's exact
  case because it encodes identity as shape *and* degree as size. Writing the obligation down is
  what surfaced it, one step before it became a machine-checked claim.

Both sections now report in the same shape — a stable `id`, a `reason` a panel can show, and the
number, bar and provenance that make the claim checkable. That was the point of writing the graph's
four down: the colour section published twenty-one obligations and the graph published none while
having four that were perfectly real and living in comments. The asymmetry made *"are these two the
same kind of thing?"* an argument. With both reporting it is an observation, and it costs one file.

**Chart and editor are not sections.** The eight categorical slots with their `capacity`, and the
seven syntax hues, are derived inside the colour document by `deriveScheme` and `deriveSyntax`. They
are parts of colour, not peers of it — which is why the count is two rather than four, and why a
registry would have been generalising over less than it appeared to.

**An obligation may be named and ungradeable, and that is not a loophole.** `link-fade` is real —
cosmos.gl measures the fade in screen pixels, so a range that reads well at one zoom can erase the
edge layer at another — and it ships with `measured: null` and what would close it, because a bar
nobody has established cannot be cleared and reporting it green is how a guard comes to test a
corpus of zero. What the admission rule asks is at least one claim that *can* be graded, not that
every question is answered.

**The rule found a hole on its first run, which is the argument for it.** See
[[density-has-no-legibility-floor]]: density sets the root font-size the whole `rem` scale resolves
against and carries no floor at all, while the graph's 4px floor is load-bearing enough to fix the
shape vocabulary at four instead of nine. Same physical question, one number between them.

**And it corrected the graph's own first draft.** `shape-floor` was written as *the smallest radius
any look assigns*, which grades 2 across the three shipped looks and fails. The floor binds only on
a look that spends **shape** on identity; a look spending colour is right to start at 2, because a
2px dot still carries a hue. The test caught it before the row shipped — a bar that licenses more
than it measured is the same defect as a role claiming a name it has not earned.
