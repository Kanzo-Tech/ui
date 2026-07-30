---
"@kanzo-tech/graph": minor
"@kanzo-tech/docs": patch
---

`@kanzo-tech/graph` — the GPU graph view leaves the showcase and becomes a package.

A sibling of `palette` and `theme`, not part of `ui`: `DESIGN.md`'s first admission rule excludes
graphs from the generic vocabulary by name, and a **required** WebGL peer has no honest home inside
a package that does not need one.

It ships the two halves that are genuinely shared — `load()` reading a relation into the typed
arrays a GPU wants, `buffers()` turning a look and the live theme into per-point attributes — plus
the hooks that own the renderer's lifetime and the cluster seeding that actually separates
communities. It deliberately does **not** ship a canvas component: a graph canvas is a toolbar, a
legend and an inspector wired to a renderer, and those are arrangements whose answers differ per
product.

The second call site the admission rules ask for is real rather than hypothetical: the benchmark
route drives the same `load()` and `buffers()` from synthetic generators with no DuckDB in sight,
which is the pressure that showed which parts were component and which were fixture.

`CosmosClient` is gone rather than aliased. It was already a re-export of `IdSetClient` from
`@kanzo-tech/ui/analytics`, which is where it belongs — the class imports nothing from cosmos.gl and
models a view whose positions live outside the database, which a map or an imperative widget can be
just as easily.
