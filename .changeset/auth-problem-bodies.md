---
"@kanzo-tech/auth": minor
---

Every refusal the auth routes, the API forwarder and the proxy send is an RFC 9457 problem — `application/problem+json` with `status`, `title`, `detail` and the `AuthErrorCode` as `code` — and every code has one status everywhere (`organization/denied` is 403 from the routes as from the forwarder). The forwarder now names the code it refused with, so you can route `organization/denied` or `token/exchange-failed` instead of coining your own code for a bare status. **Breaking:** read `code` and `detail` where you read `{ error, message }`; a forwarder or proxy refusal that had no body now carries one.
