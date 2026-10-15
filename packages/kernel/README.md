# @kanzo-tech/kernel

Layer 0: what the other packages each wrote and now share. It imports nothing, declares no dependency
and no peer, touches no DOM, and does nothing at import. The argument is `/docs/design/kernel`.

```ts
import { Problem, isProblem, within, until, mark, dispose, asyncDispose } from "@kanzo-tech/kernel";
import type { Queryable, Table, Vector } from "@kanzo-tech/kernel";
```

- **`Problem`** — the one failure, in RFC 9457's shape: `code` (`area/kind`), `title`, `status`,
  `data`, `help`, `related`, and `cause` kept whole in process. `toJSON()` is `application/problem+json`
  and carries a `cause` only when it is itself a Problem, never a stack. `Problem.from(body)` rebuilds
  one. `isProblem(error, code?)` is structural, never `instanceof`; `isCode` is the grammar.
- **`within(ms, wait, { signal, silent })`** — the one bounded wait. `silent(after)` is mandatory and
  returns the `Problem` that names who did not answer. `until(promise, signal)` abandons a wait that
  takes no signal.
- **`Queryable`, `Table`, `Vector`** — the read side of an engine, as types; an Arrow table is one.
- **`dispose`, `asyncDispose`** — the runtime's `Symbol.dispose` and `Symbol.asyncDispose`, else
  `Symbol.for("Symbol.dispose")`. Nothing is installed on a global. Their types come from TypeScript's
  `esnext.disposable` lib (5.2+).
- **`mark(name, start, detail?)`** — a `kanzo:<name>` span in the Performance timeline; never throws.

The codes are written once in `problems.bnf`, published beside the code, and `src/problems.gen.ts` is
generated from it (`pnpm --filter @kanzo-tech/kernel gen`; `pnpm check:generated` fails on a diff).
