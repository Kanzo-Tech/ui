---
"@kanzo-tech/llm": minor
---

**The services are Compose, development and deployments alike, and the realm is applied from
declarations.** What changes for an application that runs `services/auth` or `services/ai`:

- **Files.** `compose.yml` is now `compose.yaml` (the service as it runs anywhere) plus
  `compose.dev.yaml` (published ports, the seed, local models). Include both in development, only
  `compose.yaml` in a deployment; by URL works, so nothing needs vendoring:
  `https://github.com/Kanzo-Tech/ui.git#v0.34.0:services/auth/compose.yaml`.
  `services/compose.yaml` is both services as a deployment runs them, `services/compose.dev.yaml` both
  for development: an application includes one URL per environment.
- **Registering an application.** `services/auth/examples/app` is gone, and an application no longer
  runs Terraform of its own: it declares an `x-application` (client, own API, `apis`, origin and
  callback, roles, `client_secret_file`) as a compose `configs` entry, and an `x-organization` per
  organization, and mounts them under `/declarations` in `auth-realm` from an override file. The
  realm's `organizations`, `conformance` variables and `realm/dev.tfvars` are gone;
  `services/auth/README.md` has the shape.
- **`modules/app`.** `client_secret` is now required for a CONFIDENTIAL client and sent write-only
  (Terraform ≥ 1.11, keycloak provider ≥ 5.10), so it never reaches state; the `client_secret`
  output is gone.
- **The gateway.** `services/ai/modules/gateway` is gone, and so are `CHAT_URL`/`CHAT_MODEL`. Which
  model answers an alias is `AI_CHAT` / `AI_COMPLETE`, `provider/model`
  (`anthropic/claude-sonnet-5-5`, `local/hf.co/…`), with the provider's key under its usual name
  (`ANTHROPIC_API_KEY`…). Development defaults both to local models; the `local-models` profile pulls
  them, now with an 8192-token context that fits a 16 GB laptop. A deployment's budget is
  `AI_TOKENS_PER_HOUR`, its issuer follows `KC_HOSTNAME`.
- **`@kanzo-tech/llm`.** A gateway error other than 429 now fails as an `AiError` coded
  `ai/unavailable`, with `data.status` and `data.reason` (`Model not found`, `request timeout`, a
  provider's refusal), instead of the SDK's uncoded `APICallError`, and is not retried. A host that
  matched on `APICallError` for these matches on the code instead.

A development realm volume from an earlier release holds state in the old shape: `docker compose
down -v` once.
