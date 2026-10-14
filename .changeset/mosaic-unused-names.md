---
"@kanzo-tech/mosaic": minor
---

The types `ClauseParts`, `AntiJoinMetadata`, `RelationMetadata` and `RelayOptions` leave the package's entry. `clauseParts(clause)` and `relaySelection(from, to, options)` are unchanged; where you named one of these types, use `ReturnType<typeof clauseParts>` or `Parameters<typeof relaySelection>[2]`.
