---
"@kanzo-tech/graph": minor
---

**`onFailure` receives the value that was thrown, not its message.** On `GraphRoot` and `useGraph`,
`onFailure` is now `(error: unknown) => void`. A corpus that will not open or a read that fails
arrives as fossil threw it, with its `code` and `data`; the graph's own failures are a `GraphError`,
now exported, whose `code` is `"graph/no-webgl"`, `"graph/context-lost"`, `"graph/nothing-to-draw"`
(no vertex type with a position) or `"graph/untranslatable-filter"` (a crossfilter
clause the corpus cannot be asked). Where you wrote
`onFailure={setMessage}` with a string state, write `onFailure={setFailure}` with `unknown` state, or
`onFailure={(error) => …}`, and branch on `error.code`; render `error.message` only as the fallback.

**A GPU device that never comes up now fails.** When the browser offers WebGL but cosmos.gl cannot
make a device, the canvas used to say "Loading the graph…" for good. After 10 s the root is now
`failed` and `onFailure` receives a `GraphError` coded `"graph/no-webgl"` with `data.after` of
`10000`. A lost WebGL context also sets `status` to `"failed"`.

`GraphInspector` now tells a vertex the corpus does not have ("This vertex is not in the corpus.")
apart from a read that failed ("This vertex could not be read."); only the failure reaches
`onFailure`. When one of the graph's parallel reads fails, the others are cancelled.

A `corpus` promise must settle: the graph shows "Opening the corpus…" until it does and sets no
deadline on it.

**`@fossil-lang/corpus` must be `^0.3.0-alpha.19`.** It is the first release whose `open` and reads
raise coded failures and whose `Engine.query` requires a signal. Bump it beside this release. A
corpus fossil cannot read is refused by `open` with fossil's own code (`corpus/unsupported-format`,
…), which `onFailure` receives as is.
