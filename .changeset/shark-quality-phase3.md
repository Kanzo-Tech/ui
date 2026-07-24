---
"@kanzo-tech/ui": minor
---

**`Item` realigned to Shark's current registry.** Richer variants (outline/muted gain borders +
shadows), `ItemMedia` gains an optional `variant` (`default`/`icon`/`image`), and `ItemDescription`
now renders a `<p>`. Our accessibility decisions are kept over Shark's (`role="listitem"` on `Item`,
`min-w-0` on `ItemContent`, no needless `"use client"`). Additive — existing call sites are unaffected.

**`DataTable` now paginates with our `Pagination`** instead of hand-rolled prev/next buttons —
numbered pages + ellipsis, driven by TanStack's pagination state (controlled, 1-based↔0-based mapped).

**`SegmentGroup` item text is centered again** — a stray `gap-2` on the item left the label pinned
left of its indicator pill; removed.

**Preferences appearance toggle moved to the panel header** (beside the close), freeing the dedicated
full-width row it occupied for one compact icon.

`Field`, `Input`, and `InputGroup` were confirmed byte-identical to Shark's registry — no change.
