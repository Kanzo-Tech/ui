# Identity

Keycloak, and the platform realm as code. **One realm (`kanzo`), one client per application,
organizations as the tenant model.** An application is an OIDC client of the realm; a customer is
an organization inside it. `@kanzo-tech/auth` is the library that reads what this realm emits.

## Run it

```sh
docker compose up -d --wait        # Keycloak 26.8 on http://localhost:8080, realm applied, seeded
scripts/verify.sh                  # ana: a real PKCE login, and the claims checked
scripts/verify.sh fede             # a member of acme with no role there
scripts/verify.sh dan              # no organization; a client role held directly
docker compose down -v             # gone, database and Terraform state together
```

Admin console: `http://localhost:8080/admin`, `admin` / `admin`. `.env.example` lists what can be
changed (port, versions, passwords); `KC_PORT` moves the issuer with it.

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

## Registering an application

From the application's own repository, with [`modules/app`](modules/app) and, for its API,
[`modules/api`](modules/api):

```hcl
module "api" {
  source    = "git::https://github.com/Kanzo-Tech/ui.git//services/auth/modules/api?ref=<release>"
  realm_id  = "kanzo"
  client_id = "board-api"
}

module "app" {
  source        = "git::https://github.com/Kanzo-Tech/ui.git//services/auth/modules/app?ref=<release>"
  realm_id      = "kanzo"
  client_id     = "board"
  access_type   = "CONFIDENTIAL"
  client_secret = var.client_secret
  redirect_uris = ["https://*.board.example.com/api/auth/callback"]
  apis          = [module.api.scope, "ai-gateway"]
  roles = {
    reader = {}
    editor = { composites = ["reader"] }
    admin  = { composites = ["editor"] }
  }
}
```

The token the application signs in with names no API. Before each call its server exchanges it
(RFC 8693, Keycloak's standard token exchange) for one naming one API and one organization, and
`scripts/verify.sh` checks that on a live token. [`examples/app`](examples/app) is the whole file. Then map the application's roles onto an
organization's groups — what an organization admin does in the console — with

```sh
scripts/map-group-role.sh acme Admins board admin
```

An organization group's role mappings live under the organization:
`POST /admin/realms/{realm}/organizations/{org}/groups/{group}/role-mappings/clients/{client}`. The
realm's `/groups/{id}/role-mappings` answers 400 for an organization group.

## What is not here

- **No application.** The only client is `kanzo-conformance`, with its API, which exist to prove
  the contract (`conformance = true` in `realm/dev.tfvars`; off by default). The platform's own
  APIs are the realm's `apis`; development registers `ai-gateway`.
- **No membership in Terraform.** Keycloak makes membership runtime — invitations, IdP brokering,
  enrolment by email domain — and the provider has no membership resource. Development seeds it
  (`seed/`); production invites.
- **No production values.** An upstream IdP, SMTP and TLS are the deployment's.

## Layout

```
compose.yml          Keycloak, its Postgres, the realm (two applies), the seed
realm/               the platform realm: organizations, claim mappers, its APIs, the conformance client
modules/app/         an application's registration: client, the APIs it calls, roles with composites
modules/api/         an API's registration: a client with no flow, and the scope naming it in `aud`
examples/app/        modules/app from an application's repository
seed/                development users, organization groups and their role mappings
scripts/verify.sh    the contract, checked on a live token
scripts/map-group-role.sh   map a client role onto an organization's group
```

The realm applies twice on an empty Keycloak because the claim mappers it changes are created by
Keycloak itself and adopted with `import` blocks, whose ids must resolve at plan time.
