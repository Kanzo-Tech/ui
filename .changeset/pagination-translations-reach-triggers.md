---
"@kanzo-tech/ui": minor
---

`Pagination`'s `translations` reach its triggers and its nav: `PaginationPrevTrigger` and `PaginationNextTrigger` drew a fixed English `aria-label` that hid `prevTriggerLabel` and `nextTriggerLabel`, and the nav's *Pagination* hid `rootLabel`. A new entry, `ellipsisLabel`, names every `PaginationEllipsis` inside (*More pages*), which Ark does not label. The English defaults are unchanged, and the type is `PaginationTranslations`.
