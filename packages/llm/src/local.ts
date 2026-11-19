import { doesBrowserSupportWebLLM, webLLM, type WebLLMProgress } from "@browser-ai/web-llm";
import { type AppConfig, prebuiltAppConfig } from "@mlc-ai/web-llm";
import { extractReasoningMiddleware, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

import { Problem } from "@kanzo-tech/problems";
import type { ModelLoad } from "./load.js";

/** A call's options and a generation's result, as the middleware sees them. */
type Wrap = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type LanguageModelV4CallOptions = Parameters<Wrap>[0]["params"];
type LanguageModelV4GenerateResult = Awaited<ReturnType<Wrap>>;
/** The AI SDK's model of the spec this package answers in: an object, never a gateway's string id. */
type LanguageModelV4 = Extract<LanguageModel, { specificationVersion: "v4" }>;

/**
 * A model in the page, resolved by id through **one provider registry**: WebLLM on WebGPU, behind the
 * AI SDK's `LanguageModel`, through `@browser-ai/web-llm` — the provider this subpath re-exports
 * nothing of, so a host never imports it.
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

/**
 * What answers for the model ids in this page: the AI SDK's `ProviderV4` narrowed to what a model in
 * the page needs — the ids it serves, and each one's engine. {@link localProvider} is WebLLM's; a host
 * sets one with {@link setLocalProvider}.
 */
export interface LocalProvider {
  /** The ids it serves, in its order: the first is the one `localModel()` asks. Rejects as `llm/unavailable` when it can serve none here. */
  models(): Promise<readonly string[]>;
  /** `id`'s engine, one of {@link models}; `report` hears how its load stands while it loads. */
  languageModel(id: string, report: (load: ModelLoad) => void): Promise<LocalEngine>;
}

/** One model's engine: the model, and the load that makes it ready to answer. */
export interface LocalEngine {
  readonly model: LanguageModelV4;
  /** Downloads and loads the model; resolves when it can answer, rejects with what stopped it. */
  load(): Promise<void>;
}

export interface LocalProviderSettings {
  /**
   * Where the models are served from: a directory, on this origin or absolute, holding WebLLM's
   * `AppConfig` as `app-config.json` — `{ model_list: [{ model, model_id, model_lib, … }] }`, as
   * `@mlc-ai/web-llm` declares it — beside what it lists. A `model` or `model_lib` written relative is
   * resolved against that directory. Every model it lists is served, in its order; nothing else is.
   * Without it, WebLLM's own prebuilt list, which downloads from Hugging Face.
   */
  baseURL?: string;
  /**
   * The worker the engine runs in, whose script calls {@link serveLocalModel}. Without one the engine
   * runs on the page's thread, and a long prefill blocks it.
   */
  worker?: Worker;
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

/**
 * **The registry**, one per page, on `globalThis` under `Symbol.for("@kanzo-tech/llm/local")` — the
 * key OpenTelemetry's global provider API keeps its own under, and the shape of the AI SDK's
 * `customProvider`: models registered by id first, then the fallback provider, WebLLM's own prebuilt
 * list until a host sets one. A global and not a module's variable, so whatever runs before the
 * app's own scripts registers in the same one, as every copy of this module reads it
 * (`/docs/design/testing#a-model-is-resolved-through-one-registry`).
 */
interface LocalModelRegistry {
  languageModels: Map<string, LocalEngine>;
  fallbackProvider?: LocalProvider;
}

function registry(): LocalModelRegistry {
  const scope = globalThis as { [key: symbol]: LocalModelRegistry | undefined };
  return (scope[Symbol.for("@kanzo-tech/llm/local")] ??= { languageModels: new Map() });
}

let prebuilt: LocalProvider | undefined;
const provider = () => registry().fallbackProvider ?? (prebuilt ??= localProvider());

/**
 * Sets the provider every `localModel` in this page resolves through, behind any model registered by
 * id: what a host does once, at its composition root, before anything asks a model —
 * `setLocalProvider(localProvider({ baseURL: "/models", worker }))`. OpenTelemetry's
 * `trace.setGlobalTracerProvider` is the shape.
 */
export function setLocalProvider(provider: LocalProvider): void {
  registry().fallbackProvider = provider;
}

const unavailable = (message: string, reason: "webgpu" | "unserved") => new Problem("llm/unavailable", message, { reason });

/**
 * **WebLLM's provider, configured with where its models are served from** — the AI SDK's
 * `createOpenAI({ baseURL })` in shape. It serves exactly what `baseURL`'s `app-config.json` lists,
 * handed to WebLLM as it is written but for relative URLs, resolved against `baseURL`: a host names no
 * model and no library version, and a new model is a new line in that file.
 *
 * Without WebGPU it serves nothing, as `llm/unavailable` with `reason` `"webgpu"`, before anything is
 * fetched; a listing that is missing or lists nothing is `llm/unavailable` with `reason`
 * `"unserved"`, and so is an id it does not list.
 */
export function localProvider(settings: LocalProviderSettings = {}): LocalProvider {
  let listing: Promise<AppConfig> | undefined;
  const config = () => {
    if (!doesBrowserSupportWebLLM()) return Promise.reject(unavailable("This browser cannot run a model in the page: it has no WebGPU", "webgpu"));
    // Kept while it holds or is pending, never once it rejects: a network that failed may answer
    // next time, and a missing listing may be written.
    if (!listing) {
      listing = read(settings.baseURL);
      listing.catch(() => (listing = undefined));
    }
    return listing;
  };
  return {
    async models() {
      return (await config()).model_list.map((record) => record.model_id);
    },
    async languageModel(id, report) {
      const appConfig = await config();
      if (!appConfig.model_list.some((record) => record.model_id === id)) {
        throw unavailable(`This page serves no model ${id}`, "unserved");
      }
      return webLLMEngine(id, appConfig, settings.worker, report);
    },
  };
}

/** The `AppConfig` served at `baseURL`, its URLs absolute — or WebLLM's prebuilt one, without a base. */
async function read(baseURL: string | undefined): Promise<AppConfig> {
  if (baseURL === undefined) return prebuiltAppConfig;
  const base = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`, globalThis.location?.href);
  const at = new URL("app-config.json", base);
  const response = await fetch(at);
  if (!response.ok) throw unavailable(`This page serves no models: ${at.href} answered ${response.status}`, "unserved");
  const config = (await response.json()) as AppConfig;
  if (!config.model_list?.length) throw unavailable(`This page serves no models: ${at.href} lists none`, "unserved");
  // WebLLM reads both as absolute URLs, and from its worker, where a relative one means another place.
  return {
    ...config,
    model_list: config.model_list.map((record) => ({
      ...record,
      model: new URL(record.model, base).href,
      model_lib: new URL(record.model_lib, base).href,
    })),
  };
}

/** The engine under the provider: `@browser-ai/web-llm` keeps it private and passes only JSON Schema. */
interface Engine {
  chat: {
    completions: {
      create(request: {
        messages: { role: "system" | "user" | "assistant"; content: string }[];
        response_format: { type: "grammar"; grammar: string } | { type: "json_object"; schema: string };
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
      finishReason: { unified: choice?.finish_reason === "length" ? "length" : choice?.finish_reason === "abort" ? "other" : "stop", raw: choice?.finish_reason ?? undefined },
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

/**
 * A span in the browser's Performance timeline, `kanzo:llm:<name>` — what the load, the warm-up and
 * the first call really cost on this device, readable in Chrome's Performance panel (Timings). A
 * page without the API loses the span and nothing else.
 */
function span(name: string, start: number, model: string) {
  try {
    globalThis.performance?.measure(`kanzo:llm:${name}`, { start, end: globalThis.performance.now(), detail: { model } });
  } catch {
    // A measurement is never worth a failed call.
  }
}
const now = () => globalThis.performance?.now() ?? 0;

/** A generation stopped from outside, as an aborted `fetch` rejects: nothing the model wrote is an answer. */
const interrupted = () => new DOMException("The generation was interrupted", "AbortError");

/**
 * **One call at a time on an engine, and a call's interrupt only its own.** WebLLM's
 * `interruptGenerate()` is the engine's, not a request's: it stops whichever generation is running.
 * `@browser-ai/web-llm` registers it on a call's signal when the call is *made*, before it waits for
 * the engine's lock, so aborting a call that was only waiting stopped the one running — mid-JSON, and
 * the cut-off text was parsed. A call here waits for its turn first and is handed the engine only
 * then; one aborted while it waits is dropped without the engine hearing of it. The turn is given
 * back by the `release` it resolves with, once.
 */
function turns() {
  let tail: Promise<void> = Promise.resolve();
  return async (signal?: AbortSignal): Promise<() => void> => {
    const before = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => (release = resolve));
    let stop!: () => void;
    const dropped = new Promise<"dropped">((resolve) => (stop = () => resolve("dropped")));
    if (signal?.aborted) stop();
    else signal?.addEventListener("abort", stop, { once: true });
    const first = await Promise.race([before.then(() => "turn" as const), dropped]);
    signal?.removeEventListener("abort", stop);
    if (first === "dropped") {
      // The slot stays taken until the call ahead is done, so the calls behind keep their order.
      void before.then(release);
      throw interrupted();
    }
    let given = false;
    return () => {
      if (given) return;
      given = true;
      release();
    };
  };
}

/**
 * **The one choke point of a finish.** `@browser-ai/web-llm` reports a generation cut off by the
 * context as a finished one (`length` becomes `stop`) and one interrupted as `other`; here neither
 * passes as an answer. An interrupted generation rejects as an `AbortError`. One cut off by the
 * context, where a structured answer was asked for — a JSON Schema or a grammar — rejects as
 * `llm/truncated`, since half a document is not a document; asked for text, it is returned with the
 * finish `length`, which a reader of text can see.
 */
function honest(result: LanguageModelV4GenerateResult, options: LanguageModelV4CallOptions): LanguageModelV4GenerateResult {
  const raw = result.finishReason.raw;
  if (raw === "abort") throw interrupted();
  if (raw !== "length") return result;
  if (options.responseFormat?.type === "json" || (options.providerOptions?.kanzo as LocalCallOptions | undefined)?.grammar) {
    throw new Problem("llm/truncated", "The answer did not fit the model's context", { reason: "context" });
  }
  return { ...result, finishReason: { unified: "length", raw } };
}

/** A stream held to its turn: the turn is given back when it ends, fails or is cancelled, and a generation interrupted ends it as an `AbortError`. */
function turnStream<T extends { type: string }>(source: ReadableStream<T>, release: () => void, firstToken?: () => void): ReadableStream<T> {
  const reader = source.getReader();
  let first = firstToken;
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
        } else if (value.type === "finish" && (value as { finishReason?: { raw?: string } }).finishReason?.raw === "abort") {
          release();
          controller.error(interrupted());
        } else {
          if (value.type === "text-delta" && first) {
            first();
            first = undefined;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    cancel(reason) {
      release();
      return reader.cancel(reason);
    },
  });
}

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

/** `id` on WebLLM, from `appConfig`: a grammar handed to the engine, and `<think>` lifted into reasoning. */
function webLLMEngine(id: string, appConfig: AppConfig, worker: Worker | undefined, report: (load: ModelLoad) => void): LocalEngine {
  const provider = webLLM(id, {
    worker,
    appConfig,
    initProgressCallback: (progress: WebLLMProgress) => report({ state: "loading", progress: progress.progress, text: progress.text }),
  });
  const turn = turns();
  /** The first call after the load is timed, from the asking to its first token (to its result, when asked whole). */
  let firstCall = true;
  const timed = (): { done(): void } | undefined => {
    if (!firstCall) return undefined;
    firstCall = false;
    const start = now();
    return { done: () => span("first-call", start, id) };
  };
  const model = wrapLanguageModel({
    model: provider,
    middleware: [
      {
        specificationVersion: "v4",
        wrapGenerate: async ({ doGenerate, params }) => {
          persist();
          const first = timed();
          const release = await turn(params.abortSignal);
          try {
            const grammar = (params.providerOptions?.kanzo as LocalCallOptions | undefined)?.grammar;
            const result = honest(grammar ? await generateHeld(provider, grammar, params) : await doGenerate(), params);
            first?.done();
            return result;
          } finally {
            release();
          }
        },
        wrapStream: async ({ doStream, params }) => {
          persist();
          const first = timed();
          const release = await turn(params.abortSignal);
          try {
            const result = await doStream();
            return { ...result, stream: turnStream(result.stream, release, first?.done) };
          } catch (error) {
            release();
            throw error;
          }
        },
      },
      // A model that thinks out loud (Qwen3, DeepSeek) does it between <think> tags.
      extractReasoningMiddleware({ tagName: "think" }),
    ],
  }) as LanguageModelV4;
  /**
   * A warm-up, by analogy and by reading the code, not by a measurement: model servers run one
   * before serving (llama.cpp does by default), and in WebLLM XGrammar's token table is built on the
   * first structured request and the GPU's pipelines run for the first time on the first generation.
   * So the load ends with one generation of two tokens under a trivial schema, in its turn. A warm-up
   * that fails changes nothing: the next call pays what it would have. `kanzo:llm:*` spans say
   * whether it was worth it (`/docs/design/failure#a-load-ends-warm`).
   */
  const warm = async () => {
    const start = now();
    const release = await turn();
    try {
      const engine = await (provider as unknown as { getEngine(): Promise<Engine> }).getEngine();
      await engine.chat.completions.create({
        messages: [{ role: "user", content: "{}" }],
        response_format: { type: "json_object", schema: JSON.stringify({ type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] }) },
        max_tokens: 2,
        temperature: 0,
        stream: false,
      });
    } catch {
      // Nothing to report: it was only practice.
    } finally {
      release();
      span("warm-up", start, id);
    }
  };
  return {
    model,
    load: async () => {
      const start = now();
      persist();
      await provider.createSessionWithProgress();
      span("load", start, id);
      report({ state: "loading", progress: 1, text: "Warming up" });
      await warm();
    },
  };
}

/*
 * What this page knows, by the key a caller asked with — a model id, or `""` for the first one
 * listed — and by the id it resolved to. One engine per model per page: two would be two copies of
 * the weights in the GPU's memory, so `localModel()` and `localModel(first)` share it.
 */
const IDLE: ModelLoad = { state: "idle" };
const loads = new Map<string, ModelLoad>();
const watchers = new Map<string, Set<() => void>>();
const fronts = new Map<string, LanguageModelV4>();
const resolving = new Map<string, Promise<Resolved>>();
const engines = new Map<string, Promise<Resolved>>();

interface Resolved {
  readonly id: string;
  readonly engine: LocalEngine;
  /** Every key asked for this engine, each told how its load stands. */
  readonly keys: Set<string>;
}

function publish(keys: Iterable<string>, load: ModelLoad) {
  for (const key of keys) {
    loads.set(key, load);
    for (const listener of watchers.get(key) ?? []) listener();
  }
}

/** The id `key` names: itself, or the first one registered, else the first the provider lists. */
async function idOf(key: string): Promise<string> {
  if (key) return key;
  const [registered] = registry().languageModels.keys();
  if (registered !== undefined) return registered;
  const [first] = await provider().models();
  if (first === undefined) throw unavailable("This page serves no models", "unserved");
  return first;
}

/** `id`'s engine, made once: the model registered for it, else the provider's. */
function engineOf(id: string): Promise<Resolved> {
  let known = engines.get(id);
  if (!known) {
    const keys = new Set([id]);
    const registered = registry().languageModels.get(id);
    known = (registered ? Promise.resolve(registered) : provider().languageModel(id, (load) => publish(keys, load))).then((engine) => ({ id, engine, keys }));
    engines.set(id, known);
    known.catch(() => engines.delete(id)); // Unserved or no WebGPU: asked again, it is asked afresh.
  }
  return known;
}

function resolve(key: string): Promise<Resolved> {
  let known = resolving.get(key);
  if (!known) {
    known = idOf(key)
      .then(engineOf)
      .then((resolved) => {
        if (!resolved.keys.has(key)) {
          resolved.keys.add(key);
          // The key now reads its model's load, unless that has not begun and the key's own has.
          if (localModelLoad(resolved.id) !== IDLE) publish([key], localModelLoad(resolved.id));
        }
        return resolved;
      });
    resolving.set(key, known);
    known.catch((error: unknown) => {
      resolving.delete(key);
      publish([key], { state: "failed", error });
    });
  }
  return known;
}

/**
 * Where the model's download and load stand in this page — `idle` until something loads or asks it,
 * `loading` with the engine's progress and words, then `ready` or `failed`. The same value until it
 * changes, so it is a snapshot `useSyncExternalStore` can hold; {@link watchLocalModel} says when.
 * Without an id, the model `localModel()` asks.
 */
export function localModelLoad(model?: string): ModelLoad {
  return loads.get(model ?? "") ?? IDLE;
}

/**
 * Calls `listener` each time {@link localModelLoad} changes for `model`, whichever screen started the
 * load, and answers the unsubscribe: `useSyncExternalStore((l) => watchLocalModel(id, l), () => localModelLoad(id))`.
 */
export function watchLocalModel(model: string | undefined, listener: () => void): () => void {
  const key = model ?? "";
  let set = watchers.get(key);
  if (!set) watchers.set(key, (set = new Set()));
  set.add(listener);
  return () => void set.delete(listener);
}

/**
 * `model` as a `LanguageModel`, resolved through the registry when it is first asked or loaded: the
 * model registered for that id, else the host's provider's ({@link setLocalProvider}), else WebLLM's
 * prebuilt list. **Without an id, the first model served** — registered, else listed — as the AI
 * SDK's `registry.languageModel(id)` names one only when it has to. A page that cannot run it fails
 * every call as `Problem` coded `llm/unavailable` — `reason` `"webgpu"` without WebGPU, before
 * anything is downloaded; `"unserved"` when nothing serves it — and the host says so rather than
 * waiting on a load that will not finish.
 */
export function localModel(model?: string): LanguageModel {
  const key = model ?? "";
  let front = fronts.get(key);
  if (!front) {
    let resolvedId: string | undefined;
    const engine = () => resolve(key).then((resolved) => ((resolvedId = resolved.id), resolved));
    // A call answered: whatever loading it waited on is done, though nothing called `load`.
    const answered = <T>(resolved: Resolved, result: T): T => {
      if (localModelLoad(resolved.id).state !== "ready") publish(resolved.keys, { state: "ready" });
      return result;
    };
    front = {
      specificationVersion: "v4",
      provider: "kanzo-local",
      get modelId() {
        return resolvedId ?? key;
      },
      supportedUrls: {},
      doGenerate: async (options) => {
        const resolved = await engine();
        return answered(resolved, await resolved.engine.model.doGenerate(options));
      },
      doStream: async (options) => {
        const resolved = await engine();
        return answered(resolved, await resolved.engine.model.doStream(options));
      },
    };
    fronts.set(key, front);
  }
  return front;
}

/**
 * Downloads and loads `model` now, before anything asks it: what a screen calls when it opens, so the
 * first question does not wait on the weights. Resolves when the engine is ready; rejects as
 * `localModel`'s calls do. The same engine `localModel(model)` answers with.
 */
export function loadLocalModel(model?: string): Promise<void> {
  const key = model ?? "";
  const state = localModelLoad(model).state;
  if (state !== "loading" && state !== "ready") publish([key], { state: "loading", progress: 0, text: "" });
  return resolve(key).then(({ id, engine, keys }) => {
    const now = localModelLoad(id).state;
    if (now !== "loading" && now !== "ready") publish(keys, { state: "loading", progress: 0, text: "" });
    return engine.load().then(
      () => publish(keys, { state: "ready" }),
      (error: unknown) => {
        publish(keys, { state: "failed", error });
        throw error;
      },
    );
  });
}

/**
 * The engine's side of {@link LocalProviderSettings.worker}, and the worker's whole script: `import { serveLocalModel } from "@kanzo-tech/llm/local"; serveLocalModel();`.
 */
export async function serveLocalModel(): Promise<void> {
  const { WebWorkerMLCEngineHandler } = await import("@browser-ai/web-llm");
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (message: MessageEvent) => handler.onmessage(message);
}
