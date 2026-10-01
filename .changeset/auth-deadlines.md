---
"@kanzo-tech/auth": minor
---

**Every wait on the IdP or the BFF ends in 30 s, and says who did not answer.** Three codes are new:
`idp/silent` (the IdP did not answer within `data.after` = 30000 ms), `session/silent` (`/session` or
`/refresh` did not, likewise) and `idp/unreachable` (the IdP could not be reached, or answered a
5xx or a page that is not OAuth). `bffAuth`'s requests to `/session` and `/refresh` are cut at 30 s;
`browserAuth` sets `oidc-client-ts`'s `requestTimeoutInSeconds` to 30, which also moves its silent
renewal from 10 s to 30 s.

`browserAuth` no longer reads every failed silent renewal or callback as signed out: it resolves
`null` only for the IdP's `login_required`, `interaction_required`, `consent_required`,
`account_selection_required` or `invalid_grant`, and for a callback URL whose `state` this tab does
not hold. Anything else rejects `getSession()` — `idp/silent`, `idp/unreachable`, or
`token/exchange-failed` for a refusal — with the library's error as `cause`. On the server,
`relyingParty` codes a discovery failure and an unanswered token request the same way where it used
to throw an uncoded error from `begin` and `end`, or `token/exchange-failed` from `complete` and
`refresh`; `authRoutes` answers them 502 or 504 on `/refresh`.

The `timeout` option on `relyingParty` and `issuer` is gone: the figure is fixed at 30 s. Delete it
from your config if you passed one.
