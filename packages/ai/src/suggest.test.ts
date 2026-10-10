import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { suggest } from "./suggest.js";
import { mockModel, promptOf } from "./testing/model.js";

const QUESTIONS = JSON.stringify({
  elements: [
    { text: "How many contracts are late?", rationale: "closed and due" },
    { text: "Which region signs the most?", rationale: "region" },
  ],
});

describe("suggest", () => {
  it("streams each offer with its rationale, asked over the host's instructions and material", async () => {
    const { model } = mockModel(() => QUESTIONS);
    const got = [];
    for await (const q of suggest({ model, instructions: "Suggest questions.", prompt: "CREATE TABLE t (x INT);" })) got.push(q);
    expect(got).toEqual([
      { text: "How many contracts are late?", rationale: "closed and due" },
      { text: "Which region signs the most?", rationale: "region" },
    ]);
    expect(promptOf(model.doStreamCalls[0]!)).toContain("CREATE TABLE t");
  });

  it("stops at the count asked for, however many the model writes", async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `Q${i}`, rationale: "r" }));
    const { model } = mockModel(() => JSON.stringify({ elements: five }));
    const got = [];
    for await (const q of suggest({ model, instructions: "", prompt: "", count: 2 })) got.push(q.text);
    expect(got).toEqual(["Q0", "Q1"]);
  });

  it("offers a repeated text once, and a repeat does not use up the count", async () => {
    const offers = [
      { text: "Which region signs the most?", rationale: "a" },
      { text: " which region signs the MOST? ", rationale: "b" },
      { text: "How many are late?", rationale: "c" },
    ];
    const { model } = mockModel(() => JSON.stringify({ elements: offers }));
    const got = [];
    for await (const q of suggest({ model, instructions: "", prompt: "", count: 2 })) got.push(q.text);
    expect(got).toEqual(["Which region signs the most?", "How many are late?"]);
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
