---
"@kanzo-tech/auth": patch
---

**`auth.api` no longer forwards the browser's `Origin` and `Sec-Fetch-*` headers to the resource
server.** The request the forwarder makes is the server's own, so an upstream that checks `Origin`
no longer refuses it for a page it was never addressed by: through the AI gateway, Docker Model
Runner answered every model call from a tenant host such as `acme.localhost` with 403 `Origin not
allowed`. Nothing to edit; a resource server that read either header was reading the browser's
claim about the BFF's own page, which the forwarder has already checked.
