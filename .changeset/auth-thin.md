---
"@kanzo-tech/auth": minor
"@kanzo-tech/kernel": minor
---

**Breaking.** `@kanzo-tech/auth` no longer signs anyone in: the platform's `auth-proxy`
(oauth2-proxy, in `services/auth`) is the relying party in front of your application, and the package
reads the person from the access token it forwards.

What a host does:

- **Extend `auth-proxy`** in your Compose project, from the override file that already hands
  `auth-realm` your declarations: `OAUTH2_PROXY_CLIENT_ID` (your client), `OAUTH2_PROXY_SCOPE`
  (`openid email profile organization:* <your api>`: your API's scope puts it in the token's `aud`),
  `OAUTH2_PROXY_UPSTREAMS` (your application), `OAUTH2_PROXY_PROXY_PREFIX` (your callback minus
  `/callback`, `/api/auth` if you kept the default), `OAUTH2_PROXY_WHITELIST_DOMAINS`, and
  `OAUTH2_PROXY_API_ROUTES` for your `/api`, with the secrets `auth-proxy-client` and
  `auth-proxy-cookie`. Point the browser at the proxy, not at the application.
- **Drop your session store and your secrets** from the application: the Redis or SQL `ticketStore`
  adapter, the cookie secret and the client secret. Unregister your back-channel logout URL.
- **Use the token.** `kanzoAuth` takes `{ issuer, clientId, jwks?, prefix?, organization?,
  problemPage?, csp?, apis? }`; `jwks` is where your server reaches the realm's keys
  (`http://keycloak:8080/realms/kanzo/protocol/openid-connect/certs` in Compose). Every read verifies
  the forwarded token's signature, `iss`, `exp` and `azp`. `clientSecret`, `privateKey`, `secret`,
  `store`, `internalOrigin`, `allowInsecureHttp`, `verifySignatures`, `redirectUri`, `renewWithin`,
  `scope`, `public` and `staticExtensions` are gone; an `apis` mount loses `audience`, and the
  forwarder sends the forwarded token as the bearer, with no exchange. It refuses an organization the
  token does not name with `organization/denied`.
- **Delete `app/api/auth/[...auth]/route.ts`**: `auth.routes` is gone, and the proxy serves
  `sign_in`, `sign_out` and `callback` under its prefix. `auth.proxy` no longer signs in or renews; it
  forwards the URL and the CSP nonce.
- **Hand the session to the provider**: `<AuthProvider session={await auth.session()}>` in your server
  layout replaces `<AuthProvider auth={bffAuth()}>`. `useSession()` answers
  `{ session, can, signInUrl, signOutUrl }`; render the two URLs as links. There is no `status`
  (the session is there from the first render), no `signIn`/`signOut` and no `fetch`: call your API
  with the platform's `fetch`, and a request whose session ended answers 401 from the proxy.
- `bffAuth`, the `Auth` type, `SignInOptions`, `fakeAuth` and the `@kanzo-tech/auth/testing` door are
  gone: a test passes a `Session` made with `claims()` to `AuthProvider`. On
  `@kanzo-tech/auth/server`, `relyingParty`, `issuer`, `ticketStore` and `statelessStore` are gone;
  `sessionReader(config)(headers)` reads the person from a request's headers.
- Uninstall `openid-client`; `@tanstack/react-query` is no longer a peer of `@kanzo-tech/auth`.
- The registry drops the codes nothing emits any more: `session/unavailable`, `session/silent`,
  `session/irrevocable`, `token/exchange-failed`, `organization/invalid`, `callback/state-mismatch`
  and `callback/nonce-mismatch`. Remove them from your error registry. A forwarded token that does
  not verify is `token/refused`; the realm's keys not answering is `idp/unreachable` or `idp/silent`.
