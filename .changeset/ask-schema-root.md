---
"@kanzo-tech/ai": minor
---

Ask's structured-output schema is now an object at its root, with the answer in a `spec` property,
because Anthropic's and OpenAI's tool inputs refuse a root `anyOf` and `ask` could not run on them.
`askSchema(context, graph)` returns that object, so a host that read `.anyOf` off it reads
`.properties.spec.anyOf`; a model double or a fixture that answered with a spec answers with
`{ spec }`. The spec the Task yields, and everything downstream of it, is unchanged.
