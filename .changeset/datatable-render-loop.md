---
"@kanzo-tech/ui": patch
---

Fix an infinite render loop in `DataTable` that hard-froze the browser tab.

`columnFilters` was rebuilt as a fresh array and object literal on every render, so TanStack
saw the filtered row model as permanently stale. Recomputing it tripped `autoReset*`, which
reset the page index → re-render → new identity → loop. It is now memoised on
`[searchKey, filter]`.

The failure was invisible to every normal debugging route: the cycle runs through the table's
own `onStateChange` rather than a `setState` during render, so React raises no "maximum update
depth" error, nothing reaches the console, and error boundaries never fire — the tab simply
stops responding. Because a mounted `DataTable` re-renders whenever any ancestor does, the
freeze surfaced far from its cause: opening a dialog, a popover or picking a date all appeared
to be the culprit.
