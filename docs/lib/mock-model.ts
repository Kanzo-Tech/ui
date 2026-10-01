/**
 * A model for the examples and showcases: the AI SDK's own mock, so `Assist` and `Chat` run the
 * real conversation — `streamText`, `ToolLoopAgent`, `useChat` — with nothing on the other end of a
 * network. The same shape as `packages/ai/src/testing/model.ts`, plus a pause between words: a test
 * wants the answer at once, and a reader has to see it arrive to see that it streams.
 *
 * Swap it for `createKanzo({ baseURL })("kanzo-chat")` and nothing else on the page changes; that is
 * the claim the examples make, so they must not be built on anything a real model would not do.
 */
import { MockLanguageModelV4 } from "ai/test";

type Call = Parameters<MockLanguageModelV4["doStream"]>[0];

/** What one call answers: text, optionally after some thinking, or a call to a tool. */
export type Reply =
  | string
  | { text: string; reasoning?: string }
  | { tool: string; input: unknown; reasoning?: string };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const words = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];

/** Everything the model was told, flattened to text. */
export const promptOf = (call: Call) =>
  call.prompt
    .flatMap((m) =>
      typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : "")),
    )
    .join("\n");

/** The last thing the person asked. */
export const askOf = (call: Call): string => {
  const user = call.prompt.filter((m) => m.role === "user").at(-1);
  if (!user || typeof user.content === "string") return "";
  return user.content.map((p) => ("text" in p ? p.text : "")).join("");
};

/** True when this call follows a tool's result — the step where an agent answers. */
export const afterTool = (call: Call) => call.prompt.at(-1)?.role === "tool";

/** A structured-output reply: `Output.array` reads `{ elements: [...] }`. */
export const elements = (values: { value: string; rationale: string }[]) =>
  JSON.stringify({ elements: values });

/**
 * Answers each call with `reply(call, index)`, a word every `delay` milliseconds — read per call
 * when it is a function, so an example asked to settle rather than play (reduced motion) can answer
 * at once. A call aborted between words — the reader typed on, stopped, or asked again — ends there,
 * the way a real request is cancelled.
 */
export function mockModel(
  reply: (call: Call, index: number) => Reply,
  options: { delay?: number | (() => number) } = {},
) {
  const pace = options.delay ?? 40;
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    doStream: async (call) => {
      const index = model.doStreamCalls.length - 1;
      const answer = reply(call, index);
      const { reasoning, ...rest } = typeof answer === "string" ? { text: answer } : answer;
      const chunks = [
        { type: "stream-start" as const, warnings: [] },
        ...(reasoning
          ? [
              { type: "reasoning-start" as const, id: "r" },
              ...words(reasoning).map((delta) => ({ type: "reasoning-delta" as const, id: "r", delta })),
              { type: "reasoning-end" as const, id: "r" },
            ]
          : []),
        ...("tool" in rest
          ? [
              {
                type: "tool-call" as const,
                toolCallId: `call-${index}`,
                toolName: rest.tool,
                input: JSON.stringify(rest.input),
              },
              { type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: "tool_calls" }, usage },
            ]
          : [
              { type: "text-start" as const, id: "t" },
              ...words(rest.text).map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
              { type: "text-end" as const, id: "t" },
              { type: "finish" as const, finishReason: { unified: "stop" as const, raw: "stop" }, usage },
            ]),
      ];
      const signal = call.abortSignal;
      const delay = typeof pace === "function" ? pace() : pace;
      return {
        stream: new ReadableStream({
          async start(controller) {
            for (const chunk of chunks) {
              if (signal?.aborted) return controller.error(signal.reason);
              controller.enqueue(chunk);
              if (delay > 0 && (chunk.type === "text-delta" || chunk.type === "reasoning-delta")) {
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
            controller.close();
          },
        }),
      };
    },
  });
  return model;
}
