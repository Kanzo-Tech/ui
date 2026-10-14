import { APICallError, jsonSchema } from "ai";
import { promptOf, scriptedModel } from "@kanzo-tech/llm/testing";
import { answering } from "../testing/nobel.js";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { defineTask, propose, runTask, type RunOptions } from "./index.js";

type TaskState = Parameters<NonNullable<RunOptions["onState"]>>[0];

type Count = { of: string; by?: string };

const count = defineTask<{ question: string }, Count, readonly string[]>({
  name: "count",
  context: () => ["Award", "University", "Country"],
  instructions: "Fill the spec.",
  prompt: (input, types) => `${input.question}\nTypes: ${types.join(", ")}`,
  output: (_, types) =>
    jsonSchema<Count>({
      type: "object",
      properties: { of: { type: "string", enum: [...types] }, by: { type: "string", enum: [...types] } },
      required: ["of"],
      additionalProperties: false,
    }),
  verify: [
    (value) => (value.of === value.by ? { code: "same", message: "of and by are the same type", at: "/by" } : undefined),
    (value) =>
      value.by === "Country"
        ? {
            decision: {
              id: "whichCountry",
              question: "Which country of a prize?",
              options: [
                { id: "laureate", label: "Where its laureate was born" },
                { id: "university", label: "Where its university is" },
              ],
            },
          }
        : undefined,
  ],
});

describe("runTask", () => {
  it("is done on a first answer every oracle accepts, and says where it lands", async () => {
    const model = answering({ of: "Award", by: "University" });
    const states: TaskState[] = [];
    const proposal = await runTask(count, { question: "Prizes by university?" }, { model, onState: (s) => states.push(s), id: "p1" });
    expect(proposal).toEqual({
      id: "p1",
      task: "count",
      value: { of: "Award", by: "University" },
      target: { add: "" },
      verdict: { ok: true },
      attempts: 1,
    });
    expect(states).toEqual(["linking", "drafting", "verifying", "done"]);
  });

  it("sends what the oracles found back, with where, and takes the repaired answer", async () => {
    const model = answering({ of: "Award", by: "Award" }, { of: "Award", by: "University" });
    const proposal = await runTask(count, { question: "Prizes by university?" }, { model });
    expect(proposal.verdict).toEqual({ ok: true });
    expect(proposal.attempts).toBe(2);
    expect(promptOf(model.doGenerateCalls[1]!)).toContain("/by: of and by are the same type");
  });

  it("answers with the diagnostics once the attempts run out", async () => {
    const model = answering({ of: "Award", by: "Award" });
    const proposal = await runTask({ ...count, attempts: 2 }, { question: "?" }, { model });
    expect(proposal.verdict).toEqual({ ok: false, diagnostics: [{ code: "same", message: "of and by are the same type", at: "/by" }] });
    expect(proposal.attempts).toBe(2);
  });

  it("stops at a decision it has no safe default for, and asks with options", async () => {
    const model = answering({ of: "Award", by: "Country" });
    const states: TaskState[] = [];
    const proposal = await runTask(count, { question: "Prizes by country?" }, { model, onState: (s) => states.push(s) });
    expect(proposal.verdict).toMatchObject({ ok: false, decision: { id: "whichCountry" } });
    expect(states.at(-1)).toBe("needs-input");
  });

  it("takes the assumed option of a decision it settles, and says so", async () => {
    const model = answering({ of: "Award", by: "Country" });
    const proposal = await runTask({ ...count, decide: { whichCountry: { assume: "university" } } }, { question: "?" }, { model });
    expect(proposal.verdict).toMatchObject({ ok: true, assumed: [{ decision: { id: "whichCountry" }, option: "university" }] });
  });
});

describe("propose", () => {
  it("offers only what every oracle accepts, with no decision left open, at most as many as asked", async () => {
    const model = answering({
      elements: [
        { of: "Award", by: "University" },
        { of: "Award", by: "Award" },
        { of: "Award", by: "Country" },
        { of: "University" },
        { of: "Country" },
      ],
    });
    const offered = await propose(count, { question: "" }, { model, count: 2 });
    expect(offered.map((p) => p.value)).toEqual([{ of: "Award", by: "University" }, { of: "University" }]);
    expect(promptOf(model.doGenerateCalls[0]!)).toContain("Offer 2");
  });

  it("throws what stopped the model, rather than offering nothing", async () => {
    const refused = new Error("the model refused");
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw refused;
      },
    });
    await expect(propose(count, { question: "" }, { model, count: 2 })).rejects.toBe(refused);
  });
});

describe("a Task's model call", () => {
  it("asks once: an error the SDK would retry is the failure, not a retry after it", async () => {
    // A retryable `APICallError` is what the AI SDK's own retry reads; with its default, this was asked three times.
    const refused = new APICallError({ message: "overloaded", url: "local://model", requestBodyValues: {}, statusCode: 503, isRetryable: true });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw refused;
      },
    });
    await expect(runTask(count, { question: "?" }, { model })).rejects.toThrow("overloaded");
    expect(model.doGenerateCalls).toHaveLength(1);
    await expect(propose(count, { question: "" }, { model, count: 2 })).rejects.toThrow("overloaded");
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});

describe("a Task held to a grammar", () => {
  it("asks for text with the grammar beside the prompt, and checks it as any artefact", async () => {
    const model = scriptedModel({
      turns: [{ once: true, reply: { text: "People : Person from Usr" } }, { reply: { text: "People : Person from User" } }],
    });
    const mapping = defineTask<string, string>({
      name: "mapping",
      instructions: "Write the mapping.",
      prompt: (sources) => sources,
      grammar: () => 'root ::= "People : Person from " ("User" | "Usr")',
      verify: [(text) => (text.endsWith("User") ? undefined : { code: "unknown-source", message: "Usr is not a source" })],
    });
    const proposal = await runTask(mapping, "User", { model });
    expect(model.doGenerateCalls[0]?.providerOptions).toEqual({ kanzo: { grammar: 'root ::= "People : Person from " ("User" | "Usr")' } });
    expect(proposal).toMatchObject({ value: "People : Person from User", attempts: 2, verdict: { ok: true } });
  });
});
