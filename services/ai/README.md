# Models

[agentgateway](https://agentgateway.dev), the platform's one door to models. Applications speak
OpenAI chat completions to it **through their own server** and name an **alias**, never a provider:

| Alias | For |
|---|---|
| `chat` | conversations, agents |
| `complete` | short completions: ghost text, suggestions |

```
browser ──▶ the application's server (BFF) ──Bearer <token for the gateway, one organization>──▶ gateway ──▶ upstream
```

The browser never holds a credential. The application's server exchanges the person's access token
for one issued for the gateway's audience and one organization (RFC 8693), and forwards. The gateway
takes everything from that token: who asked, which organization is charged. There is no key per
tenant. `@kanzo-tech/llm` is the client.

## Run it

```sh
docker compose -f ../auth/compose.yml -f compose.yml up -d --wait   # http://localhost:4000
```

[`gateway.yaml`](gateway.yaml) is the gateway: the realm it trusts, the one-organization rule, the
timeouts, the request log, and in development both aliases on open models through Docker Model
Runner on the host's GPU (Docker Desktop 4.40+ with Model Runner on). The first `up` pulls them
(~6.5 GB); after that the loop is offline and free. Every request is logged to `ai-postgres`.

## Deploying

[`modules/gateway`](modules/gateway) runs the gateway and its Postgres as Swarm services on a network
the deployment owns, from `gateway.yaml` with the deployment's models in place of the development
ones. The deployment passes:

- `profile` — YAML with one key, `models`: which upstream answers each alias. **A production profile
  is the deployment's**, not this repository's. Changing it rolls the gateway (the config is named by
  its hash) and no application changes: that is what aliases are for.
- `upstream_keys` — env name => key, for every upstream the profile names (`$NAME` in the profile).
- `issuer`, and `jwks_url` when the gateway reaches Keycloak by another address; `audience` is the
  gateway's client in the realm.
- `tokens_per_hour` — optionally, each organization's token budget. It is counted in memory, one
  replica, refilled by a restart.

The image is pinned by digest. The gateway holds every provider's key: bump the pin deliberately,
from a release that has been out for a few days.
