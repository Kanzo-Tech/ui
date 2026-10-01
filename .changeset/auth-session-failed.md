---
"@kanzo-tech/auth": minor
---

**A session that cannot be read is `"failed"`, not `"anonymous"`.** When `getSession` rejects — the
IdP or the session store is down, the network dropped — `AuthProvider` now settles on
`status: "failed"`, and `useSession()` carries what was thrown, untouched, on a new `error: unknown`
field (`undefined` otherwise). It used to settle on `"anonymous"`, which sent the person to sign in
over an outage. `AuthStatus` gains `"failed"`: a `switch` over it that was exhaustive no longer is.
Render your problem view for `"failed"`, keyed on `error`'s `code` when it is an `AuthError`. `Gate`
draws neither its children nor its fallback while the status is `"failed"`.
