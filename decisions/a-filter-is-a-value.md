# A filter is a value, so its surface is a listbox

- **Status** live — 2026-07-26
- **Decided** The two facet filters stop being menus. One `FacetFilter` over `Listbox` serves both,
  from the root barrel. `DataTableViewOptions` stays a menu.
- **Because** `role="menu"` is a list of commands and a filter is a value that lives in state; and
  column visibility really is a view command that is nobody's data. Mis-roling costs more than
  purity — a `menuitemcheckbox` list cannot announce "two of five selected", and a menu has nowhere
  to grow a search field the day a column has hundreds of values.
- **Reversed by** nothing on the roles. The unification is reversed by two consumers whose surfaces
  genuinely diverge; today they had independently rediscovered the same two list rules and
  commented them in nearly the same words.
- **Held by** `packages/ui/src/index.test.ts`, "exposes the one facet-filter surface, on the root
  barrel"; `packages/ui/src/simples/listbox.test.tsx`, which pins `deselectable`;
  `packages/ui/src/simples/FacetFilter.test.tsx`, "keeps the popover non-modal, so the table it
  filters stays reachable" — the popover is the filter's own, and the listbox it wraps has none

`FacetFilter` sits on the root barrel because its two consumers are on subpaths that must not see
each other — `/table` would drag in Mosaic, `/analytics` would drag in TanStack — and being
presentational it needs neither.

Two behaviours differ from the menus they replaced, both deliberate. The popover is **not modal**:
ours defaults to modal, which marks the rest of the page `aria-hidden`, so the table being filtered
went unreadable to a screen reader at the moment it was being filtered. And `deselectable` is
**not** set: the machine only unticks an already-selected value when it is true, and setting it also
binds Escape to a clear with `stopPropagation()`, which made the key everyone presses to back out
of a popover silently discard the filter.

The two rules the component owns: a ticked value that another filter has faceted away stays listed,
or there is no way to untick it; and rows are ordered by label, never by count, because ordering by
frequency reshuffles the list under the cursor every time another filter moves.
