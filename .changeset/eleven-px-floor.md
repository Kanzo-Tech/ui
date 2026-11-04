---
"@kanzo-tech/ui": patch
---

Sortable column headers, from `sortableHeader()` in `@kanzo-tech/ui/table` and in `DetailTable` from
`@kanzo-tech/ui/analytics`, show their sort arrow only on the column that is sorted. The other sortable headers
show it on hover or keyboard focus, and the space for it is kept, so headers do not shift.

The smallest text is now 11px: `Badge size="xs"` and any text inside a `Status` dot
were 10px.

`MenuShortcut` no longer adds letter spacing to the shortcut.
