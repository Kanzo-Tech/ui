---
"@kanzo-tech/graph": patch
---

`GraphCanvas`'s screen-reader summary now writes its counts in the page's locale, from `LocaleProvider`, rather than the browser's, so it agrees with `GraphCounts` and `GraphStatus` on the same page.
