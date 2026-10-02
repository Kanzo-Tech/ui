import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { extractReasoningMiddleware, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

export interface GatewaySettings {
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

/** How long a model's stream may send nothing, its headers included: fossil's figure for a stream's next chunk. */
const SILENT_AFTER = 30_000;

/** The one failure this package names: the model stopped sending without closing the stream. */
export class AiError extends Error {
  override readonly name = "AiError";
  constructor(
    readonly code: "ai/silent",
    message: string,
    readonly data: { readonly after?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** A model behind the gateway, by alias. */
export type Gateway = (alias: string) => LanguageModel;

/**
 * The one door to a model: name an **alias** (`chat`, `complete`), never a provider.
 * Which upstream answers it is the gateway's configuration, so a host's code is the same in dev,
 * where a local model answers, and in prod.
 *
 * Three things a host would otherwise repeat are done here, once:
 *
 * - **A stream that goes silent ends, as `ai/silent`.** Its headers are due within 30 s and each
 *   chunk of its body within 30 s of the last; past that the request is aborted and the caller sees
 *   an {@link AiError}. A request that does not stream is not bounded: its headers wait on the whole
 *   answer, which is work on the far side, not silence.
 * - **A model that reasons in tags gets its reasoning back as reasoning.** Open-weight models
 *   (Hermes, DeepSeek, Qwen) write it inline as `<think>…</think>` because the chat completions
 *   protocol has no field for it; the middleware lifts it into the SDK's `reasoning` part, which is
 *   what `Chat` draws as reasoning. A model that never writes the tag is untouched.
 * - **Structured output is on**, so `Output.object`/`Output.array` ask the gateway for a JSON
 *   schema rather than prose the caller would parse — the "return ONLY JSON, no fences" prompt and
 *   its fence-stripping is what this ends.
 */
export function createGateway(settings: GatewaySettings): Gateway {
  const provider = createOpenAICompatible({
    name: "gateway",
    baseURL: absolute(settings.baseURL),
    headers: settings.headers,
    fetch: bounded(settings.fetch ?? ((...args) => globalThis.fetch(...args))),
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
  const reasoning = extractReasoningMiddleware({ tagName: "think" });
  return (alias) => wrapLanguageModel({ model: provider(alias), middleware: [silence, reasoning] });
}

/**
 * The provider wraps a body that fails mid-way in an `APICallError`, so a silence after the first
 * chunk would reach the caller as that error's `cause`. It is handed back as itself instead, by the
 * SDK's own path for a stream that fails: an `error` part, which `streamText` gives `onError`.
 */
const silence: LanguageModelMiddleware = {
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    const reader = stream.getReader();
    return {
      ...rest,
      stream: new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) controller.close();
            else controller.enqueue(value);
          } catch (e) {
            const cause = (e as { cause?: unknown } | null)?.cause;
            if (!(cause instanceof AiError)) throw e;
            controller.enqueue({ type: "error", error: cause });
            controller.close();
          }
        },
        cancel: (reason) => reader.cancel(reason),
      }),
    };
  },
};

/**
 * The provider builds `new URL(baseURL + path)` with no base, so the BFF's own path — the one a
 * host is told to pass — would throw `Invalid URL` in the browser too. Resolved against the page,
 * once, here.
 */
function absolute(baseURL: string): string {
  const page = globalThis.location?.href;
  return page ? new URL(baseURL, page).toString().replace(/\/$/, "") : baseURL;
}

/**
 * `fetch`, with a streaming request's headers due within {@link SILENT_AFTER} and each body chunk
 * within as long of the last. The caller's signal still aborts as itself. The error is not named
 * `AbortError` or `TimeoutError`: the SDK reads those as a stop, not a failure.
 */
function bounded(fetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    if (!streaming(init?.body)) return fetch(input, init);
    const outer = init?.signal;
    const controller = new AbortController();
    const forward = () => controller.abort(outer?.reason);
    if (outer?.aborted) forward();
    else outer?.addEventListener("abort", forward, { once: true });
    const release = () => outer?.removeEventListener("abort", forward);

    // Raced as well as aborted, so a fetch that ignores its signal is cut all the same.
    const heard = <T>(pending: Promise<T>): Promise<T> => {
      const { signal } = controller;
      const timer = setTimeout(
        () => controller.abort(new AiError("ai/silent", `The model sent nothing for ${SILENT_AFTER} ms`, { after: SILENT_AFTER })),
        SILENT_AFTER,
      );
      let stop = () => {};
      const aborted = new Promise<never>((_, reject) => {
        stop = () => reject(signal.reason);
        if (signal.aborted) stop();
        else signal.addEventListener("abort", stop, { once: true });
      });
      return Promise.race([pending, aborted])
        .catch((e: unknown) => {
          release();
          throw signal.aborted ? signal.reason : e;
        })
        .finally(() => {
          clearTimeout(timer);
          signal.removeEventListener("abort", stop);
        });
    };

    const response = await heard(fetch(input, { ...init, signal: controller.signal }));
    if (!response.body) {
      release();
      return response;
    }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(stream) {
        const chunk = await heard(reader.read()).catch((e: unknown) => {
          void reader.cancel(e).catch(() => {}); // the stream is already failing with `e`
          throw e;
        });
        if (chunk.done) {
          release();
          stream.close();
        } else stream.enqueue(chunk.value);
      },
      cancel(reason) {
        release();
        return reader.cancel(reason);
      },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

function streaming(body: BodyInit | null | undefined): boolean {
  if (typeof body !== "string") return false;
  try {
    return (JSON.parse(body) as { stream?: unknown }).stream === true;
  } catch {
    return false;
  }
}
