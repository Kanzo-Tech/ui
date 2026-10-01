// A model for tests, from the AI SDK's own mock: no network, and every call recorded. Not part of
// the published build (`vite.config.ts` excludes `src/testing`).

import { MockLanguageModelV4 } from "ai/test";

type Call = Parameters<MockLanguageModelV4["doStream"]>[0];

/** The prompt of a call, flattened to text, so a test can ask what the model was told. */
export const promptOf = (call: Call) =>
  call.prompt
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : ""))))
    .join("\n");

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/**
 * Answers each call with `reply(call)`, streamed a word at a time. `hold` keeps a call open until
 * `release()`, so a test can look at the busy state.
 */
/** What one call answers: text, or a call to a tool. */
type Reply = string | { tool: string; input: unknown };

export function mockModel(reply: (call: Call, index: number) => Reply) {
  let release: () => void = () => {};
  let held: Promise<void> | null = null;
  const model = new MockLanguageModelV4({
    doStream: async (call) => {
      const index = model.doStreamCalls.length - 1;
      if (held) await held;
      const answer = reply(call, index);
      const chunks =
        typeof answer === "string"
          ? [
              { type: "stream-start" as const, warnings: [] },
              { type: "text-start" as const, id: "t" },
              ...(answer.match(/\S+\s*|\s+/g) ?? []).map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
              { type: "text-end" as const, id: "t" },
              { type: "finish" as const, finishReason: { unified: "stop" as const, raw: "stop" }, usage },
            ]
          : [
              { type: "stream-start" as const, warnings: [] },
              {
                type: "tool-call" as const,
                toolCallId: `call-${index}`,
                toolName: answer.tool,
                input: JSON.stringify(answer.input),
              },
              { type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: "tool_calls" }, usage },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c);
            controller.close();
          },
        }),
      };
    },
  });
  return {
    model,
    hold: () => {
      held = new Promise((r) => (release = r));
    },
    release: () => {
      held = null;
      release();
    },
  };
}

/** A structured-output reply: the AI SDK's `Output.array` reads `{ elements: [...] }`. */
export const elements = (values: { value: string; rationale: string }[]) => JSON.stringify({ elements: values });
