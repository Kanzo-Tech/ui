// Offers asked of a model. One door for every surface that offers them: a conversation's questions
// over a data space, a wizard's competency questions over a domain, a field's candidate values.

import { type LanguageModel, Output, jsonSchema, stream } from "@kanzo-tech/llm";
import type { JSONSchema7 } from "ai";
import type { Proposal } from "./engine.js";

export interface SuggestOptions {
  /** The model that proposes them — `gateway("complete")`. */
  model: LanguageModel;
  /** What the offers are for and what makes a good one: the system prompt. */
  instructions: string;
  /** The material they are asked over — a schema, a domain, the files, a field and its form. */
  prompt: string;
  /**
   * At most this many. The prompt can ask for a number, but nothing in the answer's schema holds the
   * model to it — `Output.array` has no length, and a provider's structured output need not honour
   * one — so a model that writes more has the rest dropped here. Unset, every offer it writes.
   */
  count?: number;
  abortSignal?: AbortSignal;
}

/** One offer, as JSON Schema: what a caller counts as sent beside its prompt. */
export const OFFER_SCHEMA: JSONSchema7 = {
  type: "object",
  properties: {
    text: { type: "string", description: "The offer itself, exactly as it would be used." },
    rationale: { type: "string", description: "One short sentence naming what in the material it rests on." },
  },
  required: ["text", "rationale"],
  additionalProperties: false,
};

const OFFER = jsonSchema<{ text: string; rationale: string }>(OFFER_SCHEMA);

/**
 * Offers over some material, each a `Proposal` with its rationale, arriving as soon as it is whole
 * (`Output.array`'s elements), so the first is on screen while the model writes the rest.
 *
 * **A failure throws, once the stream ends** — `stream`'s contract — so a surface that shows "no
 * suggestions" and one that shows "suggesting failed" are never the same surface by accident. An
 * empty answer is not a failure: the model had nothing to offer.
 *
 * An offer whose text repeats an earlier one (ignoring case and spacing) is dropped, and does not
 * count towards `count`.
 */
export async function* suggest(options: SuggestOptions): AsyncIterable<Proposal> {
  const count = options.count ?? Infinity;
  if (count <= 0) return;
  const answer = stream({
    model: options.model,
    system: options.instructions,
    prompt: options.prompt,
    output: Output.array({ element: OFFER }),
    abortSignal: options.abortSignal,
  });
  const seen = new Set<string>();
  for await (const { text, rationale } of answer.elements) {
    const key = text.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    yield { text, rationale };
    if (seen.size >= count) return;
  }
}
