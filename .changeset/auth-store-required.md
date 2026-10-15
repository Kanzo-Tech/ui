---
"@kanzo-tech/auth": minor
---

**Breaking.** `kanzoAuth` requires `store` whenever `apis` is configured, in its type and at runtime:
it throws, when it is first built, if `apis` has a mount and `store` is absent. The stateless default
cannot hold an access token (a realistic record is 6407 bytes against the 4096 a browser keeps, and the
seal threw at the callback, after a successful login, for a person in many organizations) and cannot
end a session. Give such an application a `ticketStore` over your Redis or SQL adapter. An application
with no `apis` is unchanged and keeps the stateless default; `statelessStore()` stays exported as an
explicit choice.
