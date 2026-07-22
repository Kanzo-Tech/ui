---
"@kanzo-tech/ui": patch
---

Primitive semantics/accessibility: `Card` renders `<article>` and `CardTitle` a real `<h3>`
(both still `asChild`-swappable); `Alert` gets `role="alert"`/`role="status"` with an aria-live
region; and `EmptyState` accepts a `headingLevel` so its title slots into the surrounding outline.
