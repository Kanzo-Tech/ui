import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { APICallError, Output, jsonSchema } from "ai";
import { generate } from "./generate.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** A model that answers `text` whole, and keeps the provider options it was handed. */
function answering(text: string) {
  const seen: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (call) => {
      seen.push(call.providerOptions);
      return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
    },
  });
  return { model, seen };
}

describe("generate", () => {
  it("reads an object whole, and hands the provider its options", async () => {
    const { model, seen } = answering(JSON.stringify({ of: "Award" }));
    const { output } = await generate({
      model,
      prompt: "?",
      output: Output.object({ schema: jsonSchema<{ of: string }>({ type: "object", properties: { of: { type: "string" } } }) }),
      providerOptions: { kanzo: { grammar: "root ::= x" } },
    });
    expect(output).toEqual({ of: "Award" });
    expect(seen[0]).toEqual({ kanzo: { grammar: "root ::= x" } });
  });

  it("never retries a refused call", async () => {
    const refused = new APICallError({ message: "overloaded", url: "local://model", requestBodyValues: {}, statusCode: 503, isRetryable: true });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw refused;
      },
    });
    await expect(generate({ model, prompt: "" })).rejects.toThrow("overloaded");
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
