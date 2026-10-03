# Models

[LiteLLM](https://docs.litellm.ai), the platform's one door to models. Applications speak OpenAI
chat completions to it **through their own server** and name an **alias**, never a provider:

| Alias | For |
|---|---|
| `chat` | conversations, agents |
| `complete` | short completions: ghost text, suggestions |

```
browser ──▶ the application's server (BFF) ──Bearer <tenant key>──▶ gateway ──▶ upstream
```

The browser never holds a key. The application's server checks the alias, caps the tokens, names
the caller, injects its tenant's key and streams the answer back. `@kanzo-tech/llm` is the client.

## Run it

```sh
docker compose up -d --wait   # http://localhost:4000, both aliases on Docker Model Runner
```

The dev profile ([`litellm.dev.yaml`](litellm.dev.yaml)) serves both aliases from open models on the
host's GPU (Docker Desktop 4.40+ with Model Runner on). The first `up` pulls them (~6.5 GB); after
that the loop is offline and free. Admin console: `/ui`, `admin` / `sk-dev-master-key`.

## A team per tenant

[`modules/team`](modules/team) gives a tenant a LiteLLM **team**, carrying its budget, and one
service-account **key** in it — what the tenant's server presents. Spend, limits and logs are kept
per tenant. An application instantiates it from its own repository, one per tenant.

## Deploying

[`modules/gateway`](modules/gateway) runs the gateway, its Postgres and its cache as Swarm services on
a network the deployment owns. The deployment passes:

- `profile` — its own LiteLLM config: which upstream answers each alias. **A production profile is
  the deployment's**, not this repository's; the dev profile shows the shape. Changing it rolls the
  gateway (the config is named by its hash) and no application changes: that is what aliases are for.
- `upstream_keys` — env name => key, for every upstream the profile names.
- `admin_hostname` / `admin_allow` — optionally, an IP-allowlisted route to the console and the
  management API that `modules/team` drives.

The image is pinned by digest. Two LiteLLM releases (1.82.7, 1.82.8) were published compromised in
March 2026; bump the pin deliberately, from a release that has been out for a few days.

## Caching

The cache is `default_off`. A request opts in where the same input is often asked twice
(`complete`); a conversation turn never does, or Retry would answer the same.
