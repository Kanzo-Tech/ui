# Models

[agentgateway](https://agentgateway.dev), the platform's one door to models. Applications speak
OpenAI chat completions to it **through their own server** and name an **alias**, never a provider:

| Alias | For |
|---|---|
| `chat` | conversations, agents |
| `complete` | short completions: ghost text, suggestions |

```
browser ──▶ the application's server (BFF) ──Bearer <token for the gateway, one organization>──▶ gateway ──▶ provider
```

The browser never holds a credential. The application's server exchanges the person's access token
for one issued for the gateway and one organization (RFC 8693), and forwards — `kanzoAuth`'s `apis`
does both, as for any API. The gateway takes everything from that token: who asked, which
organization is charged. There is no key per tenant. `@kanzo-tech/llm` is the client.

The gateway is a client of the realm, `ai-gateway`, which the realm registers by default; an
application that calls it lists it in its declaration's `apis`.

## Choosing the models

One variable per alias, `provider/model` — the shape LiteLLM, OpenRouter and the AI SDK use — and the
provider's key under its usual name:

```sh
AI_CHAT=anthropic/claude-sonnet-5-5
AI_COMPLETE=anthropic/claude-haiku-4-5
ANTHROPIC_API_KEY=sk-ant-…
```

| Provider | `AI_CHAT=` | Key |
|---|---|---|
| Anthropic | `anthropic/<model>` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/<model>` | `OPENAI_API_KEY` |
| Google Gemini | `gemini/<model>` | `GEMINI_API_KEY` |
| Mistral | `mistral/<model>` | `MISTRAL_API_KEY` |
| OpenRouter | `openrouter/<vendor>/<model>` | `OPENROUTER_API_KEY` |
| On the machine | `local/<model>` | none; `LOCAL_MODELS_URL` (Docker Model Runner by default) |

The same variables in development (`.env`) and in a deployment (its environment): changing a model
is changing a line and restarting the gateway, and no application changes — that is what aliases are
for. Each alias is a `virtualModels` entry over the one model its variable names; the providers are
`provider/*` models marked internal, so a caller can ask for `chat` or `complete` and nothing else.
A provider without a key still loads; a request routed to it fails with the provider's refusal,
which reaches the caller as `ai/unavailable` with the reason.

`AI_TOKENS_PER_HOUR` is each organization's budget, input and output together (no practical limit
by default). It is counted in the gateway's memory: one replica, refilled by a restart.

## Run it

```sh
cd ..
docker compose -f compose.dev.yaml --profile local-models up -d --wait    # both aliases on local models, :4000
ai/scripts/verify.sh                                                      # a real token, each alias, the refusals
```

With the `local-models` profile, both aliases run on open models through Docker Model Runner on the
host's GPU (Docker Desktop 4.40+ with Model Runner on). The first `up` pulls them (~6.5 GB); after
that the loop is offline and free. They run with an 8192-token context, which fits a 16 GB laptop:
the models declare 131072, and llama.cpp reserves the cache for all of it when it loads one (~16 GB
for the 8B alone). With both aliases on a provider, leave the profile off and nothing is pulled.

## Each alias's context

`AI_CHAT_CONTEXT` and `AI_COMPLETE_CONTEXT` are each alias's context window in tokens, declared once
beside the model it describes. With the `local-models` profile they are what Model Runner starts the
model with (`context_size`, 8192 when unset). With a provider they are the provider's window for that
model, which the operator sets with `AI_CHAT`.

The gateway reports no window: Model Runner's `/models` answers a model's maximum (131072 for
Hermes 3), not what it was started with, and agentgateway serves no alias metadata. So an
application reads the same variables. It passes them to its own server's environment and hands them
to `@kanzo-tech/ai`'s `context: { tokens }`, which fits the prompt into that window
(`/docs/design/ai-context`):

```yaml
services:
  web:
    environment:
      MYAPP_AI_CHAT_CONTEXT: ${AI_CHAT_CONTEXT:-}
      MYAPP_AI_COMPLETE_CONTEXT: ${AI_COMPLETE_CONTEXT:-}
```

Unset, the application passes no budget, so nothing narrows, and the local models run at 8192. Set
it whenever a model's window is not that, for example a larger local model, or any provider.

Every request is logged to `ai-postgres`: who asked, for which organization, the alias, the tokens
and their cost.

## Deploying

The same [`compose.yaml`](compose.yaml), with `AI_CHAT`, `AI_COMPLETE` and the keys in the
deployment's environment, `KC_HOSTNAME` (the issuer, shared with `../auth`), and `AI_DB_PASSWORD`.
Left empty, an alias fails the gateway's start: a deployment names its models.

The image is pinned by digest. The gateway holds every provider's key: bump the pin deliberately,
from a release that has been out for a few days.
