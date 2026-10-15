---
"@kanzo-tech/auth": minor
---

**Breaking.** A request with neither `Sec-Fetch-Site` nor `Origin` is now refused (403) on `session`,
`refresh` and `signout` and on the `api` forwarder; it used to be let through. A browser sends one of
the two on every same-origin request, so the application is unaffected; a `curl`, a health probe or a
test runner that called `/api/*` or an auth route through the BFF will get a 403. There is no option
to allow it: only the browser calls the BFF, so call the API at its own origin with its own
credential. `signin`, `callback` and `backchannel-logout` stay open to cross-site requests, as they
must be.
