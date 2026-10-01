---
"@kanzo-tech/auth": minor
---

**A session endpoint that fails is a failure, not "nobody is signed in".** `bffAuth().getSession()`
used to resolve `null` for anything but a session; now only a 401 means no session. A 5xx, a 200
whose body is not a session, or a request that never reached the server rejects with an `AuthError`
coded `session/unavailable` — `data.status` holds the status when there was one, and `cause` what the
network threw. A failed read is not kept: the next `getSession()` asks again. A 5xx from `/refresh`
rejects the request `auth.fetch` was making with the same code, instead of ending the session.

On the server, a `SessionStore` that throws now fails as `session/unavailable` with the driver's
error as `cause`; `authRoutes`' `/session` answers it 503 with `{ error, message }` instead of a
bare 500, and `authProxy` answers an outage 503, 502 or 504 instead of a 401.
