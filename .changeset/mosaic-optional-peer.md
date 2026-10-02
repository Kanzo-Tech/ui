---
"@kanzo-tech/ui": minor
---

**`@kanzo-tech/mosaic` is an optional peer, not a dependency.** Only `@kanzo-tech/ui/analytics`
imports it, but every install of `@kanzo-tech/ui` pulled it, and with it DuckDB-WASM. A root-barrel
consumer no longer installs either.

If you use `@kanzo-tech/ui/analytics`, install it beside its other peers:

```sh
pnpm add @kanzo-tech/mosaic @uwdata/vgplot @uwdata/mosaic-plot @uwdata/mosaic-core @uwdata/mosaic-sql
```
