import { describe, expect, it } from "vitest";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { Output, jsonSchema } from "ai";
import { stream } from "./stream.js";

/** A model that streams `text` in one delta, then finishes. */
function answering(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

const refusing = (error: unknown) =>
  new MockLanguageModelV4({
    doStream: async () => {
      throw error;
    },
  });

async function drain<T>(source: AsyncIterable<T>): Promise<T[]> {
  const got: T[] = [];
  for await (const value of source) got.push(value);
  return got;
}

describe("stream", () => {
  it("reads an array's elements as each is whole", async () => {
    const model = answering(JSON.stringify({ elements: ["a", "b"] }));
    const s = stream({ model, prompt: "two", output: Output.array({ element: jsonSchema<string>({ type: "string" }) }) });
    expect(await drain(s.elements)).toEqual(["a", "b"]);
  });

  it("reads plain text", async () => {
    expect((await drain(stream({ model: answering("hello"), prompt: "hi" }).text)).join("")).toBe("hello");
  });

  it("throws what stopped the model once the stream ends, rather than ending as if it had finished", async () => {
    const refused = new Error("gateway refused");
    await expect(drain(stream({ model: refusing(refused), prompt: "" }).text)).rejects.toBe(refused);
    await expect(
      drain(stream({ model: refusing(refused), prompt: "", output: Output.array({ element: jsonSchema<string>({ type: "string" }) }) }).elements),
    ).rejects.toBe(refused);
  });

  it("never retries a refused call", async () => {
    const model = refusing(Object.assign(new Error("overloaded"), { isRetryable: true }));
    await expect(drain(stream({ model, prompt: "" }).text)).rejects.toThrow("overloaded");
    expect(model.doStreamCalls).toHaveLength(1);
  });
});
