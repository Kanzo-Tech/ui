---
"@kanzo-tech/ui": minor
"@kanzo-tech/testing": minor
---

**Findings have a model, and the rows are the library's.** `Finding<Place>` is one result —
`{ severity: "violation" | "warning" | "info", message, rule: { id, label }, place, help? }` — and
`FindingGroup<Place>` is many sharing a rule: `{ rule, severity, message, count, places, sample }`.
`groupFindings(findings, keyOf, sample?)` makes groups and `tallyFindings(items)` counts both into a
`FindingTally`. The place is yours: the views take `describe(place) => { where, action?, detail? }`.

New: `FindingRow` (one result: severity, where and actions on line 1, the message wrapping on line 2,
the detail, rule and help when opened), `FindingGroupRow` (the count on the badge, one action for all,
the sample when opened), `FindingsBadge`, `FindingsTally`, and the types `DescribePlace`,
`FindingAction`, `FindingPlace`, `FindingLabels`, `FindingRule`, `FindingSeverity`, `FindingTally`.

**Breaking**, and what to edit:

- `FindingsRoot` takes `tally` (a `FindingTally`, or `undefined` for *nothing checked*) instead of
  `findings`, and `labels` for the rows' words; `onSelect` is gone. It no longer closes, or refuses to
  open, when nothing was found.
- `FindingsTrigger` is `FindingsBadge`. Its children are required — the tally in your words, and the
  button's name — and it is a button in every state: `outline` when nothing was checked, `success`
  when nothing was found.
- `FindingsGoTo`, `useFinding`, `FindingVariant` and `FindingCounts` are gone. A row's action is
  `describe(place).action`; the counts are `FindingTally`, keyed by severity rather than variant.
- `FindingsGroup` takes `title` and `tally` and renders the rows you give it as children, instead of
  a variant and a function from a finding to a row. `FindingsContent` takes `header` and `empty`
  instead of `title` and `description`; pass a `PopoverHeader` as `header`.
- In `@kanzo-tech/testing`, `FindingsHarness` is `FindingsBadgeHarness` (`row(message)`,
  `groupRow(message)`, `groups()`), `FindingHarness` is `FindingRowHarness` (`act(label)` replaces
  `show()`), `FindingGroupRowHarness` is new, and `Severity` is `"violation" | "warning" | "info"`.

`ScrollArea` takes `orientation="vertical"`: the content no longer takes its width from its widest
line, and there is no horizontal scrollbar. `"both"` is the default and unchanged.
