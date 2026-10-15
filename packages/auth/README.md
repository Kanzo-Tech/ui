# @kanzo-tech/auth

The person behind the platform's edge, over Keycloak: the access token oauth2-proxy forwards,
verified and read into one session on the server, handed to the browser, and the role evaluation
that knows about organizations. `kanzoAuth` is the whole of it for Next.

## What it is not

**There is no sign-in screen.** That is the shape of the package rather than a gap in it. A sign-in
screen is a logo, a legal line, a privacy notice and a button, and every product answers those
differently — `@kanzo-tech/ui` has the parts to draw one. What is genuinely shared sits underneath,
and that is what is here.

**There is no relying party in it either.** oauth2-proxy, a platform service in front of the
application (`services/auth`, `auth-proxy`), signs the person in with PKCE, keeps the session in
Valkey behind an opaque cookie, renews it and signs out at Keycloak. The application holds no client
secret, no session and no refresh token.

What is left after those two subtractions is everything this package is: **the forwarded access
token verified against the realm's keys and read into one `Session`, handed to the browser as a prop,
a role predicate that understands organizations, a forwarder to the application's API, and a CSP
nonce.**

## Why a package, and not `@kanzo-tech/ui`

The [first admission rule](https://kanzo-tech.github.io/ui/docs/philosophy#admission) is *domain-free
— nothing about RDF / SHACL / fossil / graphs / **auth***. Auth is excluded by name, deliberately:
`ui` is the generic vocabulary every product shares, and a sidebar composite that carries a log-out
flow ships a hard-coded confirmation dialog and untranslatable copy with it.

## The one rule to read first

**What a client knows about its roles is for drawing, never for deciding.**

The roles in a `Session` are a copy, and a copy is something an attacker controls the moment it
reaches the browser. `can` hides a button; the resource server, validating the access token it was
sent, is what refuses the request behind it. A product that gates only in the browser has not gated
anything.

The same rule one level down: **the browser never holds the access token.** The server verifies the
token the edge forwards — signature, `iss`, `exp`, and `azp` naming the application — and the
`Session` it hands the browser holds no token.

## Install

```sh
pnpm add @kanzo-tech/auth jose
```

The root barrel carries no engine. The server doors name theirs — `jose` for `./server`, and `next`
16 or later as well for `./next` — and a consumer installs only what it opens.

```tsx
// lib/auth.ts
export const auth = kanzoAuth(async () => ({ issuer, clientId, jwks }));
// proxy.ts
export const proxy = (request: NextRequest) => auth.proxy(request);
// app/layout.tsx
<AuthProvider session={await auth.session()}>{children}</AuthProvider>
// anywhere in the browser
const { session, can, signOutUrl } = useSession();
```

## The claims it reads

Nothing here is invented. Every claim is one Keycloak emits without being asked:

| claim | becomes |
| --- | --- |
| `sub`, `email`, `name` (or `given_name` + `family_name`), `preferred_username` | `session.user` |
| `realm_access.roles` ∪ `resource_access.<clientId>.roles` | `session.roles` |
| `organization` — `{ "acme": { "id": "…", "resource_access": { "<clientId>": { "roles": ["editor"] } } } }` | `session.organizations` |
| `organization.<alias>.groups`, `.groups_overage` — from the platform's mapper | that organization's `groups` (ids) and `groupsOverage` |
| `exp` | `session.expiresAt`, in milliseconds: when the access token expires |

Inside each organization, `resource_access.<clientId>.roles` is what the person holds **there**:
the roles an organization admin mapped onto the groups they are in, composites expanded by
Keycloak. Group names are never read — they are the organization's own business — and another
application's roles in the same entry are ignored, so a role held in one application never
authorises its holder in another. Nor are they merged into `session.roles`: a role in one
organization says nothing about the next.

`groups` on each organization are the **ids** of the groups the person is in there, for an
application that grants to a group; the platform's Keycloak mapper writes them (`services/auth/mappers`),
and a path — what Keycloak writes there without it — is never read. Past the mapper's threshold the
entry says `groupsOverage: true` and carries none, Entra ID's overage rule: that empty list means
*ask the realm*, with a service account of the application's own.

The edge asks Keycloak for `organization:*` at sign-in (`OAUTH2_PROXY_SCOPE`), which returns every
organization the person belongs to. Plain `organization` returns the only one when there is one and prompts for a choice
when there are several, which is the documented behaviour behind more than one bug report about the
claim "disappearing".

## Membership is stored; the current organization is resolved per request

```ts
interface Session {
  user: AuthUser;
  roles: readonly string[];
  organizations: readonly Organization[];
  organization?: string; // the tenant this request addresses
  expiresAt: number;
}
```

Membership is stable and comes from the token. Which organization a request is *in* is a property
of the request — its host, its path, a cookie — so `kanzoAuth`'s `organization` resolver answers it
per request and it is never stored. That is what lets two tabs sit in two organizations at once.

Roles held inside an organization live on that organization, and are never merged into
`session.roles`. Being an owner of one organization says nothing about another.

```ts
can(session, "editor");            // inside session.organization, the current tenant
can(session, "owner", "acme");     // inside that organization
```

With no current tenant, `can` answers from the realm and client roles.

There is no role hierarchy in the predicate. That `owner` outranks `member` is a fact about a
product, so a product writes it where it can be seen:

```ts
const isMember = (org: string) => can(session, "owner", org) || can(session, "member", org);
```
