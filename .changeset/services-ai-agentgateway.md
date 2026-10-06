---
"@kanzo-tech/llm": minor
---

**The gateway in `services/ai` is agentgateway, and the realm's token is its only credential.**
Breaking for a deployment of `services/ai`; `createGateway` and the aliases `chat` and `complete` are
unchanged.

- Your server no longer presents a tenant's key. It exchanges the person's access token for one
  issued for the gateway's audience (`ai-gateway`) and for the one organization the request is for
  (`scope=organization:<alias>`, RFC 8693), and forwards that. A token naming every membership is
  refused with 403. The BFF on `/docs/ai/llm` shows the exchange.
- `modules/team` is gone, with the per-tenant keys and teams: delete your instances of it. The
  gateway charges the organization the token names.
- `modules/gateway` takes `issuer` (the realm, as its tokens say it), optionally `jwks_url` and
  `audience`, and `tokens_per_hour` for each organization's budget. `profile` is now YAML with one
  key, `models`, in agentgateway's `llm.models` shape, and upstream keys are read as `$NAME`. The
  `admin_*` variables and the `master_key` output are gone.
- Development: `docker compose -f ../auth/compose.yml -f compose.yml up -d --wait`; the gateway
  trusts the identity service beside it. Requests are logged to Postgres with the person, the
  organization, the tokens and their cost. The opt-in cache for `complete` is gone.
