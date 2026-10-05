---
"@kanzo-tech/auth": minor
---

**One door for the Next BFF: `kanzoAuth`.** Breaking. The proxy is now the session authority: it
renews the access token in place before a page renders, ends a session the IdP refused to renew
(dropping its ticket and clearing the cookie), and sends a navigation to sign in carrying its URL —
or answers a bare 401 to a prefetch, a server action or an RSC fetch (`Sec-Fetch-Mode`). Closes #33
and the zombie session a refused refresh used to leave behind.

Also new: back-channel logout (`POST <basePath>/backchannel-logout`, OpenID Connect Back-Channel
Logout 1.0), a transaction cookie per `state` so parallel sign-ins both finish, a tenant resolver
(`organization`) whose answer is `Session.organization`, and `can` / `useSession().can` / `Gate`
asking inside that tenant by default.

### Migrating

- **Five factories → one object.** `authRoutes`, `authSession`, `authToken`, `authProxy`,
  `authMiddleware` and `signInUrl` are gone:

  ```ts
  // lib/auth.ts
  export const auth = kanzoAuth(async () => ({
    issuer, clientId, clientSecret, secret, store,
    problemPage: "/auth/problem", public: ["/health"],
    api: { mount: "/api/data", target: API_URL },   // was authProxy({ basePath, target })
    organization: ({ url }) => url.hostname.split(".")[0], // optional
  }));
  // proxy.ts (was middleware.ts + authMiddleware)
  export const proxy = (request: NextRequest) => auth.proxy(request);
  // app/api/auth/[...auth]/route.ts
  export const { GET, POST } = auth.routes;               // was authRoutes(config)
  // app/api/data/[...path]/route.ts
  export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = auth.api;
  // server components
  const session = await auth.session();                   // was getSession()
  const session = await auth.session({ required: true }); // was if (!s) redirect(await signInUrl())
  ```

  `authToken` has no replacement for a route of your own: forward through `auth.api`, or call
  `relyingParty(...).token(cookie)` from `./server`, which now answers `Token | Ended`.
- **`next` 16 or later** is required (its proxy runs on Node).
- **`./browser` and `browserAuth` are removed**, with the `oidc-client-ts` peer. Use `bffAuth` behind
  `kanzoAuth`. `authFetch`, `TokenSource`, `useOrganization` and `organizationFromHost` are removed:
  `auth.fetch` from `bffAuth` is the authenticated fetch, and the current organization is
  `session.organization` from the server's resolver.
- **`bffAuth` signs in once when a renewal is refused**, coming back to the page. Delete any
  `401 → signIn()` branch in your data client.
- **`can(session, role)` asks inside `session.organization`** when the session carries one; read
  realm roles from `session.roles` there. `useSession()` also returns `can(role, organization?)`.
- **`./server`**: `relyingParty` no longer takes `redirectUri`; `begin` and `complete` take it per
  call. `refresh` and `token` answer `{ ended: true, code, cookies }` instead of throwing when there
  is no live session. The default scope is `openid profile email organization:*`.
  `Session.expiresAt` is the access token's expiry.
- **`SessionStore`** gains `update(ticket, record)` (renewal keeps the ticket) and
  `dropAll({ sub, sid? })`; `TicketAdapter` gains `replace(key, value, ttl)` — a conditional
  write (Redis `SET … XX`), so a renewal never brings back a session a back-channel logout ended —
  and an optional `keys(prefix)` for back-channel logout. Tickets are now `<sub>:<sid>:<random>`, so sessions issued before the upgrade are not found
  by `dropAll` (they still read until they expire).
- **Error codes**: `organization/not-a-member` is removed; `token/refused` and
  `session/irrevocable` are new.
- **Keycloak module**: `services/auth/modules/app` takes `backchannel_logout_url`.
