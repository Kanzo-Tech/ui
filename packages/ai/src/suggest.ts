// Questions to start from, asked of a model. One door for every surface that offers them: a
// conversation's pills over a data space, a wizard's competency questions over a domain.

import { type LanguageModel, Output, jsonSchema, streamText } from "@kanzo-tech/llm";
import { failures } from "./proposals.js";

/** One question a model proposes, and why — the rationale names what the question rests on. */
export interface SuggestedQuestion {
  question: string;
  rationale: string;
}

export interface SuggestOptions {
  /** The model that proposes them — `gateway("chat")`. */
  model: LanguageModel;
  /** What the questions are for and what makes a good one: the system prompt. */
  instructions: string;
  /** The material they are asked over — a schema, a domain, the files. */
  prompt: string;
  abortSignal?: AbortSignal;
}

const QUESTION = jsonSchema<SuggestedQuestion>({
  type: "object",
  properties: {
    question: { type: "string", description: "The question, in the words a person would ask it." },
    rationale: { type: "string", description: "One short sentence naming what in the material it rests on." },
  },
  required: ["question", "rationale"],
  additionalProperties: false,
});

/**
 * Questions over some material, each arriving as soon as it is whole (`Output.array`'s
 * `elementStream`), so the first is on screen while the model writes the rest.
 *
 * **A failure throws, once the stream ends.** The AI SDK reports a failed stream to `onError` and
 * then ends it as if it had finished, so a refused call would read as a model with nothing to
 * suggest — and a surface that shows "no suggestions" and one that shows "suggesting failed" are
 * the same surface only by accident. Not retried: the gateway retries its upstreams, and a silent
 * gateway asked three times is three deadlines where the person waits for one.
 */
export async function* suggest(options: SuggestOptions): AsyncIterable<SuggestedQuestion> {
  const reported = failures();
  const result = streamText({
    model: options.model,
    system: options.instructions,
    prompt: options.prompt,
    output: Output.array({ element: QUESTION }),
    abortSignal: options.abortSignal,
    maxRetries: 0,
    onError: reported.onError,
  });
  yield* result.elementStream;
  reported.rethrow();
}
