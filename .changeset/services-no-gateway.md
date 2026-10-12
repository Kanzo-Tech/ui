---
"@kanzo-tech/auth": minor
---

The AI gateway is gone from the platform's services. `services/compose.yaml` and `services/compose.dev.yaml` include identity only: `services/ai` (agentgateway, its Postgres, the local-model profile, `AI_CHAT`, `AI_COMPLETE`) no longer exists, and the model runs in the page with `localModel` from `@kanzo-tech/llm/local`. The realm no longer registers the `ai-gateway` API, and the realm-wide `apis` variable and output are gone with it: an application's declaration lists no `apis`, only its own `api`. Remove `apis: [ai-gateway]` from your `x-application`, and the `/api/ai` mount from `kanzoAuth`'s `apis`.
