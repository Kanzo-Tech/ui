---
"@kanzo-tech/auth": minor
---

**An API now receives a token for itself and one organization, never the session's own token.**
Breaking for a product that configures `api` or calls `token` or `refresh` with `renewWithin`.

- `kanzoAuth`'s `api: { mount, target }` is now `apis`, keyed by mount, and each entry names its
  `audience`: `apis: { "/api": { audience: "board-api", target } }`. One route file
  (`app/api/[...path]/route.ts` exporting `auth.api`) serves every mount; the longest mount wins.
  The forwarder exchanges the session's token (RFC 8693, Keycloak's standard token exchange) for one
  whose `aud` is that API and whose organization is the one the request addresses. It answers 403
  when the person is not a member of that organization, and 502 when the realm will not exchange
  for the audience.
- `relyingParty().token(cookie, options)` takes `{ audience, organization?, renewWithin? }` and
  answers the exchanged token. The session's own access token is no longer returned by any method.
- `refresh(cookie, { renewWithin })` renews only when the session is inside that window; without
  it, `refresh` renews now, as before. Use it where you called `token` only to keep a session alive.
- New error code `organization/denied`.
- In the realm, register each API with `services/auth/modules/api` and list it in the
  application's `modules/app` `apis`, which replaces `audience`. The application's client must be
  `CONFIDENTIAL`. Your API keeps validating `aud` against its own client id, and keeps reading
  roles where it did.
