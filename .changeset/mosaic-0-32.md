---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
---

**The Mosaic stack is `^0.32.0`, and `npm install @kanzo-tech/ui` works.** mosaic-core 0.29 published
a `workspace:^` peer range that npm refuses to install; every `@uwdata/mosaic-*` and `vgplot` range
here — peers and the optional analytics peers — is now `^0.32.0`. DuckDB-WASM stays at
`1.33.1-dev57.0`, the release mosaic-core 0.32 pins. Raise your own `@uwdata/*` installs to 0.32:

```sh
npm i @uwdata/mosaic-core@^0.32.0 @uwdata/mosaic-sql@^0.32.0 @uwdata/vgplot@^0.32.0 @uwdata/mosaic-plot@^0.32.0
```

What changes for your code with 0.32:

- **A failed query still reaches `onFailure` as it was thrown.** mosaic-core now hands a client's
  `queryError` a `QueryError` wrapping the original, with the SQL appended to its message. The charts,
  the inputs, `ChartStat` and the graph unwrap it, so `onFailure` receives the original error with its
  `code` and message intact. A `MosaicClient` of your own does the same with `queryFailure(error)`, new
  on `@kanzo-tech/mosaic` and `@kanzo-tech/ui/analytics`.
- **`coordinator.query(sql, { type: "json" })` answers an Arrow table** — the `type` option is gone.
  Read rows with `table.toArray()`.
- **A connector of your own answers Arrow as IPC bytes**, which mosaic-core decodes; one that returned
  a decoded table fails with "IPC data batch was not a Uint8Array".
- **`clausePoints(fields, [])` is a clause that drops every row**, not a retraction. Pass `undefined` to
  retract one. `ChartFilter` does so when the last value is unticked.
