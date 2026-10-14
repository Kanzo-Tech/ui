import type { ModelReply, ModelScript, ModelTurn } from "@kanzo-tech/testing";
import type { LanguageModelMiddleware } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * **The one model double** — the AI SDK's own `MockLanguageModelV4`, answering from a script of turns.
 * A unit test passes it where a model goes; an end-to-end test registers the script for a model id
 * with `@kanzo-tech/testing`'s `playwright(page, { models })`, and `localModel` answers with this in
 * place of that model (`/docs/design/testing#one-model-double`). Every call is recorded on the mock,
 * `doGenerateCalls` and `doStreamCalls`, as the SDK records it.
 *
 * The script is data, because it crosses into the page. In this process its `turns` may instead be a
 * function of the call — what the call was asked, read with {@link promptOf} — when what it answers is
 * computed, as a recording that matches a question it was not given word for word. `pace` is read
 * when each call begins, so a page may change it between calls.
 */
export function scriptedModel(script: ModelScript | AnsweredScript): MockLanguageModelV4 {
  const turns = script.turns;
  const answer = typeof turns === "function" ? turns : answering(turns);
  const pace = () => script.pace;
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    doGenerate: async (call) => {
      const reply = answer(call, model.doGenerateCalls.length - 1);
      if ("hang" in reply) return stopped(call.abortSignal);
      if ("fail" in reply) throw new Error(reply.fail);
      if ("tool" in reply) throw new Error("A whole answer calls no tool: script the agent's call to a stream.");
      const { text, reasoning } = written(reply);
      await sleep((pace()?.wait ?? 0) + words(text).length * (pace()?.perWord ?? 0), call.abortSignal);
      return {
        content: [...(reasoning ? [{ type: "reasoning" as const, text: reasoning }] : []), { type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: USAGE,
        warnings: [],
      };
    },
    doStream: async (call) => {
      const index = model.doStreamCalls.length - 1;
      const reply = answer(call, index);
      const signal = call.abortSignal;
      return {
        stream: new ReadableStream<Chunk>({
          async start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            if ("hang" in reply) {
              stopped(signal).catch((reason: unknown) => controller.error(reason));
              return;
            }
            try {
              await sleep(pace()?.wait ?? 0, signal);
              const reasoning = "reasoning" in reply ? reply.reasoning : undefined;
              if (reasoning) {
                controller.enqueue({ type: "reasoning-start", id: "r" });
                for (const delta of words(reasoning)) {
                  await sleep(pace()?.perWord ?? 0, signal);
                  controller.enqueue({ type: "reasoning-delta", id: "r", delta });
                }
                controller.enqueue({ type: "reasoning-end", id: "r" });
              }
              if ("tool" in reply) {
                controller.enqueue({ type: "tool-call", toolCallId: `call-${index}`, toolName: reply.tool, input: JSON.stringify(reply.input) });
                controller.enqueue({ type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: USAGE });
                controller.close();
                return;
              }
              const text = "fail" in reply ? (reply.after ?? "") : written(reply).text;
              controller.enqueue({ type: "text-start", id: "t" });
              for (const delta of words(text)) {
                await sleep(pace()?.perWord ?? 0, signal);
                controller.enqueue({ type: "text-delta", id: "t", delta });
              }
              if ("fail" in reply) {
                controller.enqueue({ type: "error", error: new Error(reply.fail) });
              } else {
                controller.enqueue({ type: "text-end", id: "t" });
                controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE });
              }
              controller.close();
            } catch (reason) {
              controller.error(reason);
            }
          },
        }),
      };
    },
  });
  return model;
}

/** What a call is asked with: the AI SDK's call options, as a model receives them. */
export type ModelCall = Parameters<NonNullable<LanguageModelMiddleware["wrapGenerate"]>>[0]["params"];

/** A script whose turns are a function of the call and its index among the calls of its kind. */
export interface AnsweredScript extends Omit<ModelScript, "turns"> {
  readonly turns: (call: ModelCall, index: number) => ModelReply;
}

type Answering = AnsweredScript["turns"];

/** Everything a call was told — system, user, assistant and tool messages — flattened to text: what a turn's `when` is matched against. */
export function promptOf(call: ModelCall): string {
  return call.prompt
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : ""))))
    .join("\n");
}

/** A script as the function it amounts to: the first unspent turn whose `when` the prompt contains. */
function answering(turns: ModelScript["turns"]): Answering {
  const spent = new Set<ModelTurn>();
  return (call) => {
    const prompt = promptOf(call);
    const turn = turns.find((t) => !spent.has(t) && (t.when === undefined || prompt.includes(t.when)));
    if (!turn) return { fail: `The model double has no turn for: ${prompt.slice(0, 120)}` };
    if (turn.once) spent.add(turn);
    return turn.reply;
  };
}

type Chunk = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer C> ? C : never;

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const written = (reply: { text: string; reasoning?: string } | { object: unknown }) =>
  "object" in reply ? { text: JSON.stringify(reply.object), reasoning: undefined } : reply;

const words = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];

const abort = (signal: AbortSignal | undefined) => signal?.reason ?? new DOMException("Stopped", "AbortError");

/** Settles when `signal` aborts, by rejecting with its reason: a call that never answers. */
const stopped = (signal: AbortSignal | undefined) =>
  new Promise<never>((_, reject) => {
    if (signal?.aborted) return reject(abort(signal));
    signal?.addEventListener("abort", () => reject(abort(signal)), { once: true });
  });

const sleep = (ms: number, signal: AbortSignal | undefined) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abort(signal));
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(abort(signal))), { once: true });
  });
