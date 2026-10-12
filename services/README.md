# Services

The server half of each platform capability, released with its client half under one tag.

| Capability | Service (here) | Package |
|---|---|---|
| Identity | [`auth/`](auth) — Keycloak with the realm as code | `@kanzo-tech/auth` |

Each service has the same shape, and Compose is the whole of it — development and deployments
alike:

- `compose.yaml` — the service as it runs anywhere.
- `compose.dev.yaml` — what development adds on top: published ports, seeded users.
- Nothing names an application. An application declares itself and its organizations
  ([`auth/realm/declarations.tf`](auth/realm/declarations.tf)); a deployment brings its values —
  hostnames, passwords — as environment.

```sh
docker compose -f compose.dev.yaml up -d --wait   # for development
```

An application includes them from this repository, at the release it was built against — one URL
per environment — and adds its own services and declarations:

```yaml
# its development overlay
include:
  - https://github.com/Kanzo-Tech/ui.git#v0.35.0:services/compose.dev.yaml
```

```yaml
# its production overlay
include:
  - https://github.com/Kanzo-Tech/ui.git#v0.35.0:services/compose.yaml
```

[`compose.yaml`](compose.yaml) here is the services as a deployment runs them;
[`compose.dev.yaml`](compose.dev.yaml) is each with its development overlay. Compose clones the tag
into its cache and resolves each file's paths there: nothing is vendored.
