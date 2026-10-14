---
"@kanzo-tech/auth": minor
---

`services/compose.yaml` no longer defaults the identity service's passwords. A deployment must set `KC_DB_PASSWORD` and `KC_ADMIN_PASSWORD` in its environment; without them Compose refuses to start and names the one missing, where it used to come up with `keycloak` and `admin`. Development is unchanged: `services/compose.dev.yaml` reads `services/auth/dev/dev.env`, and your environment or your project's `.env` still overrides it. Running `services/auth` directly, pass `--env-file dev/dev.env` beside `-f compose.yaml -f compose.dev.yaml`.

The realm no longer carries the `moved` blocks for a realm applied before v0.35.0. A realm applied at v0.35.0 or later is unaffected; one last applied before it must be applied once at a release between v0.35.0 and v0.45.1 first, or it re-creates the `kanzo-conformance` client.
