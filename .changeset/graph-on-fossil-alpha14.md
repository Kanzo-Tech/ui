---
"@kanzo-tech/graph": patch
---

**`@kanzo-tech/graph` now needs `@fossil-lang/corpus` `^0.3.0-alpha.14`.** fossil alpha.14 removed
`corpus.addressing`, and the graph read which channel a cell's `mode` summarises from it; it now
reads it from the tile matrix (`tileMatrix(type).mode`). Upgrade `@fossil-lang/*` to
`0.3.0-alpha.14` together with this release. Nothing else changes.
