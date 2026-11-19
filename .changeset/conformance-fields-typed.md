---
"@kanzo-tech/testing": minor
---

`queryableConformance` holds an engine's answer to typed fields: each of `schema.fields` is
`{ name, nullable, type: { typeId } }`, as an Arrow table's already are, so a reader that types a
column by what the engine answered (fossil's profile) reads the answer without a conversion.
`@kanzo-tech/mosaic/engine`'s `engine()` passes as it is. A double you hold to the kit adds `nullable`
and a `type` with Arrow's `typeId` (`Schema.fbs`: 2 Int, 3 FloatingPoint, 5 Utf8, 6 Bool) to each field.
