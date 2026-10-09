# Identity

Keycloak, and the platform realm as code. **One realm (`kanzo`), one client per application,
organizations as the tenant model.** An application is an OIDC client of the realm; a customer is
an organization inside it. `@kanzo-tech/auth` is the library that reads what this realm emits.

## Run it

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait   # Keycloak 26.8 on http://localhost:8080, realm applied, seeded
scripts/verify.sh                  # ana: a real PKCE login, and the claims checked
scripts/verify.sh fede             # a member of acme with no role there
scripts/verify.sh dan              # no organization; a client role held directly
docker compose -f compose.yaml -f compose.dev.yaml down -v        # gone, database and Terraform state together
```

`../compose.dev.yaml` runs this beside the AI gateway. Admin console: `http://localhost:8080/admin`,
`admin` / `admin`. `.env.example` lists what can be changed (port, versions, passwords); `KC_PORT`
moves the issuer with it.

[`compose.yaml`](compose.yaml) is the service as a deployment runs it too — Keycloak in production
mode behind the deployment's edge, `KC_HOSTNAME` its public origin, the passwords from the
environment — and [`compose.dev.yaml`](compose.dev.yaml) is what development adds: dev mode on
`:8080`, the declarations in [`dev/`](dev), and the seeded members.

## The contract

An application's roles **in an organization** are

```
organization[alias].resource_access[client_id].roles
```

on both the access token (what a resource server authorizes on) and the ID token (what an interface
draws from). Keycloak writes them there from the role mappings of the person's groups in that
organization — the Organization Group Membership mapper with `addGroupRoleMappings`, Keycloak ≥ 26.7
— with **composites expanded**. Verified against Keycloak 26.8.0 by `scripts/verify.sh`:

```json
"organization": {
  "acme":   { "id": "3fe7…", "groups": ["/Admins"],  "resource_access": { "kanzo-conformance": { "roles": ["high", "low"] } } },
  "globex": { "id": "94b6…", "groups": ["/Readers"], "resource_access": { "kanzo-conformance": { "roles": ["low"] } } }
}
```

- **Group names are never read.** They are the organization's own arrangement of its people
  ("Admins", "Data team"). An application learns roles, and an organization admin decides which of
  its groups hold them.
- **A role held in one organization says nothing about another,** and Keycloak keeps org-group roles
  out of the top-level `resource_access` (measured: empty for ana above).
- **A hierarchy is declared once,** as composite roles in the application's registration. The token
  carries the expanded set; an application asks whether a role is present and never ranks.
- **Ask for `organization:*`.** Plain `organization` prompts for a choice when a person belongs to
  several, and no code comes back until they pick.
- A disabled organization drops out of the claim (measured).

## Declaring an application and its organizations

The realm is applied from declarations, not tfvars ([`realm/declarations.tf`](realm/declarations.tf)):
YAML files mounted anywhere under `/declarations` in `auth-realm`. An organization is

```yaml
x-organization: { alias: acme, name: Acme Corporation, domain: acme.com }
```

on top of the compose file that runs the organization's own services, so the list of organizations
is written once, where they are deployed. An application declares itself from its own repository,
as a compose `configs` entry — interpolated, so its origin can differ between environments — with
its client's secret as a compose secret, and hands both to `auth-realm` from an override file of its
own (a `-f` file such as `compose.override.yaml`: a service an `include:` brings in cannot be
redefined in the including file, and a path in it resolves where the included file lives):

```yaml
configs:
  board:
    content: |
      x-application:
        client_id: board
        api: board-api                      # its own API (modules/api)
        apis: [ai-gateway]                  # the platform's APIs it also calls
        origin: ${BOARD_ORIGIN}             # e.g. https://{organization}.board.example.com
        callback: /api/auth/callback        # one redirect URI per organization
        backchannel_logout: http://web:3000/api/auth/backchannel-logout
        client_secret_file: /run/secrets/board-oidc
        roles:
          reader: {}
          editor: { composites: [reader] }
          admin: { composites: [editor] }

services:
  auth-realm:
    configs: [{ source: board, target: /declarations/board/application.yaml }]
    secrets: [board-oidc]
    volumes: ["./orgs:/declarations/board/organizations:ro"]
```

The secret is sent to Keycloak write-only and never kept in Terraform's state. [`dev/`](dev) is the
development realm's own declarations: two organizations and the conformance client.

The token the application signs in with names no API. Before each call its server exchanges it
(RFC 8693, Keycloak's standard token exchange) for one naming one API and one organization, and
`scripts/verify.sh` checks that on a live token. Then map the application's roles onto an
organization's groups — what an organization admin does in the console — with

```sh
scripts/map-group-role.sh acme Admins board admin
```

In development the seed does it: an application hands `auth-seed` a file shaped like
[`seed/seed.json`](seed/seed.json)'s `organizations` — its roles on the seeded groups — as a compose
`configs` entry at `/seed.d/<name>.json`, and the seed merges it in (`SEED_DIR`):

```json
{ "organizations": { "acme": { "groups": { "Admins": { "board": ["admin"] } } } } }
```

An organization group's role mappings live under the organization:
`POST /admin/realms/{realm}/organizations/{org}/groups/{group}/role-mappings/clients/{client}`. The
realm's `/groups/{id}/role-mappings` answers 400 for an organization group.

## What is not here

- **No application.** The only client is `kanzo-conformance`, with its API, which exist to prove
  the contract and are declared in `dev/`, so only development has them. The platform's own APIs
  are the realm's `apis`: `ai-gateway`.
- **No membership in Terraform.** Keycloak makes membership runtime — invitations, IdP brokering,
  enrolment by email domain — and the provider has no membership resource. Development seeds it
  (`seed/`); production invites.
- **No production values.** Hostnames, passwords, an upstream IdP, SMTP and TLS are the deployment's.

## Layout

```
compose.yaml         Keycloak, its Postgres, the realm (two applies)
compose.dev.yaml     dev mode on :8080, the dev/ declarations, the seed
realm/               the platform realm: claim mappers, its APIs, and what is declared (declarations.tf)
modules/app/         an application's registration: client, the APIs it calls, roles with composites
modules/api/         an API's registration: a client with no flow, and the scope naming it in `aud`
dev/                 development declarations: acme, globex, the conformance client
seed/                development users, organization groups and their role mappings
scripts/login.sh     a real PKCE login as a development user, printing the tokens
scripts/verify.sh    the contract, checked on a live token
scripts/map-group-role.sh   map a client role onto an organization's group
```

The realm applies twice on an empty Keycloak because the claim mappers it changes are created by
Keycloak itself and adopted with `import` blocks, whose ids must resolve at plan time.
