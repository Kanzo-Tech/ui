# @kanzo-tech/auth

Authentication over Keycloak: the claim vocabulary read into one session, the role evaluation that
knows about organizations, and an authenticated `fetch`.

## What it is not

**There is no sign-in screen.** That is the shape of the package rather than a gap in it. A sign-in
screen is a logo, a legal line, a privacy notice and a button, and every product answers those
differently — `@kanzo-tech/ui` has the parts to draw one. What is genuinely shared sits underneath,
and that is what is here.

**There is no protocol in it either.** PKCE, silent renewal, token storage and cross-tab
coordination are `oidc-client-ts`'s job, behind `./browser`; the confidential client is
`openid-client`'s, behind `./server`. Writing either by hand is where mistakes turn into
vulnerabilities, and neither is what this package is for.

What is left after those two subtractions is everything this package is: **Keycloak's claims as one
`Session`, a role predicate that understands organizations, one `fetch` that stays authenticated,
and the same session shape across two deployment patterns that otherwise share no code.**

## Why a package, and not `@kanzo-tech/ui`

The [first admission rule](https://kanzo-tech.github.io/ui/docs/philosophy#admission) is *domain-free
— nothing about RDF / SHACL / fossil / graphs / **auth***. Auth is excluded by name, deliberately:
`ui` is the generic vocabulary every product shares. The rule was written after a sidebar composite
shipped a hard-coded log-out flow, confirmation dialog and untranslatable copy included.

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

That is the whole of it for a single-page application: the root barrel carries no engine. The other
doors each name theirs — `oidc-client-ts` for `./browser`, `openid-client` and `jose` for
`./server`, `next` for `./next` — and a consumer installs only the one it opens.

## The claims it reads

Nothing here is invented. Every claim is one Keycloak emits without being asked:

| claim | becomes |
| --- | --- |
| `sub`, `email`, `name` (or `given_name` + `family_name`), `preferred_username` | `session.user` |
| `realm_access.roles` ∪ `resource_access.<clientId>.roles` | `session.roles` |
| `organization` — `{ "acme": { "id": "…", "groups": ["/keasy/owner"] } }` | `session.organizations` |
| `exp` | `session.expiresAt`, in milliseconds |

A group path's **first segment is the application**: `/keasy/owner` is a role in keasy, `/hub/reader`
is not, and a single-segment `/owner` is granted across all of them. Without that filtering, a role
held in one application would authorise its holder in another.

Ask Keycloak for `organization:*` to receive every organization the person belongs to. Plain
`organization` returns the only one when there is one and prompts for a choice when there are
several, which is the documented behaviour behind more than one bug report about the claim
"disappearing".

## Membership is in the session; the active organization is not

```ts
interface Session {
  user: AuthUser;
  roles: readonly string[];
  organizations: readonly Organization[];
  expiresAt: number;
}
```

There is no active organization on it, and the absence is deliberate. Membership is stable and comes
from the token; which organization you are *looking at* is a property of the request — the URL — and
deriving it per request is what lets two tabs sit in two organizations at once. A field here would
be the single shared value they would fight over.

Roles held inside an organization live on that organization, and are never merged into
`session.roles`. Being an owner of one organization says nothing about another.

```ts
can(session, "auditor");           // a realm or client role
can(session, "owner", "acme");     // a role inside that organization
```

There is no role hierarchy in the predicate. That `owner` outranks `member` is a fact about a
product, so a product writes it where it can be seen:

```ts
const isMember = (org: string) => can(session, "owner", org) || can(session, "member", org);
```
