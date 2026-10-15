---
"@kanzo-tech/auth": minor
---

New door `@kanzo-tech/auth/testing`, exporting `fakeAuth(session, { fetch? })`: an `Auth` with no
protocol behind it, for a test or a documentation page. It answers the session it was given, `signIn`
signs in as that session, `signOut` signs out, and `set(session | null)` replaces the session and tells
every subscriber. Make the session with `claims()` from `@kanzo-tech/auth/server` so a test draws what
a token produces, and delete a hand-written `Auth` double.

`claims()` and the browser's reading of the session route are now one reader; a field either side
dropped used to become a silent default (`expiresAt` is `0`), and a round-trip test now fails instead.
