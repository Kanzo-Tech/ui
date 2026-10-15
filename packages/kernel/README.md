# @kanzo-tech/kernel

Layer 0: what the other packages each wrote and now share. It imports nothing, declares no dependency
and no peer, touches no DOM, and does nothing at import. The argument is `/docs/design/kernel`.

```ts
import { Problem, isProblem, within, until, mark, dispose, asyncDispose } from "@kanzo-tech/kernel";
import type { Queryable, Table, Vector } from "@kanzo-tech/kernel";
```

- **`Problem`** — the one failure, in RFC 9457's shape: `type` (a tag URI derived from `code`),
  `title` (the registry's, one per type), `status`, `detail` (`message`), and the extension members
  `code` (`area/kind`), `data` (typed per code), `help`, `related`, and `cause`, kept whole in process.
  `toJSON()` is `application/problem+json` and carries a `cause` only when it is itself a Problem
  (at most 8 deep, a cycle cut), never a stack. `Problem.from(body)` rebuilds one.
  `isProblem(error, code?)` is structural, never `instanceof`; `isCode` is the grammar.
- **`within(ms, wait, { signal, silent })`** — the one bounded wait. `silent(after)` is mandatory and
  returns the `Problem` that names who did not answer. `until(promise, signal)` abandons a wait that
  takes no signal.
- **`Queryable`, `Table`, `Vector`** — the read side of an engine, as types; an Arrow table is one.
- **`dispose`, `asyncDispose`** — the runtime's `Symbol.dispose` and `Symbol.asyncDispose`, else
  `Symbol.for("Symbol.dispose")`. Nothing is installed on a global. Their types need TypeScript 5.2
  and `"lib": ["esnext.disposable"]`; a host that polyfills `using` uses
  `Symbol.dispose ??= Symbol.for("Symbol.dispose")` (TypeScript's own recipe is a private symbol and
  would not agree). Native: Chrome 125/127, Firefox 141, Node 24, Deno 1.37; Safari not shipped
  (MDN browser-compat-data).
- **`mark("area:name", start, detail?)`** — a `kanzo:area:name` User Timing measure from `start` (a
  `performance.now()` reading) to now; never throws.

The codes are written once in `problems.bnf`, published beside the code, and `src/problems.gen.ts` is
generated from it (`pnpm --filter @kanzo-tech/kernel gen`; `pnpm check:generated` fails on a diff).
