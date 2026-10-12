import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { candidates } from "./proposals.js";
import { mockModel, promptOf } from "./testing/model.js";

const field = { name: "Region" };
const asked = (count: number, value = "") => ({ value, existing: [], signal: new AbortController().signal, count, list: value === "" });
const drain = async (offers: AsyncIterable<{ text: string; rationale?: string; range?: [number, number] }>) => {
  const got = [];
  for await (const offer of offers) got.push(offer);
  return got;
};

describe("candidates", () => {
  it("streams each value with its rationale, asked over the field's brief", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "North", rationale: "a region" }, { text: "South", rationale: "another" }] }));
    expect(await drain(candidates(model, field, asked(2)))).toEqual([
      { text: "North", rationale: "a region" },
      { text: "South", rationale: "another" },
    ]);
    expect(promptOf(model.doStreamCalls[0]!)).toContain("Field: Region");
  });

  it("replaces the whole value when the field holds one", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "North", rationale: "r" }] }));
    expect(await drain(candidates(model, field, asked(1, "Nort")))).toEqual([{ text: "North", rationale: "r", range: [0, 4] }]);
  });

  it("stops at the count asked for, however many the model writes", async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `R${i}`, rationale: "r" }));
    const { model } = mockModel(() => JSON.stringify({ elements: five }));
    expect((await drain(candidates(model, field, asked(2)))).map((o) => o.text)).toEqual(["R0", "R1"]);
  });

  it("offers a repeated value once, and a repeat does not use up the count", async () => {
    const offers = [
      { text: "North West", rationale: "a" },
      { text: " north  WEST ", rationale: "b" },
      { text: "South", rationale: "c" },
    ];
    const { model } = mockModel(() => JSON.stringify({ elements: offers }));
    expect((await drain(candidates(model, field, asked(2)))).map((o) => o.text)).toEqual(["North West", "South"]);
  });

  it("throws what stopped the model, rather than ending as if it had nothing to offer", async () => {
    const refused = new Error("the model refused");
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw refused;
      },
    });
    await expect(drain(candidates(model, field, asked(2)))).rejects.toBe(refused);
  });
});
