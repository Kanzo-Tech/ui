---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/llm": minor
"@kanzo-tech/auth": minor
---

Every failure these packages name is now the kernel's `Problem` (RFC 9457), and `EngineError`,
`GraphError`, `LlmError` and `AuthError` are gone, with `AuthErrorCode`. Where you wrote
`error instanceof LlmError`, write `isProblem(error, "llm/unavailable")` with `isProblem` from
`@kanzo-tech/kernel` (add it to your dependencies); `error.code` and `error.data` are as they were.
`isProblem(error)` with no code matches any of them, and a `Problem` serialises with
`JSON.stringify` as `application/problem+json`. `engine/unavailable`'s `data.after` is now optional,
as it always was in practice: it is set only when the deadline fired.

The auth forwarder answers with that same body: it now carries `type` and
`severity`, and `title` is the code's own title ("Nobody is signed in") where it was the status's
phrase ("Unauthorized"). Route on `code`, as before.

The misses `JoinResolver` returns are renamed to the registry's words: `join/no-step` is `relations/no-step`,
`join/no-field` is `relations/unmatched` and `join/branches` is `relations/invalid`. Rename any branch
on `miss.code`; the shape of a miss is unchanged. `JoinError` is gone: a crossing that cannot walk its
relation throws a `Problem` coded `relations/no-step`.
