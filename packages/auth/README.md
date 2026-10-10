# @kanzo-tech/auth

Authentication over Keycloak: a Backend For Frontend for Next in one object, `kanzoAuth`, the claim
vocabulary read into one session, and the role evaluation that knows about organizations.

## What it is not

**There is no sign-in screen.** That is the shape of the package rather than a gap in it. A sign-in
screen is a logo, a legal line, a privacy notice and a button, and every product answers those
differently — `@kanzo-tech/ui` has the parts to draw one. What is genuinely shared sits underneath,
and that is what is here.

**There is no protocol in it either.** The confidential client is `openid-client`'s, behind
`./server`, and the browser holds a cookie and no token — RFC 10017's Backend For Frontend, the
architecture it recommends for business applications. Writing OAuth by hand is where mistakes turn
into vulnerabilities, and it is not what this package is for.

What is left after those two subtractions is everything this package is: **Keycloak's claims as one
`Session`, a role predicate that understands organizations, and the session lifecycle around them —
a proxy that renews and ends sessions, back-channel logout, and a browser half that signs in once
when a session is over.**

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

The same rule one level down: **never read the access token in the client.** It is opaque to a
client by definition, its format is not guaranteed, and it may be encrypted for the resource —
depending on its contents is, in Microsoft's words for the same mistake, *"one of the most common
sources of errors and client logic breakage."* Roles for drawing come from the session, not from
prising open a token.

## Install

```sh
pnpm add @kanzo-tech/auth
```

The root barrel carries no engine. The server doors name theirs — `openid-client` and `jose` for
`./server`, and `next` 16 or later as well for `./next` — and a consumer installs only what it
opens.

```ts
// lib/auth.ts
export const auth = kanzoAuth(async () => ({ issuer, clientId, clientSecret, secret, store }));
// proxy.ts
export const proxy = (request: NextRequest) => auth.proxy(request);
// app/api/auth/[...auth]/route.ts
export const { GET, POST } = auth.routes;
```

## The claims it reads

Nothing here is invented. Every claim is one Keycloak emits without being asked:

| claim | becomes |
| --- | --- |
| `sub`, `email`, `name` (or `given_name` + `family_name`), `preferred_username` | `session.user` |
| `realm_access.roles` ∪ `resource_access.<clientId>.roles` | `session.roles` |
| `organization` — `{ "acme": { "id": "…", "resource_access": { "<clientId>": { "roles": ["editor"] } } } }` | `session.organizations` |
| `organization.<alias>.groups`, `.groups_overage` — from the platform's mapper | that organization's `groups` (ids) and `groupsOverage` |
| `sid` | the session record, for back-channel logout |
| — the token response's `expires_in` | `session.expiresAt`, in milliseconds: when the access token expires |

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
*ask the realm*, and `organizationGroups` on `./server` is a sketch of asking.

Every sign-in asks Keycloak for `organization:*`, which returns every organization the person
belongs to. Plain `organization` returns the only one when there is one and prompts for a choice
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
