---
"@kanzo-tech/auth": patch
---

**A deployment that answers on several hosts now signs in on the one the browser is on.** Next
builds `request.url` from the address the server listens on, so a request for
`acme.example.com` could reach `kanzoAuth` as `http://localhost:3000`. The callback URL, the
redirect to sign in, the `x-kanzo-url` a server component reads, the same-origin check and the URL
the `organization` resolver is handed now take their host from
`X-Forwarded-Host`, else `Host`, and their scheme from `X-Forwarded-Proto`, the headers Auth.js
reads, so a proxy that terminates TLS no longer turns the callback into `http`. A deployment that passes `redirectUri` changes
nothing; one that serves a single host sees the same URLs as before.
