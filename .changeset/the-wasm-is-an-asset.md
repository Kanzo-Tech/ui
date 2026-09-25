---
"@kanzo-tech/graph": minor
---

**Breaking: `openCorpus` no longer takes `wasmUrl`, and a bundled host passes nothing.**

`@fossil-lang/corpus@0.3.0-alpha.8` resolves its own `.wasm` with `new URL(…, import.meta.url)`,
which Vite, webpack 5 and Turbopack emit as an asset. The peer range is now `^0.3.0-alpha.8`.

```diff
- import wasmUrl from "@fossil-lang/corpus/pkg/fossil_graph_wasm_bg.wasm";
- const { source } = await openCorpus({ coordinator, dest, wasmUrl });
+ const { source } = await openCorpus({ coordinator, dest });
```

Delete the `.wasm` import, any `*.wasm` module declaration and any bundler rule or copy step that
existed only to produce that URL. A host with no bundler — Node, a script, a test — passes the
module as `wasm` (fossil's `InitInput`: the bytes, a `Response` or a URL), spelled as fossil spells
it:

```ts
const wasm = readFileSync("node_modules/@fossil-lang/corpus/pkg/fossil_graph_wasm_bg.wasm");
await openCorpus({ coordinator, dest, wasm });
```
