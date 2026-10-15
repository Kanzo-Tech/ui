---
"@kanzo-tech/auth": minor
---

`kanzoAuth` takes a `csp` option: the Content-Security-Policy directives your application sends, as
`{ "default-src": ["'self'"], "script-src": ["'wasm-unsafe-eval'"], … }`. `auth.proxy` draws a fresh
128-bit nonce for every request, adds `'nonce-…' 'strict-dynamic'` in front of your `script-src`
sources, puts the policy on the request it forwards (the header Next reads to nonce its own scripts)
and on the response, and forwards the nonce as `x-nonce` for a server component that needs it. An
`'unsafe-inline'` in `script-src` throws when the config is first read. Move your policy from
`next.config.ts` into `csp`, remove `'unsafe-inline'` from `script-src`, and give `worker-src` and
`connect-src` explicitly; a browser without CSP Level 3 support does not run your scripts. A page
that carries a nonce renders per request and cannot be served as static HTML.
