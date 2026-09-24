---
"@kanzo-tech/auth": minor
---

**A session can now be renewed, and it can now be revoked.** The pieces were here and the doors
were not: `relyingParty.refresh` rotated the token, `singleFlight` was written for exactly the
failure that path has, and nothing called either.

**`authRoutes` serves a fifth route, `POST /refresh`.** `bffAuth` drives it without your product
orchestrating anything: a 401 from a request of its own is taken as "renew and try again" first,
and as "the session is gone" only once the renewal is refused. Without it, a cookie good for eight
hours in front of an access token good for one gives you seven hours in which `/session` answers
200, the whole application draws, and every request for data is a 401 nothing recovers from.

**Two new doors on `./next`.** `authToken(config)` answers the access token a route handler should
forward, renewing it when it is within a minute of expiry; `authProxy({ target, basePath })` is the
whole BFF-to-resource-server handler — hop-by-hop headers stripped, body streamed with
`duplex: "half"`, `redirect: "manual"`, and the session cookie **not** forwarded, which is the line
that stops your resource server receiving a second credential beside the bearer token it asked for.

**`ticketStore(adapter)` makes a sign-out a sign-out.** Two functions and a delete over your own
database; the cookie then carries an opaque ticket and `drop` deletes, so every copy of that cookie
ends at once. `statelessStore` remains the default and remains unable to do this — the ticket *is*
the record there — and now says so with the numbers.

---

### What breaks for a consumer of `0.4.0`

**`SessionRecord` carries the access token, and the stateless cookie no longer fits.** Measured,
not estimated: a realistic Keycloak record — one person, two organizations, the roles that come
with them — seals to **6407 bytes** against the 4096 a browser is required to keep. It sealed to
**4068** before the access token joined it, which was 28 bytes of margin and never a design.

So **if your product calls a resource server, you must give `relyingParty` a `ticketStore`**:

```ts
relyingParty({
  …,
  store: ticketStore({
    read: (key) => redis.get(key),
    write: (key, value, ttl) => redis.set(key, value, { EX: ttl }),
    delete: (key) => redis.del(key),
  }),
});
```

The failure is loud rather than silent — sealing throws with the byte count, at the callback, on
the first sign-in after upgrading — but it *is* a failure, and it will be the first thing you see.
A product that only reads identity and calls no API is unaffected.

**`bffAuth`'s `fetch` now retries once.** A 401 it can renew past no longer reaches your caller. If
you had code reading a 401 from `auth.fetch` as "signed out", it now only sees one when the renewal
was refused too — which is what that reading always meant.

**`relyingParty.begin` refuses an organization that is not an alias.** `?organization=x offline_access`
was scope injection: `scope` is a space-delimited list, so the space was not part of a strange
alias, it was a second scope asking for a refresh token that outlives the browser session. Anything
that is not `[A-Za-z0-9._-]` or `*` now throws `organization.invalid`, and `authRoutes` answers 400
rather than 500. A realm whose aliases are outside that set is the one case this breaks.

**`authRoutes` answers 403 to a cross-site `/session`, `/refresh` or `/signout`.** The cookie is
`SameSite=Lax` — `Strict` would break every sign-in — and what `Lax` costs is that a cross-site
*top-level navigation* still carries the cookie, so `<img src="…/api/auth/signout">` on any page
anywhere was a logout anyone could cause. `/callback` and `/signin` are still reachable from
anywhere, because the first *is* a cross-site navigation and the second grants nothing. A request
carrying neither `Sec-Fetch-Site` nor `Origin` is still allowed, so server-to-server callers and
health probes are unaffected.

**`/refresh` answers 405 to a `GET`.** It is the only route that constrains its verb, because it is
the only one that spends something.

**`@kanzo-tech/auth/next` exports five names rather than three**, and `RelyingParty` has six
methods rather than five. Nothing was renamed or removed.
