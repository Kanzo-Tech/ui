# Services

The server half of each platform capability, released with its client half under one tag.

| Capability | Service (here) | Package |
|---|---|---|
| Identity | [`auth/`](auth) — Keycloak with the realm as code | `@kanzo-tech/auth` |
| Models | [`ai/`](ai) — LiteLLM, the gateway applications call through their server | `@kanzo-tech/llm`, `@kanzo-tech/ai` |

Each service has the same shape:

- `compose.yml` — the service for development. An application includes it from its own compose
  (`include:`) at the release it was built against.
- `modules/` — Terraform an application or a deployment instantiates from its own repository:
  `auth/modules/app` registers an application, `ai/modules/team` gives a tenant its budget and key,
  `ai/modules/gateway` deploys the gateway.
- Nothing names an application. An application registers itself; a deployment brings its own
  production configuration (secrets, the AI profile).

Pin a module to a release:

```hcl
source = "git::https://github.com/Kanzo-Tech/ui.git//services/auth/modules/app?ref=v0.28.0"
```
