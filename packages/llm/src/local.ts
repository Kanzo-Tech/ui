import { doesBrowserSupportWebLLM, webLLM, type WebLLMProgress } from "@browser-ai/web-llm";
import { extractReasoningMiddleware, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

/** A call's options and a generation's result, as the middleware sees them. */
type Wrap = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type LanguageModelV4CallOptions = Parameters<Wrap>[0]["params"];
type LanguageModelV4GenerateResult = Awaited<ReturnType<Wrap>>;

import { AiError } from "./gateway.js";

/**
 * A model in the page: WebLLM on WebGPU, behind the AI SDK's `LanguageModel`, through
 * `@browser-ai/web-llm` — the provider this subpath re-exports nothing of, so a host never imports it.
 *
 * A subpath and not the barrel for the reason `/editor` and `/table` are subpaths of
 * `@kanzo-tech/ui`: the provider and WebLLM are optional peers, and a static import of either from
 * `index.ts` would break `import { stream }` for every host that did not install them.
 *
 * What this is for today is measuring: Kanzo Tasks' phase 0 runs the current agent against it on real
 * devices (`/docs/design/tasks`). A structured answer (`Output.object`) is decoded against its JSON
 * Schema by WebLLM's XGrammar; a tool is described in the prompt and parsed out of the text, which is
 * the gap the design's Tasks close by not using tools.
 */

export interface LocalModelSettings {
  /**
   * The worker the engine runs in, whose script calls {@link serveLocalModel}. Without one the engine
   * runs on the page's thread, and a long prefill blocks it.
   */
  worker?: Worker;
  /** The download and load, from 0 to 1, with WebLLM's words for what it is doing. */
  onProgress?: (progress: { progress: number; text: string }) => void;
}

/**
 * What a call may ask of a local model beside its prompt: `providerOptions.kanzo.grammar`, an EBNF
 * the engine holds every token to (WebLLM's xgrammar). A Task whose artefact is text in a language —
 * a Fossil mapping — passes its grammar here, and the model cannot write outside it. A model that is
 * not local ignores it; the Task's oracles still judge what it wrote.
 */
export interface LocalCallOptions {
  grammar?: string;
}

/** The engine under the provider: `@browser-ai/web-llm` keeps it private and passes only JSON Schema. */
interface Engine {
  chat: {
    completions: {
      create(request: {
        messages: { role: "system" | "user" | "assistant"; content: string }[];
        response_format: { type: "grammar"; grammar: string };
        max_tokens?: number;
        temperature?: number;
        stream: false;
      }): Promise<{ choices: { message: { content: string | null }; finish_reason: string | null }[]; usage?: { prompt_tokens: number; completion_tokens: number } }>;
    };
  };
  interruptGenerate(): Promise<void>;
}

/** A call held to `grammar`, on the provider's own engine. */
async function generateHeld(provider: unknown, grammar: string, options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
  const engine = await (provider as { getEngine(): Promise<Engine> }).getEngine();
  const messages = options.prompt.flatMap((m) => {
    const content = typeof m.content === "string" ? m.content : m.content.map((p) => ("text" in p ? p.text : "")).join("");
    return m.role === "system" || m.role === "user" || m.role === "assistant" ? [{ role: m.role, content }] : [];
  });
  const stop = () => void engine.interruptGenerate();
  options.abortSignal?.addEventListener("abort", stop);
  try {
    const response = await engine.chat.completions.create({
      messages,
      response_format: { type: "grammar", grammar },
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      stream: false,
    });
    const choice = response.choices[0];
    const input = response.usage?.prompt_tokens;
    const output = response.usage?.completion_tokens;
    return {
      content: [{ type: "text", text: choice?.message.content ?? "" }],
      finishReason: { unified: choice?.finish_reason === "length" ? "length" : "stop", raw: choice?.finish_reason ?? undefined },
      usage: {
        inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: output, text: output, reasoning: undefined },
      },
      warnings: [],
    };
  } finally {
    options.abortSignal?.removeEventListener("abort", stop);
  }
}

// One engine per model per page: two would be two copies of the weights in the GPU's memory.
const engines = new Map<string, LanguageModel>();

/**
 * `model`, a WebLLM model id (`Qwen3-4B-q4f16_1-MLC`), as a `LanguageModel`. Without WebGPU every call
 * fails as `AiError` coded `ai/unavailable`, before anything is downloaded: the host says the device
 * cannot run it rather than waiting on a load that will not finish.
 */
export function localModel(model: string, settings: LocalModelSettings = {}): LanguageModel {
  const known = engines.get(model);
  if (known) return known;
  const provider = webLLM(model, {
    worker: settings.worker,
    initProgressCallback: settings.onProgress
      ? (report: WebLLMProgress) => settings.onProgress?.({ progress: report.progress, text: report.text })
      : undefined,
  });
  const unavailable = () =>
    new AiError("ai/unavailable", `This browser cannot run ${model}: it has no WebGPU`, { reason: "webgpu" });
  const built = wrapLanguageModel({
    model: provider,
    middleware: [
      {
        specificationVersion: "v4",
        wrapGenerate: ({ doGenerate, params }) => {
          if (!doesBrowserSupportWebLLM()) return Promise.reject(unavailable());
          const grammar = (params.providerOptions?.kanzo as LocalCallOptions | undefined)?.grammar;
          return grammar ? generateHeld(provider, grammar, params) : doGenerate();
        },
        wrapStream: ({ doStream }) => (doesBrowserSupportWebLLM() ? doStream() : Promise.reject(unavailable())),
      },
      // A model that thinks out loud does it between <think> tags, as the gateway's do.
      extractReasoningMiddleware({ tagName: "think" }),
    ],
  });
  engines.set(model, built);
  return built;
}

/**
 * The engine's side of {@link LocalModelSettings.worker}, and the worker's whole script: `import { serveLocalModel } from "@kanzo-tech/llm/local"; serveLocalModel();`.
 */
export async function serveLocalModel(): Promise<void> {
  const { WebWorkerMLCEngineHandler } = await import("@browser-ai/web-llm");
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (message: MessageEvent) => handler.onmessage(message);
}
