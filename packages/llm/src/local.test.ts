import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supported = vi.fn(() => true);
const requests: Record<string, unknown>[] = [];
const made: { id: string; settings: Record<string, unknown> }[] = [];

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

const { localModel } = await import("./local");
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

  it("hands WebLLM the worker and reports its progress in its own words", () => {
    const onProgress = vi.fn();
    const worker = {} as Worker;
    localModel("Hermes-3-Llama-3.2-3B-q4f16_1-MLC", { worker, onProgress });
    const { settings } = made.at(-1)!;
    expect(settings.worker).toBe(worker);
    (settings.initProgressCallback as (r: { progress: number; text: string; timeElapsed: number }) => void)({
      progress: 0.5,
      text: "Fetching param cache[3/10]",
      timeElapsed: 1,
    });
    expect(onProgress).toHaveBeenCalledWith({ progress: 0.5, text: "Fetching param cache[3/10]" });
  });

  it("fails as ai/unavailable without WebGPU, before anything loads", async () => {
    supported.mockReturnValue(false);
    const call = generateText({ model: localModel("Qwen3-1.7B-q4f16_1-MLC"), prompt: "?" });
    await expect(call).rejects.toBeInstanceOf(AiError);
    await expect(call).rejects.toMatchObject({ code: "ai/unavailable", data: { reason: "webgpu" } });
  });
});
