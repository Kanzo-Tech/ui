# @kanzo-tech/problems

Layer 0: the one failure every other package throws, and the one bounded wait. It imports nothing,
declares no dependency and no peer, touches no DOM, and does nothing at import. The argument is
`/docs/design/problems`.

```ts
import { Problem, isProblem, isCode, within, until } from "@kanzo-tech/problems";
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

The codes are written once in `problems.bnf`, published beside the code, and `src/problems.gen.ts` is
generated from it (`pnpm --filter @kanzo-tech/problems gen`; `pnpm check:generated` fails on a diff).
