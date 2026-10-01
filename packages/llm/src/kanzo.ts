import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { extractReasoningMiddleware, type LanguageModel, wrapLanguageModel } from "ai";

export interface KanzoSettings {
  /**
   * Where the gateway's OpenAI-compatible API is, as the browser reaches it. Behind a BFF that is
   * the host's own proxy — keasy's is `/api/v1/ai` — because the key that opens the gateway must
   * never be in the page.
   */
  baseURL: string;
  /** Sent with every request; the place for a CSRF header a BFF asks for. */
  headers?: Record<string, string>;
  /** The request function, for a host that routes through its own client. */
  fetch?: typeof globalThis.fetch;
}

/** A model behind the gateway, by alias. */
export type Kanzo = (alias: string) => LanguageModel;

/**
 * The one door to a model: name an **alias** (`kanzo-chat`, `kanzo-complete`), never a provider.
 * Which upstream answers it is the gateway's configuration, so a host's code is the same in dev,
 * where a local model answers, and in prod.
 *
 * Two things a host would otherwise repeat are done here, once:
 *
 * - **A model that reasons in tags gets its reasoning back as reasoning.** Open-weight models
 *   (Hermes, DeepSeek, Qwen) write it inline as `<think>…</think>` because the chat completions
 *   protocol has no field for it; the middleware lifts it into the SDK's `reasoning` part, which is
 *   what `Chat` draws as reasoning. A model that never writes the tag is untouched.
 * - **Structured output is on**, so `Output.object`/`Output.array` ask the gateway for a JSON
 *   schema rather than prose the caller would parse — the "return ONLY JSON, no fences" prompt and
 *   its fence-stripping is what this ends.
 */
export function createKanzo(settings: KanzoSettings): Kanzo {
  const provider = createOpenAICompatible({
    name: "kanzo",
    baseURL: absolute(settings.baseURL),
    headers: settings.headers,
    fetch: settings.fetch,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
  const reasoning = extractReasoningMiddleware({ tagName: "think" });
  return (alias) => wrapLanguageModel({ model: provider(alias), middleware: reasoning });
}

/**
 * The provider builds `new URL(baseURL + path)` with no base, so the BFF's own path — the one a
 * host is told to pass — would throw `Invalid URL` in the browser too. Resolved against the page,
 * once, here.
 */
function absolute(baseURL: string): string {
  const page = globalThis.location?.href;
  return page ? new URL(baseURL, page).toString().replace(/\/$/, "") : baseURL;
}
