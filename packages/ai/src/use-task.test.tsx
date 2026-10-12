import { act, render, screen, waitFor } from "@testing-library/react";
import { jsonSchema } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { defineTask } from "./task/index.js";
import { useTask, type TaskList } from "./use-task.js";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const offering = (values: unknown[]) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify({ elements: values }) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });

/** A competency question, which must end in a question mark. */
const questions = defineTask<string, { text: string }>({
  name: "questions",
  instructions: "Offer questions.",
  prompt: (domain) => domain,
  output: () => jsonSchema({ type: "object", properties: { text: { type: "string" } }, required: ["text"] }),
  verify: [(value) => (value.text.endsWith("?") ? undefined : { code: "not-a-question", message: "a question ends in ?" })],
});

let list: TaskList<{ text: string }>;
function Screen({ model }: { model: MockLanguageModelV4 }) {
  list = useTask(questions, "prizes", { model, count: 3 });
  return <p>{list.state}</p>;
}

describe("useTask", () => {
  it("asks only when told, and keeps what the oracles accept", async () => {
    const model = offering([{ text: "Who won?" }, { text: "not one" }, { text: "When?" }]);
    render(<Screen model={model} />);
    expect(screen.getByText("idle")).toBeTruthy();
    expect(model.doGenerateCalls).toHaveLength(0);
    act(() => list.propose());
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());
    expect(list.proposals.map((p) => p.value.text)).toEqual(["Who won?", "When?"]);
  });

  it("checks an edit with no model, and keeps it with its verdict; a dismissal takes it off", async () => {
    const model = offering([{ text: "Who won?" }, { text: "When?" }]);
    render(<Screen model={model} />);
    act(() => list.propose());
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());
    const [first, second] = list.proposals;
    await act(() => list.edit(first!.id, { text: "who won" }));
    expect(list.proposals[0]).toMatchObject({ value: { text: "who won" }, verdict: { ok: false, diagnostics: [{ code: "not-a-question" }] } });
    expect(model.doGenerateCalls).toHaveLength(1);
    act(() => list.dismiss(second!.id));
    expect(list.proposals).toHaveLength(1);
  });
});
