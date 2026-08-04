# A vendored shape is not a defect

- **Status** live — 2026-07-23
- **Decided** Where a simple is a faithful Shark vendoring, its shape answers to Shark, not to a
  purity audit. Reversing an upstream convention forks us for no accessibility gain.
- **Because** four components were flagged as hand-rolled behaviour and all four were exonerated
  against Shark's registry source: `resizable` is a thin wrapper over Ark's Splitter with no
  dragging of its own; `tour` imports Ark's real machine and adds only Shark's start callback;
  `command` is Ark's Combobox inside Ark's Dialog, with Shark's own two presentational leaves; and
  `sidebar` hand-rolls its context, its shortcut and its mobile swap **because Ark ships no
  sidebar** — Shark's own file does the same.
- **Reversed by** a divergence we can measure, which is the same bar
  `decisions/match-the-reference.md` sets. A rule violated only by inherited shapes is a rule
  aimed at the wrong file.
- **Held by** `packages/ui/src/simples/resizable.tsx`, `simples/tour.tsx`, `simples/command.tsx`,
  `packages/ui/src/composites/sidebar.tsx`

The corollary is where this bites hardest: our *own* code — `layouts/`, the composites — inherited
none of that discipline, and is where a conformance finding is worth acting on.
