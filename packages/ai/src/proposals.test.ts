import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { candidates } from "./proposals.js";
import type { Proposal } from "./task/index.js";
import { mockModel, promptOf } from "./testing/model.js";

const field = { name: "Region" };
const asked = (count: number, value = "") => ({ value, existing: [], signal: new AbortController().signal, count, list: value === "" });
const drain = async (offers: AsyncIterable<Proposal<string>>) => {
  const got = [];
  for await (const offer of offers) got.push(offer);
  return got;
};

describe("candidates", () => {
  it("proposes each value with its rationale through the candidates Task, asked over the field's brief", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "North", rationale: "a region" }, { text: "South", rationale: "another" }] }));
    const offered = await drain(candidates(model, field, asked(2)));
    expect(offered.map(({ task, value, rationale, target }) => ({ task, value, rationale, target }))).toEqual([
      { task: "candidates", value: "North", rationale: "a region", target: { add: "" } },
      { task: "candidates", value: "South", rationale: "another", target: { add: "" } },
    ]);
    expect(promptOf(model.doGenerateCalls[0]!)).toContain("Field: Region");
  });

  it("replaces the whole value when the field holds one", async () => {
    const { model } = mockModel(() => JSON.stringify({ elements: [{ text: "North", rationale: "r" }] }));
    const [north] = await drain(candidates(model, field, asked(1, "Nort")));
    expect(north).toMatchObject({ value: "North", rationale: "r", target: { replace: [0, 4] } });
  });

  it("stops at the count asked for, however many the model writes", async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `R${i}`, rationale: "r" }));
    const { model } = mockModel(() => JSON.stringify({ elements: five }));
    expect((await drain(candidates(model, field, asked(2)))).map((o) => o.value)).toEqual(["R0", "R1"]);
  });

  // `propose` keeps at most the count the model was asked for, so a repeat among them is one fewer
  // offer rather than a call for another: the model was told to make them differ.
  it("offers a repeated value once", async () => {
    const offers = [
      { text: "North West", rationale: "a" },
      { text: " north  WEST ", rationale: "b" },
      { text: "South", rationale: "c" },
    ];
    const { model } = mockModel(() => JSON.stringify({ elements: offers }));
    expect((await drain(candidates(model, field, asked(3)))).map((o) => o.value)).toEqual(["North West", "South"]);
  });

  it("throws what stopped the model, rather than ending as if it had nothing to offer", async () => {
    const refused = new Error("the model refused");
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw refused;
      },
    });
    await expect(drain(candidates(model, field, asked(2)))).rejects.toBe(refused);
  });
});
