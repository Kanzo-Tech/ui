---
"@kanzo-tech/problems": minor
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/llm": minor
"@kanzo-tech/auth": minor
---

`@kanzo-tech/kernel` is now `@kanzo-tech/problems`, and holds `Problem`, `isProblem`, `isCode`,
`within` and `until` alone. Change `from "@kanzo-tech/kernel"` to `from "@kanzo-tech/problems"`. The `Queryable`
types, the dispose symbols and `mark` are gone from it: an engine is `@kanzo-tech/mosaic/engine`'s
`Engine`, read with `engine.query(sql, { signal })`.
