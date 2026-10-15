---
"@kanzo-tech/auth": minor
---

The platform services (`services/auth`) now include the session's edge: `auth-proxy` (oauth2-proxy
7.15.5) and its `auth-valkey`. An application extends `auth-proxy` as it extends `auth-realm`: its
client in `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_SCOPE` naming its API's scope, its
`OAUTH2_PROXY_UPSTREAMS` and `OAUTH2_PROXY_PROXY_PREFIX`, the secrets `auth-proxy-client` and
`auth-proxy-cookie`, and the port the browser reaches. Nothing changes for an application that does
not extend it.
