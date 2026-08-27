---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
---

**`@kanzo-tech/mosaic` — the Mosaic conversation, without React.**

A new package holding what was never a user-interface concern: the coordinator, the clients, the
five clause builders, the Arrow column reader and the id-set client. No React anywhere in it.

It exists because of a defect that shipped. `@kanzo-tech/graph/duckdb` reached its coordinator
through `@kanzo-tech/ui/analytics`, whose barrel re-exports the React charts first — and calls
`@uwdata/vgplot` while doing it. The import is static, so a host that installed the two peers the
docs asked for, `mosaic-core` and `mosaic-sql`, still could not open the subpath: vgplot came
along, unasked and unused. `@kanzo-tech/graph` had ended up declaring vgplot as an optional peer to
paper over a dependency it never names.

The cause was a layer in the wrong package rather than a missing entry in a list. Reading a column
out of an Arrow answer and publishing a points clause are not user-interface work; they lived in a
component library only because that is where the first chart needed them.

**Nothing moves on the `@kanzo-tech/ui/analytics` surface.** Every name it exported it still
exports, re-exported from the new package — the charts stay exactly where they are, because
plotting is what that subpath is for. `@kanzo-tech/ui` gains `@kanzo-tech/mosaic` as a dependency
and loses its `@duckdb/duckdb-wasm` optional peer, which it never imported.

**`@kanzo-tech/graph` peers go from six to four.** `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` and
`@uwdata/vgplot` are gone from its manifest — they are `@kanzo-tech/mosaic`'s peers now, declared
once — and `@kanzo-tech/mosaic` takes their place as the optional peer behind `./duckdb`. Nothing
on that path names `@uwdata` at all, and `scripts/smoke-install.mjs` asserts it rather than
trusting the paragraph.
