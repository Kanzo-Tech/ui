---
"@kanzo-tech/ui": minor
"@kanzo-tech/testing": minor
---

**Findings: one item for one result or many, one action each, and a header made of parts.** Breaking;
what to change:

- **`FindingRow` and `FindingGroupRow` are `FindingsItem`.** Pass a `Finding` or a `FindingGroup` as
  `finding` — `group={g}` becomes `finding={g}`. A group's `where` prop is the item's children:
  `<FindingsItem finding={g} …>totalCost</FindingsItem>`. `FindingRowProps` and
  `FindingGroupRowProps` are `FindingsItemProps`.
- **The action is the item's, not the place's.** `describe` returns `{ where, detail? }`; move
  `action` from it onto the item: `<FindingsItem action={{ label: "Go to line", run: () => go(f.place) }} …/>`.
  A group's sampled places no longer draw a button each — the group's one action covers them.
- **`FindingAction` takes `pressed?: boolean`**, which draws the action as a toggle: pass it instead
  of switching the label and `aria-pressed` by hand.
- **`FindingsGroup` takes one `action`** at the end of its heading — a rule's *Show all 44
  violations* goes there instead of a button of your own inside the group.
- **`FindingsContent`'s `header` and `empty` props are gone.** Its children are a `FindingsHeader`
  and a `FindingsList`, and `empty` moves to `FindingsList`:

  ```tsx
  <FindingsContent>
    <FindingsHeader>
      <FindingsSource>flights-shapes.ttl · 4 rules</FindingsSource>
      <FindingsActions>{/* icon buttons, at most one text toggle */}</FindingsActions>
      <PopoverDescription>1,204 of 3,310 nodes checked</PopoverDescription>
    </FindingsHeader>
    <FindingsList empty={…}>{groups}</FindingsList>
  </FindingsContent>
  ```

  The header's title is *Findings*; `labels={{ title: "…" }}` on `FindingsRoot` renames it.
  `FindingsContentProps` is gone — `FindingsContent` takes `PopoverContent`'s props.
- **The inner `data-slot`s are `findings-*`**: `findings-item`, `findings-where`, `findings-message`,
  `findings-detail`, `findings-rule`, `findings-sample`, `findings-count`, `findings-action`. A
  selector on `finding-row`, `finding-group-row` or any `finding-*` slot changes with them.
- **`@kanzo-tech/testing`: `FindingRowHarness` and `FindingGroupRowHarness` are `FindingsItemHarness`**
  (`count()` reads 1 for one result, `sample()` a group's places), and `FindingsBadgeHarness`'s `row()`
  and `groupRow()` are `item()`.
