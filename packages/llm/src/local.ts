import { doesBrowserSupportWebLLM, webLLM, type WebLLMProgress } from "@browser-ai/web-llm";
import { extractReasoningMiddleware, type LanguageModel, wrapLanguageModel } from "ai";

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
        wrapGenerate: ({ doGenerate }) => (doesBrowserSupportWebLLM() ? doGenerate() : Promise.reject(unavailable())),
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
