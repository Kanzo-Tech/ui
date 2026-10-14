import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supported = vi.fn(() => true);
const requests: Record<string, unknown>[] = [];
const made: { id: string; settings: Record<string, unknown> }[] = [];
const loaded: string[] = [];
/** A load that waits for its test to let it finish, by model id. */
const gates = new Map<string, Promise<void>>();
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
        await gates.get(id);
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
const PREBUILT = [
  "Qwen3-4B-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen3-1.7B-q4f16_1-MLC",
  "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
  "Phi-3.5-mini-instruct-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
];
vi.mock("@mlc-ai/web-llm", () => ({
  prebuiltAppConfig: {
    model_list: PREBUILT.map((id) => ({ model: `https://huggingface.co/mlc-ai/${id}`, model_id: id, model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/${id}-webgpu.wasm` })),
  },
}));

const served = new Map<string, unknown>();
const fetched: string[] = [];
vi.stubGlobal("location", { href: "https://keasy.example/ask" });
vi.stubGlobal("fetch", async (url: URL) => {
  fetched.push(url.href);
  const body = served.get(url.href);
  return body === undefined ? new Response("Not Found", { status: 404 }) : Response.json(body);
});

const { loadLocalModel, localModel, localModelLoad, localProvider, setLocalProvider, watchLocalModel } = await import("./local");
const { LlmError } = await import("./error");
const { dom } = await import("@kanzo-tech/testing/dom");

const REGISTRY = Symbol.for("@kanzo-tech/llm/local");
const scope = globalThis as { [key: symbol]: unknown };

beforeEach(() => {
  supported.mockReturnValue(true);
  delete scope[REGISTRY];
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

  it("makes one engine per model per page", async () => {
    const before = made.length;
    const a = localModel("Llama-3.2-3B-Instruct-q4f16_1-MLC");
    expect(localModel("Llama-3.2-3B-Instruct-q4f16_1-MLC")).toBe(a);
    await generateText({ model: a, prompt: "?" });
    await generateText({ model: localModel("Llama-3.2-3B-Instruct-q4f16_1-MLC"), prompt: "?" });
    expect(made.length).toBe(before + 1);
  });

  it("hands WebLLM the worker, and reports the load in WebLLM's words to whoever watches it", async () => {
    const worker = {} as Worker;
    setLocalProvider(localProvider({ worker }));
    const id = "Hermes-3-Llama-3.2-3B-q4f16_1-MLC";
    const seen: unknown[] = [];
    const unwatch = watchLocalModel(id, () => seen.push(localModelLoad(id)));
    expect(localModelLoad(id)).toEqual({ state: "idle" });
    let finish = () => {};
    gates.set(id, new Promise<void>((resolve) => (finish = resolve)));
    const loading = loadLocalModel(id);
    await vi.waitFor(() => expect(made.at(-1)?.id).toBe(id));
    const { settings } = made.at(-1)!;
    expect(settings.worker).toBe(worker);
    (settings.initProgressCallback as (r: { progress: number; text: string; timeElapsed: number }) => void)({
      progress: 0.5,
      text: "Fetching param cache[3/10]",
      timeElapsed: 1,
    });
    expect(localModelLoad(id)).toEqual({ state: "loading", progress: 0.5, text: "Fetching param cache[3/10]" });
    // The same value until it changes: a snapshot `useSyncExternalStore` can hold.
    expect(localModelLoad(id)).toBe(localModelLoad(id));
    finish();
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
    await expect(loadLocalModel(id)).rejects.toMatchObject({ code: "llm/unavailable" });
    expect(localModelLoad(id)).toMatchObject({ state: "failed", error: { code: "llm/unavailable" } });
  });

  it("fails as llm/unavailable without WebGPU, before anything loads or is fetched", async () => {
    supported.mockReturnValue(false);
    setLocalProvider(localProvider({ baseURL: "/models" }));
    const before = fetched.length;
    const call = generateText({ model: localModel("Qwen3-1.7B-q4f16_1-MLC"), prompt: "?" });
    await expect(call).rejects.toBeInstanceOf(LlmError);
    await expect(call).rejects.toMatchObject({ code: "llm/unavailable", data: { reason: "webgpu" } });
    expect(fetched.length).toBe(before);
  });

  it("loads ahead of the first call, on the one engine, and asks once for the storage to persist", async () => {
    const before = made.length;
    const already = loaded.length;
    const model = localModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    await loadLocalModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    await loadLocalModel("Phi-3.5-mini-instruct-q4f16_1-MLC");
    expect(loaded.slice(already)).toEqual(["SmolLM2-1.7B-Instruct-q4f16_1-MLC", "Phi-3.5-mini-instruct-q4f16_1-MLC"]);
    expect(made.length).toBe(before + 2);
    await generateText({ model, prompt: "?" });
    expect(made.length).toBe(before + 2);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("refuses to load without WebGPU, as a call does", async () => {
    supported.mockReturnValue(false);
    await expect(loadLocalModel("gemma-2-2b-it-q4f16_1-MLC")).rejects.toMatchObject({ code: "llm/unavailable" });
  });
});

describe("localProvider, served from the host's own origin", () => {
  it("is unserved when the listing is missing, lists nothing, or does not list the id asked", async () => {
    setLocalProvider(localProvider({ baseURL: "/nothing" }));
    await expect(loadLocalModel()).rejects.toMatchObject({ code: "llm/unavailable", data: { reason: "unserved" } });
    expect(localModelLoad()).toMatchObject({ state: "failed", error: { data: { reason: "unserved" } } });
    served.set("https://keasy.example/empty/app-config.json", { model_list: [] });
    setLocalProvider(localProvider({ baseURL: "/empty/" }));
    await expect(generateText({ model: localModel("nothing-at-all"), prompt: "?" })).rejects.toMatchObject({ data: { reason: "unserved" } });
    served.set("https://keasy.example/one/app-config.json", { model_list: [{ model: "a/", model_id: "served-a", model_lib: "a.wasm" }] });
    setLocalProvider(localProvider({ baseURL: "/one" }));
    await expect(loadLocalModel("not-served")).rejects.toMatchObject({ data: { reason: "unserved" } });
  });

  it("serves every model its app-config.json lists, in order, the first when no id is asked, with WebLLM's config handed on as written", async () => {
    served.set("https://keasy.example/served/app-config.json", {
      model_list: [
        { model: "Qwen3-4B-MLC/resolve/a5c9fab/", model_id: "served-qwen3-4b", model_lib: "lib/v0_2_86/Qwen3-4B.wasm", overrides: { context_window_size: 4096 } },
        { model: "https://keasy.example/elsewhere/gemma/", model_id: "served-gemma", model_lib: "/lib/gemma.wasm" },
      ],
      cacheBackend: "indexeddb",
    });
    const provider = localProvider({ baseURL: "/served" });
    setLocalProvider(provider);
    expect(await provider.models()).toEqual(["served-qwen3-4b", "served-gemma"]);
    const { text } = await generateText({ model: localModel(), prompt: "?" });
    expect(text).toBe("42");
    expect(made.at(-1)!.id).toBe("served-qwen3-4b");
    expect(made.at(-1)!.settings.appConfig).toEqual({
      model_list: [
        {
          model: "https://keasy.example/served/Qwen3-4B-MLC/resolve/a5c9fab/",
          model_id: "served-qwen3-4b",
          model_lib: "https://keasy.example/served/lib/v0_2_86/Qwen3-4B.wasm",
          overrides: { context_window_size: 4096 },
        },
        { model: "https://keasy.example/elsewhere/gemma/", model_id: "served-gemma", model_lib: "https://keasy.example/lib/gemma.wasm" },
      ],
      cacheBackend: "indexeddb",
    });
    // The first listed and the same id asked by name are one engine.
    const before = made.length;
    await generateText({ model: localModel("served-qwen3-4b"), prompt: "?" });
    expect(made.length).toBe(before);
    expect(localModelLoad()).toEqual({ state: "ready" });
  });
});

describe("localModel, when a test registered a provider for its id", () => {
  type Hook = { __KANZO_TESTING__?: { models: Map<string, { prompts: string[] }> } };
  const hook = globalThis as Hook;
  afterEach(() => void delete hook.__KANZO_TESTING__);

  it("answers from the script registered for its id, records the prompt, and never reaches WebLLM", async () => {
    supported.mockReturnValue(false);
    const before = made.length;
    dom({} as HTMLElement, { models: { "Qwen3-0.6B-scripted": { turns: [{ when: "How many", reply: { text: "Four." } }] } } });
    await loadLocalModel("Qwen3-0.6B-scripted");
    expect(localModelLoad("Qwen3-0.6B-scripted")).toEqual({ state: "ready" });
    const { text } = await generateText({ model: localModel("Qwen3-0.6B-scripted"), prompt: "How many laureates?" });
    expect(text).toBe("Four.");
    expect(hook.__KANZO_TESTING__?.models.get("Qwen3-0.6B-scripted")?.prompts).toEqual(["How many laureates?"]);
    expect(made.length).toBe(before);
  });

  it("asks the first scripted id when no id is asked, before the host's provider lists anything", async () => {
    // A fresh page: `localModel()` resolved in an earlier test, and one page resolves it once.
    vi.resetModules();
    const page = await import("./local");
    page.setLocalProvider(page.localProvider({ baseURL: "/never-fetched" }));
    const before = fetched.length;
    dom({} as HTMLElement, { models: { "first-scripted": { turns: [{ reply: { text: "First." } }] }, "second-scripted": { turns: [] } } });
    const { text } = await generateText({ model: page.localModel(), prompt: "?" });
    expect(text).toBe("First.");
    expect(page.localModelLoad()).toEqual({ state: "ready" });
    expect(fetched.length).toBe(before);
  });

  it("fails the load with the script's words, as WebLLM's does when a shard cannot be fetched", async () => {
    dom({} as HTMLElement, { models: { "Qwen3-1.7B-scripted": { turns: [], load: { fail: "Cannot fetch params_shard_0.bin" } } } });
    await expect(loadLocalModel("Qwen3-1.7B-scripted")).rejects.toThrow("Cannot fetch params_shard_0.bin");
    expect(localModelLoad("Qwen3-1.7B-scripted")).toMatchObject({ state: "failed" });
  });

  it("answers with WebLLM when nothing registered the id", async () => {
    const before = made.length;
    await generateText({ model: localModel("gemma-2-2b-it-q4f16_1-MLC"), prompt: "?" });
    expect(made.length).toBe(before + 1);
  });
});
