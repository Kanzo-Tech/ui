---
"@kanzo-tech/llm": minor
---

**The gateway `createGateway` talks to now ships beside it, in `services/ai`.** LiteLLM serving the
`chat` and `complete` aliases: `docker compose up -d --wait` there runs both on open models through
Docker Model Runner, offline. For a deployment, `modules/gateway` runs it as Swarm services with your
own profile (which upstream answers each alias) and keys, and `modules/team` gives each of your
tenants a budget and the key its server presents.
