---
"@kanzo-tech/auth": minor
---

**The realm this package reads now ships beside it, in `services/auth`.** Keycloak 26.8 with the
platform realm as code: one realm, organizations as tenants, and the claim mappers set so that an
application's roles in an organization arrive as `organization[alias].resource_access[clientId].roles`,
composites expanded, on both tokens. `docker compose up -d --wait` in that directory gives you a
working login; `scripts/verify.sh` checks the claims on a live token.

Register your application from your own repository with the `modules/app` Terraform module — client,
audience and roles, a hierarchy declared once as composites — pinned to the release you build against:

```hcl
source = "git::https://github.com/Kanzo-Tech/ui.git//services/auth/modules/app?ref=v0.28.0"
```

and map your roles onto an organization's groups with `scripts/map-group-role.sh`. Nothing in the
realm names an application.
