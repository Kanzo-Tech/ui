---
"@kanzo-tech/ui": minor
---

**`FilterBar` is one line at any number of filters, and its verbs are pinned at the end as icons.**
The chips no longer wrap to a second row: they scroll sideways, with a fade at the edge that hides
more, and a chip added on its own is scrolled into view. After a hairline come the verbs, each an
icon with a tooltip, then the readout and your `children`. With no filter the row reads *No
filters*, at the same height.

Two buttons are renamed, which matters to a test that finds them by name:

- *Clear* is now **Clear every filter** (an icon). It is always there, disabled while nothing
  filters, where it used to appear only once something did — assert `disabled`, not absence.
- A dashboard's *+ Filter* is now **Add a filter** (an icon), among the bar's verbs instead of after
  the last chip. Its menu is unchanged.

`ScrollArea`'s `scrollFade` also fades the left and right edges of content that overflows sideways.
Content that fits across is not masked, so nothing changes for a vertical area.

The `./analytics` size budgets are raised as a decision, 36.5 kB -> 37.7 kB and `{ Dashboard }`
33.9 kB -> 34.4 kB (37.6 kB and 34.32 kB measured): the subpath now carries `ScrollArea`, `Tooltip`
and `Separator`, which are the root barrel's same files in an app that imports both.
