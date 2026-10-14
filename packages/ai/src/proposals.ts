// What a field asks the model, written once. A host names the model and, at most, a sentence of
// instructions; the field describes itself through its accessible name and description, which is
// what a person filling it in reads too.

import { stream } from "@kanzo-tech/llm";
import { type LanguageModel, jsonSchema } from "ai";
import type { ContinuationRequest } from "./engine.js";
import { defineTask, propose, type Proposal } from "./task/index.js";

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

interface CandidateInput {
  field: FieldBrief;
  value: string;
  existing: string[];
  /** The field holds a list (tags): a candidate is one more item, not a replacement. */
  list: boolean;
}

/**
 * The field's whole values, as a Task: the model writes them, and a candidate lands on the field as
 * its `target` says — the whole value replaced, or one more item of a list.
 */
const candidate = defineTask<CandidateInput, { text: string; rationale: string }>({
  name: "candidates",
  instructions: CANDIDATES,
  prompt: ({ field, value, existing, list }) =>
    `${brief(field)}\n${
      list
        ? `Current items: ${existing.length ? existing.join(", ") : "(none)"}\nSuggest NEW items, not already present.`
        : `Current value: ${value || "(empty)"}\nSuggest alternatives to replace it${value ? ", different from it" : ""}.`
    }`,
  output: () => OFFER,
  target: ({ value, list }) => (list ? { add: "" } : { replace: [0, value.length] }),
});

/**
 * Whole values for the field, each the Task's `Proposal<string>` with its rationale, asked through
 * `propose` — one answer, each value checked on its own.
 *
 * **A failure throws** — `propose`'s contract — so a field that shows "nothing to offer" and one that
 * shows "it failed" are never the same field by accident. `propose` keeps at most `count`, since
 * nothing in `Output.array` holds the model to a length, and a value repeating an earlier one among
 * them (ignoring case and spacing) is dropped.
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
): AsyncIterable<Proposal<string>> {
  if (count <= 0) return;
  const offered = await propose(candidate, { field, value, existing, list }, { model, signal, count });
  const seen = new Set<string>();
  for (const { value: offer, ...proposal } of offered) {
    const key = offer.text.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    yield { ...proposal, value: offer.text, rationale: offer.rationale };
  }
}
