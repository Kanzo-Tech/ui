---
"@kanzo-tech/ui": patch
---

`useDataTable` keeps `initialPage` and no longer makes React warn "Can't perform a React state update
on a component that hasn't mounted yet" when a table mounts. A change of filter, global filter or
sort still returns to the first page, now straight from that change; pass `autoResetPageIndex: false`
to keep the page instead. A new `data` keeps the page, where it used to return to the first one.
