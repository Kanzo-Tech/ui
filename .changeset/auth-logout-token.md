---
"@kanzo-tech/auth": minor
---

The back-channel logout route is stricter about what it accepts. It refuses (400) a body over 8 KB, a
content type other than `application/x-www-form-urlencoded`, a logout token with no `jti`, a token
whose `typ` header is present and is not `logout+jwt` (an absent `typ` is accepted), and a token whose
`jti` it has already seen; a replay would otherwise end the sessions the person opened since. The `jti`
is remembered through your `ticketStore` adapter under `logout-jti.<jti>` until the token's `exp`.

**Breaking, for a hand-written `SessionStore`:** the interface has a sixth method,
`seen(jti, ttl): Promise<boolean>`, which says whether a logout token's `jti` was already presented and
remembers it if not. `ticketStore` and `statelessStore` implement it; a store you wrote yourself must
too. An adapter without `keys` now refuses the logout (501) before it spends the `jti`.
