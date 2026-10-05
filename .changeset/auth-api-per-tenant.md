---
"@kanzo-tech/auth": minor
---

**One BFF in front of a resource server per tenant.** `api.target` may be a function of the
organization the request addresses — the answer `organization` gives — so one `kanzoAuth` serves
every organization with one Keycloak client, one session store and one back-channel logout URL,
which is Keycloak's Organizations model, while each tenant's data stays behind its own server.

```ts
api: { mount: "/api", target: (organization) => `http://${organization}-api:8080` }
```

A string `target` behaves as before.
