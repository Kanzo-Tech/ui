import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supported = vi.fn(() => true);
const requests: Record<string, unknown>[] = [];
const made: { id: string; settings: Record<string, unknown> }[] = [];
const loaded: string[] = [];
const persist = vi.fn(async () => true);
vi.stubGlobal("navigator", { storage: { persist } });

vi.mock("@browser-ai/web-llm", () => ({
  doesBrowserSupportWebLLM: () => supported(),
  webLLM: (id: string, settings: Record<string, unknown>) => {
    made.push({ id, settings });
    return {
      specificationVersion: "v4",
      provider: "web-llm",
      modelId: id,
      supportedUrls: {},
      doGenerate: async () => ({
        content: [{ type: "text", text: "<think>counting</think>42" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }),
      doStream: async () => {
        throw new Error("not streamed here");
      },
      createSessionWithProgress: async () => {
        loaded.push(id);
      },
      // The engine the provider keeps private, which a grammar is handed to directly.
      getEngine: async () => ({
        chat: {
          completions: {
            create: async (request: Record<string, unknown>) => {
              requests.push(request);
              return { choices: [{ message: { content: "People : Person from User" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 5 } };
            },
          },
        },
        interruptGenerate: async () => {},
      }),
    };
  },
}));

// WebLLM's own list, in the shape it ships: Hugging Face URLs, and what it knows of each model.
vi.mock("@mlc-ai/web-llm", () => ({
  prebuiltAppConfig: {
    model_list: [
      {
        model: "https://huggingface.co/mlc-ai/Qwen3-8B-q4f16_1-MLC",
        model_id: "Qwen3-8B-q4f16_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Qwen3-8B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        overrides: { context_window_size: 4096 },
        vram_required_MB: 3431.59,
        low_resource_required: true,
        required_features: ["shader-f16"],
        integrity: { config: "sha256-prebuilt" },
      },
    ],
  },
}));

const { loadLocalModel, localModel, localModelLoad, watchLocalModel } = await import("./local");
const { AiError } = await import("./error");

beforeEach(() => {
  supported.mockReturnValue(true);
});

describe("localModel", () => {
  it("holds the model to a grammar a call passes, on the engine itself", async () => {
    const grammar = 'root ::= "People : Person from User"';
    const { text } = await generateText({
      model: localModel("Qwen3-4B-q4f16_1-MLC"),
      system: "Write the mapping.",
      prompt: "User",
      providerOptions: { kanzo: { grammar } },
    });
    expect(text).toBe("People : Person from User");
    expect(requests.at(-1)).toMatchObject({
      response_format: { type: "grammar", grammar },
      messages: [
        { role: "system", content: "Write the mapping." },
        { role: "user", content: "User" },
      ],
    });
  });

  it("answers through WebLLM, with what the model thought kept apart from what it said", async () => {
    const { text, reasoningText } = await generateText({ model: localModel("Qwen3-4B-q4f16_1-MLC"), prompt: "?" });
    expect(text).toBe("42");
    expect(reasoningText).toBe("counting");
  });

  it("makes one engine per model per page", () => {
    const before = made.length;
    const a = localModel("Llama-3.2-3B-Instruct-q4f16_1-MLC");
    const b = localModel("Llama-3.2-3B-Instruct-q4f16_1-MLC");
    expect(a).toBe(b);
    expect(made.length).toBe(before + 1);
  });

  it("hands WebLLM the worker, and reports the load in WebLLM's words to whoever watches it", async () => {
    const worker = {} as Worker;
    const id = "Hermes-3-Llama-3.2-3B-q4f16_1-MLC";
    const seen: unknown[] = [];
    const unwatch = watchLocalModel(id, () => seen.push(localModelLoad(id)));
    expect(localModelLoad(id)).toEqual({ state: "idle" });
    localModel(id, { worker });
    const { settings } = made.at(-1)!;
    expect(settings.worker).toBe(worker);
    const loading = loadLocalModel(id);
    (settings.initProgressCallback as (r: { progress: number; text: string; timeElapsed: number }) => void)({
      progress: 0.5,
      text: "Fetching param cache[3/10]",
      timeElapsed: 1,
    });
    expect(localModelLoad(id)).toEqual({ state: "loading", progress: 0.5, text: "Fetching param cache[3/10]" });
    // The same value until it changes: a snapshot `useSyncExternalStore` can hold.
    expect(localModelLoad(id)).toBe(localModelLoad(id));
    await loading;
    expect(localModelLoad(id)).toEqual({ state: "ready" });
    unwatch();
    expect(seen).toEqual([
      { state: "loading", progress: 0, text: "" },
      { state: "loading", progress: 0.5, text: "Fetching param cache[3/10]" },
      { state: "ready" },
    ]);
  });

  it("reports a load that cannot happen as failed, with what stopped it", async () => {
    supported.mockReturnValue(false);
    const id = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
    await expect(loadLocalModel(id)).rejects.toMatchObject({ code: "ai/unavailable" });
    expect(localModelLoad(id)).toMatchObject({ state: "failed", error: { code: "ai/unavailable" } });
  });

  it("fails as ai/unavailable without WebGPU, before anything loads", async () => {
    supported.mockReturnValue(false);
    const call = generateText({ model: localModel("Qwen3-1.7B-q4f16_1-MLC"), prompt: "?" });
    await expect(call).rejects.toBeInstanceOf(AiError);
    await expect(call).rejects.toMatchObject({ code: "ai/unavailable", data: { reason: "webgpu" } });
  });

  it("loads from where the host serves the model, when it says", () => {
    localModel("kanzo-tasks-q4", { from: { weights: "https://models.example/kanzo-tasks-q4/", library: "https://models.example/kanzo-tasks-q4.wasm" } });
    expect(made.at(-1)!.settings.appConfig).toEqual({
      model_list: [
        { model: "https://models.example/kanzo-tasks-q4/", model_id: "kanzo-tasks-q4", model_lib: "https://models.example/kanzo-tasks-q4.wasm" },
      ],
    });
  });

  it("keeps what WebLLM's prebuilt list says of a model the host serves itself, but not where it was", () => {
    localModel("Qwen3-8B-q4f16_1-MLC", { from: { weights: "/models/qwen3-8b/", library: "/models/qwen3-8b.wasm" } });
    expect(made.at(-1)!.settings.appConfig).toEqual({
      model_list: [
        {
          model: "/models/qwen3-8b/",
          model_id: "Qwen3-8B-q4f16_1-MLC",
          model_lib: "/models/qwen3-8b.wasm",
          overrides: { context_window_size: 4096 },
          vram_required_MB: 3431.59,
          low_resource_required: true,
          required_features: ["shader-f16"],
        },
      ],
    });
  });

  it("loads ahead of the first call, on the one engine, and asks once for the storage to persist", async () => {
    const before = made.length;
    const already = loaded.length;
    const model = localModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    await loadLocalModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    await loadLocalModel("Phi-3.5-mini-instruct-q4f16_1-MLC");
    expect(loaded.slice(already)).toEqual(["SmolLM2-1.7B-Instruct-q4f16_1-MLC", "Phi-3.5-mini-instruct-q4f16_1-MLC"]);
    expect(made.length).toBe(before + 2);
    expect(localModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC")).toBe(model);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("refuses to load without WebGPU, as a call does", async () => {
    supported.mockReturnValue(false);
    await expect(loadLocalModel("gemma-2-2b-it-q4f16_1-MLC")).rejects.toMatchObject({ code: "ai/unavailable" });
  });
});
