# Services

The server half of each platform capability, released with its client half under one tag.

| Capability | Service (here) | Package |
|---|---|---|
| Identity | [`auth/`](auth) — Keycloak with the realm as code | `@kanzo-tech/auth` |
| Models | [`ai/`](ai) — agentgateway, the gateway applications call through their server | `@kanzo-tech/llm`, `@kanzo-tech/ai` |

Each service has the same shape, and Compose is the whole of it — development and deployments
alike:

- `compose.yaml` — the service as it runs anywhere.
- `compose.dev.yaml` — what development adds on top: published ports, seeded users, local models.
- Nothing names an application. An application declares itself and its organizations
  ([`auth/realm/declarations.tf`](auth/realm/declarations.tf)); a deployment brings its values —
  hostnames, which model answers each alias, keys — as environment.

```sh
docker compose up -d --wait                          # both, for development (compose.yaml here)
docker compose --profile local-models up -d --wait   # with the AI aliases on local models
```

An application includes the same files from this repository, at the release it was built against,
and adds its own services and declarations:

```yaml
include:
  - path:
      - https://github.com/Kanzo-Tech/ui.git#v0.34.0:services/auth/compose.yaml
      - https://github.com/Kanzo-Tech/ui.git#v0.34.0:services/auth/compose.dev.yaml   # development only
  - path:
      - https://github.com/Kanzo-Tech/ui.git#v0.34.0:services/ai/compose.yaml
      - https://github.com/Kanzo-Tech/ui.git#v0.34.0:services/ai/compose.dev.yaml     # development only
```

Compose clones the tag into its cache and resolves each file's paths there: nothing is vendored. The
tag can be a variable (`#${KANZO_UI_REF:-v0.34.0}`), so a product pins the platform in one place.
