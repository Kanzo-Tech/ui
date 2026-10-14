import { type ModelReply, type ModelScript, scripted } from "@kanzo-tech/testing";
import type { LanguageModelMiddleware } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * **The one model double** — the AI SDK's own `MockLanguageModelV4`, answering from a script of turns
 * with `@kanzo-tech/testing`'s `scripted`. A unit test passes it where a model goes; an end-to-end test
 * registers the script for a model id with `playwright(page, { models })`, which registers the same
 * answering as that id's provider in `/local`'s registry (`/docs/design/testing#one-model-double`).
 * Every call is recorded on the mock, `doGenerateCalls` and `doStreamCalls`, as the SDK records it;
 * `promptOf(call)`, from `@kanzo-tech/testing`, flattens what one was told.
 *
 * The script is data, because it crosses into the page. In this process its `turns` may instead be a
 * function of the call — an {@link AnsweredScript} — when what it answers is computed, as a recording
 * that matches a question it was not given word for word. `pace` is read when each call begins, so a
 * page may change it between calls.
 */
export function scriptedModel(script: ModelScript | AnsweredScript): MockLanguageModelV4 {
  const calls = scripted<ModelCall>(script);
  return new MockLanguageModelV4({
    doGenerate: calls.doGenerate as MockOptions["doGenerate"],
    doStream: calls.doStream as MockOptions["doStream"],
  });
}

type MockOptions = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>;

/** What a call is asked with: the AI SDK's call options, as a model receives them. */
export type ModelCall = Parameters<NonNullable<LanguageModelMiddleware["wrapGenerate"]>>[0]["params"];

/** A script whose turns are a function of the call and its index among the calls of its kind. */
export interface AnsweredScript extends Omit<ModelScript, "turns"> {
  readonly turns: (call: ModelCall, index: number) => ModelReply;
}
