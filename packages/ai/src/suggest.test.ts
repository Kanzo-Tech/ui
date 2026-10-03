import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { suggest } from "./suggest.js";
import { mockModel, promptOf } from "./testing/model.js";

const QUESTIONS = JSON.stringify({
  elements: [
    { question: "How many contracts are late?", rationale: "closed and due" },
    { question: "Which region signs the most?", rationale: "region" },
  ],
});

describe("suggest", () => {
  it("streams each question with its rationale, asked over the host's instructions and material", async () => {
    const { model } = mockModel(() => QUESTIONS);
    const got = [];
    for await (const q of suggest({ model, instructions: "Suggest questions.", prompt: "CREATE TABLE t (x INT);" })) got.push(q);
    expect(got).toEqual([
      { question: "How many contracts are late?", rationale: "closed and due" },
      { question: "Which region signs the most?", rationale: "region" },
    ]);
    expect(promptOf(model.doStreamCalls[0]!)).toContain("CREATE TABLE t");
  });

  it("throws what stopped the model, rather than ending as if it had nothing to suggest", async () => {
    const refused = new Error("gateway refused");
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw refused;
      },
    });
    const drain = async () => {
      for await (const _ of suggest({ model, instructions: "", prompt: "" })) void _;
    };
    await expect(drain()).rejects.toBe(refused);
  });
});
