---
"@kanzo-tech/ai": minor
"@kanzo-tech/llm": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/ui": patch
---

**Ask your data: `@kanzo-tech/ai/data`.** A new subpath with the whole of a data conversation:

- `dataAgent({ model, coordinator, schema, scope, key })` — an agent with one `query` tool that runs
  DuckDB SQL on the page's coordinator, caps the rows itself, and offers the page's selection to every
  query as a table named `scope`. The model is told the rows are already on screen.
- `describeSchema(coordinator, { catalog, exclude, references })` — a catalog as DDL, read from
  `information_schema`, with the joins the views do not declare written as `REFERENCES`.
- `dataSuggestions({ model, schema, scope })` — questions to start from.
- `QueryResult` — the card for a `query` call: a `Stat`, the chart `recommend` proposes, or a table;
  the SQL in a read-only editor; Copy, CSV and your own `actions`.

It needs `@kanzo-tech/ui`'s analytics, table and editor peers, plus `@kanzo-tech/mosaic` and
`@codemirror/lang-sql` (both optional peers of `@kanzo-tech/ai`, needed only by `/data`).

**`@kanzo-tech/ai`:**

- `suggest({ model, instructions, prompt })` streams suggested questions as `{ question, rationale }`.
- `Chat` takes `suggesting` (pills in skeleton while they arrive); `ChatSkeleton` is its layout while
  what it needs is loading.
- `Message*`, `Tool*` and `Reasoning*` are exported, for a transcript of your own.
- **Behaviour change:** a tool you draw with `tools` now replaces the frame's input as well as its
  output once the call has a result. If you relied on the input's JSON above your drawing, draw it
  yourself.

**`@kanzo-tech/graph`:** `corpusReferences(coordinator, from)` answers a corpus's joins (each edge
table's `src`/`dst` to its vertex tables' `dense_id`) as `describeSchema` takes them.

**`@kanzo-tech/llm`:** re-exports the AI SDK's `Tool` type.

**`@kanzo-tech/ui`:** a `Suggestion` longer than its strip is cut with an ellipsis instead of running
past the panel, with the whole label in a tooltip.
