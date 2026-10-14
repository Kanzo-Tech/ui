// What a field asks the model, written once. A host names the model and, at most, a sentence of
// instructions; the field describes itself through its accessible name and description, which is
// what a person filling it in reads too.

import { stream } from "@kanzo-tech/llm";
import { type LanguageModel, Output, jsonSchema } from "ai";
import type { ContinuationRequest, Proposal } from "./engine.js";

/** What the model is told about the field it is filling. */
export interface FieldBrief {
  /** The accessible name — the label a person reads. */
  name: string;
  /** The accessible description — the helper text under it. */
  description?: string;
  /** The host's own instruction for this field (`<Assist instructions>`). */
  instructions?: string;
  /** What the host knows about this field beyond its label — its rules, its neighbours (`<Assist context>`). */
  fieldContext?: string;
  /** What the rest of the form says (`<AssistProvider context>`). */
  context?: string;
}

const brief = (field: FieldBrief) =>
  [
    `Field: ${field.name || "(unnamed)"}`,
    field.description && `Field description: ${field.description}`,
    field.instructions && `Instructions: ${field.instructions}`,
    field.fieldContext && `Field context:\n${field.fieldContext}`,
    field.context && `Form context:\n${field.context}`,
  ]
    .filter(Boolean)
    .join("\n");

const CONTINUE = `You complete text inside a form field, like an editor's inline completion.
Reply with ONLY the text to insert at <caret/>: no quotes, no commentary, never repeat text that is already there.
Keep the language, tone and format of the existing text. Stop at a natural point: the end of the sentence for an automatic suggestion; up to a short paragraph when explicitly asked.`;

/** One continuation at the caret, streamed. */
export async function* continuation(
  model: LanguageModel,
  field: FieldBrief,
  { value, position, trigger, avoid, signal }: ContinuationRequest,
): AsyncIterable<string> {
  const text = `${value.slice(0, position)}<caret/>${value.slice(position)}`;
  const differ = avoid.length
    ? `\nOffer something different from these earlier suggestions:\n${avoid.map((a) => `- ${a.trim()}`).join("\n")}`
    : "";
  yield* stream({
    model,
    system: CONTINUE,
    prompt: `${brief(field)}\nRequest: ${trigger}${differ}\n\nText:\n${text}`,
    abortSignal: signal,
  }).text;
}

const CANDIDATES = `You suggest values for a form field. Each value must be complete and ready to enter as-is, in the language of the form.`;

const OFFER = jsonSchema<{ text: string; rationale: string }>({
  type: "object",
  properties: {
    text: { type: "string", description: "The value itself, exactly as it would be entered." },
    rationale: { type: "string", description: "One short sentence naming what in the field or the form it rests on." },
  },
  required: ["text", "rationale"],
  additionalProperties: false,
});

/**
 * Whole values for the field, each a `Proposal` with its rationale, arriving as soon as it is whole
 * (`Output.array`'s elements), so the first is on screen while the model writes the rest.
 *
 * **A failure throws, once the stream ends** — `stream`'s contract — so a field that shows "nothing
 * to offer" and one that shows "it failed" are never the same field by accident. A value repeating an
 * earlier one (ignoring case and spacing) is dropped and does not count; past `count`, the rest are
 * dropped, since nothing in `Output.array` holds the model to a length.
 */
export async function* candidates(
  model: LanguageModel,
  field: FieldBrief,
  { value, existing, signal, count, list }: {
    value: string;
    existing: string[];
    signal: AbortSignal;
    count: number;
    /** The field holds a list (tags): a candidate is one more item, not a replacement. */
    list: boolean;
  },
): AsyncIterable<Proposal> {
  if (count <= 0) return;
  const holds = list
    ? `Current items: ${existing.length ? existing.join(", ") : "(none)"}\nSuggest NEW items, not already present.`
    : `Current value: ${value || "(empty)"}\nSuggest alternatives to replace it${value ? ", different from it" : ""}.`;
  const answer = stream({
    model,
    system: CANDIDATES,
    prompt: `${brief(field)}\n${holds}\nGive ${count}.`,
    output: Output.array({ element: OFFER }),
    abortSignal: signal,
  });
  const seen = new Set<string>();
  for await (const { text, rationale } of answer.elements) {
    const key = text.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    yield list ? { text, rationale } : { text, rationale, range: [0, value.length] };
    if (seen.size >= count) return;
  }
}
