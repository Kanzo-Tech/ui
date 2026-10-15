---
"@kanzo-tech/auth": minor
---

**Breaking.** A request with neither `Sec-Fetch-Site` nor `Origin` is now refused (403) by the `api`
forwarder; it used to be let through. A browser sends one of the two on every same-origin request, so
the application is unaffected; a `curl`, a health probe or a test runner that called `/api/*` through
the application will get a 403. There is no option to allow it: call the API at its own origin with
its own credential.
