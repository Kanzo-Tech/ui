import { doesBrowserSupportWebLLM, webLLM, type WebLLMProgress } from "@browser-ai/web-llm";
import { type ModelRecord, prebuiltAppConfig } from "@mlc-ai/web-llm";
import { extractReasoningMiddleware, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

/** A call's options and a generation's result, as the middleware sees them. */
type Wrap = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type LanguageModelV4CallOptions = Parameters<Wrap>[0]["params"];
type LanguageModelV4GenerateResult = Awaited<ReturnType<Wrap>>;

import { AiError } from "./error.js";
import type { ModelLoad } from "./load.js";

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
  /**
   * Where the model is served from: its weights (an MLC model directory, by URL) and its compiled
   * library (the `.wasm`). A host serves its own so the page reaches no third party; without it the
   * id is looked up in WebLLM's prebuilt list, which downloads from Hugging Face. An id that is in
   * that list keeps what the list says of the model — its `overrides` (the context window among
   * them), its VRAM and the GPU features it needs — so serving it from elsewhere changes where it
   * comes from and nothing else.
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

const IDLE: ModelLoad = { state: "idle" };
const loads = new Map<string, ModelLoad>();
const watchers = new Map<string, Set<() => void>>();

function publish(model: string, load: ModelLoad) {
  loads.set(model, load);
  for (const listener of watchers.get(model) ?? []) listener();
}

/**
 * Where `model`'s download and load stand in this page — `idle` until something loads or asks it,
 * `loading` with WebLLM's progress and words, then `ready` or `failed`. The same value until it
 * changes, so it is a snapshot `useSyncExternalStore` can hold; {@link watchLocalModel} says when.
 */
export function localModelLoad(model: string): ModelLoad {
  return loads.get(model) ?? IDLE;
}

/**
 * Calls `listener` each time {@link localModelLoad} changes for `model`, whichever screen started the
 * load, and answers the unsubscribe: `useSyncExternalStore((l) => watchLocalModel(id, l), () => localModelLoad(id))`.
 */
export function watchLocalModel(model: string, listener: () => void): () => void {
  let set = watchers.get(model);
  if (!set) watchers.set(model, (set = new Set()));
  set.add(listener);
  return () => void set.delete(listener);
}

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

/**
 * The record for `model` served from `from`: WebLLM's prebuilt entry for the same id, when there is
 * one, with only where it is fetched from replaced. Its `integrity` and `model_manifest` describe the
 * files at the prebuilt location, so they stay there.
 */
function served(model: string, from: { weights: string; library: string }): ModelRecord {
  const prebuilt = prebuiltAppConfig.model_list.find((record) => record.model_id === model);
  const record: ModelRecord = { ...prebuilt, model: from.weights, model_id: model, model_lib: from.library };
  delete record.integrity;
  delete record.model_manifest;
  return record;
}

function engine(model: string, settings: LocalModelSettings) {
  const known = engines.get(model);
  if (known) return known;
  const provider = webLLM(model, {
    worker: settings.worker,
    initProgressCallback: (report: WebLLMProgress) =>
      publish(model, { state: "loading", progress: report.progress, text: report.text }),
    appConfig: settings.from ? { model_list: [served(model, settings.from)] } : undefined,
  });
  const unavailable = () =>
    new AiError("ai/unavailable", `This browser cannot run ${model}: it has no WebGPU`, { reason: "webgpu" });
  const ready = (): Promise<void> => {
    if (!doesBrowserSupportWebLLM()) {
      const error = unavailable();
      publish(model, { state: "failed", error });
      return Promise.reject(error);
    }
    persist();
    return Promise.resolve();
  };
  // A call answered: whatever loading it waited on is done, though nothing called `load`.
  const answered = <T>(result: T): T => {
    if (localModelLoad(model).state !== "ready") publish(model, { state: "ready" });
    return result;
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
          }).then(answered),
        wrapStream: ({ doStream }) => ready().then(doStream).then(answered),
      },
      // A model that thinks out loud (Qwen3, DeepSeek) does it between <think> tags.
      extractReasoningMiddleware({ tagName: "think" }),
    ],
  });
  const load = () => {
    if (localModelLoad(model).state !== "loading" && localModelLoad(model).state !== "ready") {
      publish(model, { state: "loading", progress: 0, text: "" });
    }
    return ready()
      .then(() => provider.createSessionWithProgress())
      .then(
        () => void answered(undefined),
        (error: unknown) => {
          publish(model, { state: "failed", error });
          throw error;
        },
      );
  };
  const entry = { model: built, load };
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
