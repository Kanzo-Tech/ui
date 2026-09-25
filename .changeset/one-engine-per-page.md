---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

**`engine()` — the page's one DuckDB-WASM database, and the file registry beside it.**

```ts
import { engine } from "@kanzo-tech/mosaic"; // or "@kanzo-tech/ui/analytics"

const { coordinator, query, lend, hold, drop } = await engine();
```

One per document, however many islands ask. Every host was writing the same memoised boot so that
vgplot's single active coordinator had one database behind it; this is that boot, once.

It also owns what DuckDB reads by name, which nobody did. DuckDB-WASM refuses to register a name a
second time under a different URL — `File already registered: vertex/Order/tiles.parquet` — and a
signed URL is a different string on every signing, so the second visit to the same data threw.
`lend({ name: url })` is a no-op for the same URL and replaces the lease for a new one.
`hold(name, bytes)` registers a copy of a buffer, `drop(names)` forgets, and `query(sql)` answers
rows as objects, uncached. That is fossil's `Engine` shape, matched structurally: this package does
not depend on fossil.

**Breaking: `wasmConnector` is no longer exported** from `@kanzo-tech/mosaic` or
`@kanzo-tech/ui/analytics`. Replace

```ts
const coordinator = new Coordinator(wasmConnector());
```

with

```ts
const { coordinator } = await engine();
```

and drop your own `getDuckDB()` registry calls in favour of `lend`, `hold` and `drop`. A coordinator
over some other connector is still yours to build; `Coordinator` stays on both surfaces.
