---
"@kanzo-tech/auth": minor
---

**`@kanzo-tech/auth` — authentication over Keycloak, in four doors.**

A new package holding what every product was about to write for itself: Keycloak's claims read into
one `Session`, a role predicate that understands organizations, and a `fetch` that stays
authenticated. It depends on nothing else in this repository — not even `@kanzo-tech/ui` — and
nothing here may import it.

**It ships no sign-in screen, and that is the shape of it rather than a gap.** A sign-in screen is a
logo, a legal line, a privacy notice and a button, and every product answers those differently;
`@kanzo-tech/ui` has the parts to draw one. It ships no protocol either: PKCE, silent renewal,
storage and cross-tab coordination are `oidc-client-ts`'s, and the confidential client is
`openid-client`'s. What is left after both subtractions is the whole package.

**Adding authentication to an application is five lines.**

```ts
export const auth = browserAuth({ issuer, clientId: "viewer" });  // or bffAuth({ basePath })
```
```tsx
<AuthProvider auth={auth}><App /></AuthProvider>
```
```ts
createClient<paths>({ baseUrl: "/", fetch: auth.fetch });
```
```tsx
const { session, status } = useSession();          // branch on `status`, not on `session === null`
<Gate role="owner" organization="acme"><DangerButton /></Gate>
```

Switching between the two deployment patterns RFC 10017 describes changes the first line and nothing
else: `auth.fetch`, `useSession` and `Gate` are the same either way.

**Four doors, one engine each, so a consumer pays only for the one it opens.**

| door | what it is | install alongside |
| --- | --- | --- |
| `.` | the session, the hooks, `Gate`, the `fetch`, and `bffAuth` | nothing but `react` |
| `./browser` | a public client with PKCE, for a SPA with no server | `oidc-client-ts` |
| `./server` | the confidential client, framework-agnostic | `openid-client`, `jose` |
| `./next` | App Router routes, middleware and `getSession()` | `next` |

The root barrel names none of them, and `pnpm smoke` asserts that against the packed tarball rather
than trusting this paragraph.

**Three things to know before you wire it up.**

**Your roles are for drawing, never for deciding.** The roles in a `Session` are a copy, and a copy
is something an attacker controls the moment it reaches the browser. `Gate` hides a control; the
resource server, validating the access token it was sent, is what refuses the request. Never read
the access token in a client either — it is opaque by definition and may be encrypted for the
resource.

**Membership is on the session; the active organization is not.** Which organizations you belong to
comes from the token and is stable. Which one you are *looking at* is a property of the request, so
`useOrganization()` derives it from the URL and resolves it against your memberships. That is what
lets two tabs sit in two organizations at once, and a hostname you are not a member of resolves to
`undefined` rather than quietly falling back to your first.

**Ask Keycloak for `organization:*`.** Plain `organization` returns the single organization when
there is one, and stops the flow on a chooser when there are several. The first path segment of an
organization group is the application — `/keasy/owner` is a role in keasy and `/hub/reader` is not —
and roles held inside an organization are never merged into your realm and client roles.
