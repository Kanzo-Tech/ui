---
"@kanzo-tech/auth": minor
---

**`AuthErrorCode` is spelled `area/kind`.** Every code is renamed, in `error.code`, in the `error`
field of `authRoutes`' JSON answers and in the new `?code=` of its redirects:

- `claims.no-subject` → `claims/no-subject`
- `session.absent` → `session/absent`
- `organization.not-a-member` → `organization/not-a-member`
- `organization.invalid` → `organization/invalid`
- `callback.state-mismatch` → `callback/state-mismatch`
- `callback.nonce-mismatch` → `callback/nonce-mismatch`
- `token.exchange-failed` → `token/exchange-failed`

Replace the dot with a slash wherever you compare against one. `AuthError` also takes an optional
`data` and `ErrorOptions` — `new AuthError(code, message, data?, { cause }?)` — and its `cause` is
set through `ErrorOptions`.
