import { doesBrowserSupportWebLLM, webLLM, type WebLLMProgress } from "@browser-ai/web-llm";
import { extractReasoningMiddleware, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

/** A call's options and a generation's result, as the middleware sees them. */
type Wrap = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type LanguageModelV4CallOptions = Parameters<Wrap>[0]["params"];
type LanguageModelV4GenerateResult = Awaited<ReturnType<Wrap>>;

import { AiError } from "./error.js";

/**
 * A model in the page: WebLLM on WebGPU, behind the AI SDK's `LanguageModel`, through
 * `@browser-ai/web-llm` — the provider this subpath re-exports nothing of, so a host never imports it.
 *
 * A subpath and not the barrel for the reason `/editor` and `/table` are subpaths of
 * `@kanzo-tech/ui`: the provider and WebLLM are optional peers, and a static import of either from
 * `index.ts` would break `import { stream }` for every host that did not install them.
 *
 * It is the model Kanzo's Tasks are built for (`/docs/design/tasks`): a structured answer
 * (`Output.object`) is decoded against its JSON Schema by WebLLM's XGrammar, and a call that passes a
 * grammar is held to it. A tool is described in the prompt and parsed out of the text, which is why
 * Tasks use none.
 */

export interface LocalModelSettings {
  /**
   * The worker the engine runs in, whose script calls {@link serveLocalModel}. Without one the engine
   * runs on the page's thread, and a long prefill blocks it.
   */
  worker?: Worker;
  /** The download and load, from 0 to 1, with WebLLM's words for what it is doing. */
  onProgress?: (progress: { progress: number; text: string }) => void;
  /**
   * Where the model is served from: its weights (an MLC model directory, by URL) and its compiled
   * library (the `.wasm`). A host serves its own so the page reaches no third party; without it the
   * id is looked up in WebLLM's prebuilt list, which downloads from Hugging Face.
   */
  from?: { weights: string; library: string };
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
const engines = new Map<string, { model: LanguageModel; load: () => Promise<void> }>();

/**
 * Asks the browser to keep what is stored for this page — the weights among it — rather than evict
 * it under pressure. Asked once, when a model first loads: a refusal changes nothing but the odds.
 */
let persistAsked = false;
const persist = () => {
  if (persistAsked) return;
  persistAsked = true;
  // A refusal or a browser without the API leaves the odds as they were: nothing to report.
  void globalThis.navigator?.storage?.persist?.().catch(() => false);
};

/**
 * `model`, a WebLLM model id (`Qwen3-4B-q4f16_1-MLC`), as a `LanguageModel`. Without WebGPU every call
 * fails as `AiError` coded `ai/unavailable`, before anything is downloaded: the host says the device
 * cannot run it rather than waiting on a load that will not finish.
 */
export function localModel(model: string, settings: LocalModelSettings = {}): LanguageModel {
  return engine(model, settings).model;
}

/**
 * Downloads and loads `model` now, before anything asks it: what a screen calls when it opens, so the
 * first question does not wait on the weights. Resolves when the engine is ready; rejects as
 * `localModel`'s calls do. The same engine `localModel(model, settings)` answers with.
 */
export function loadLocalModel(model: string, settings: LocalModelSettings = {}): Promise<void> {
  return engine(model, settings).load();
}

function engine(model: string, settings: LocalModelSettings) {
  const known = engines.get(model);
  if (known) return known;
  const provider = webLLM(model, {
    worker: settings.worker,
    initProgressCallback: settings.onProgress
      ? (report: WebLLMProgress) => settings.onProgress?.({ progress: report.progress, text: report.text })
      : undefined,
    appConfig: settings.from
      ? { model_list: [{ model: settings.from.weights, model_id: model, model_lib: settings.from.library }] }
      : undefined,
  });
  const unavailable = () =>
    new AiError("ai/unavailable", `This browser cannot run ${model}: it has no WebGPU`, { reason: "webgpu" });
  const ready = (): Promise<void> => {
    if (!doesBrowserSupportWebLLM()) return Promise.reject(unavailable());
    persist();
    return Promise.resolve();
  };
  const built = wrapLanguageModel({
    model: provider,
    middleware: [
      {
        specificationVersion: "v4",
        wrapGenerate: ({ doGenerate, params }) =>
          ready().then(() => {
            const grammar = (params.providerOptions?.kanzo as LocalCallOptions | undefined)?.grammar;
            return grammar ? generateHeld(provider, grammar, params) : doGenerate();
          }),
        wrapStream: ({ doStream }) => ready().then(doStream),
      },
      // A model that thinks out loud (Qwen3, DeepSeek) does it between <think> tags.
      extractReasoningMiddleware({ tagName: "think" }),
    ],
  });
  const entry = { model: built, load: () => ready().then(() => provider.createSessionWithProgress()).then(() => undefined) };
  engines.set(model, entry);
  return entry;
}

/**
 * The engine's side of {@link LocalModelSettings.worker}, and the worker's whole script: `import { serveLocalModel } from "@kanzo-tech/llm/local"; serveLocalModel();`.
 */
export async function serveLocalModel(): Promise<void> {
  const { WebWorkerMLCEngineHandler } = await import("@browser-ai/web-llm");
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (message: MessageEvent) => handler.onmessage(message);
}
