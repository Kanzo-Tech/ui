---
"@kanzo-tech/auth": minor
---

The realm (`services/auth`) no longer turns on standard token exchange for an application with an
API, and an `x-application` declaration no longer takes `backchannel_logout`: the edge asks for the
API's scope at sign-in, so the token it forwards already names the API, and oauth2-proxy has no
back-channel logout receiver. Remove `backchannel_logout` from your declaration (it is no longer
read), and stop exchanging tokens if you still do — ask for your API's scope in
`OAUTH2_PROXY_SCOPE` instead. `modules/app` no longer has the `backchannel_logout_url` variable, and
a `PUBLIC` client may now list `apis`.
