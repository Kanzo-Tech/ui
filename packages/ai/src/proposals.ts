// What a field asks the model, written once. A host names the model and, at most, a sentence of
// instructions; the field describes itself through its accessible name and description, which is
// what a person filling it in reads too.

import { type LanguageModel, Output, jsonSchema, streamText } from "@kanzo-tech/llm";
import type { ContinuationRequest, Proposal } from "./engine.js";

/** What the model is told about the field it is filling. */
export interface FieldBrief {
  /** The accessible name — the label a person reads. */
  name: string;
  /** The accessible description — the helper text under it. */
  description?: string;
  /** The host's own instruction for this field (`<Assist instructions>`). */
  instructions?: string;
  /** What the rest of the form says (`<AssistProvider context>`). */
  context?: string;
}

const brief = (field: FieldBrief) =>
  [
    `Field: ${field.name || "(unnamed)"}`,
    field.description && `Field description: ${field.description}`,
    field.instructions && `Instructions: ${field.instructions}`,
    field.context && `Form context:\n${field.context}`,
  ]
    .filter(Boolean)
    .join("\n");

const CONTINUE = `You complete text inside a form field, like an editor's inline completion.
Reply with ONLY the text to insert at <caret/>: no quotes, no commentary, never repeat text that is already there.
Keep the language, tone and format of the existing text. Stop at a natural point: the end of the sentence for an automatic suggestion; up to a short paragraph when explicitly asked.`;

/**
 * The AI SDK reports a failed stream to `onError` and then ends the stream as if it had finished, so
 * a refused or broken call would read as a model with nothing to say. This keeps what was reported
 * and throws it, whole, once the stream ends.
 */
function failures() {
  let failed: { error: unknown } | undefined;
  return {
    onError: ({ error }: { error: unknown }) => void (failed ??= { error }),
    rethrow: () => {
      if (failed) throw failed.error;
    },
  };
}

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
  const reported = failures();
  yield* streamText({
    model,
    system: CONTINUE,
    prompt: `${brief(field)}\nRequest: ${trigger}${differ}\n\nText:\n${text}`,
    abortSignal: signal,
    maxRetries: 0,
    onError: reported.onError,
  }).textStream;
  reported.rethrow();
}

const CANDIDATE = jsonSchema<{ value: string; rationale: string }>({
  type: "object",
  properties: {
    value: { type: "string", description: "The whole value, exactly as it would be entered." },
    rationale: { type: "string", description: "Why it fits, in one short sentence." },
  },
  required: ["value", "rationale"],
  additionalProperties: false,
});

const CANDIDATES = `You suggest values for a form field. Each value must be complete and ready to enter as-is, in the language of the form.`;

/**
 * Whole values for the field, each arriving as soon as it is complete (`elementStream`), so the
 * first candidate is on screen while the model writes the rest.
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
  const holds = list
    ? `Current items: ${existing.length ? existing.join(", ") : "(none)"}\nSuggest NEW items, not already present.`
    : `Current value: ${value || "(empty)"}\nSuggest alternatives to replace it${value ? ", different from it" : ""}.`;
  const reported = failures();
  const result = streamText({
    model,
    onError: reported.onError,
    system: CANDIDATES,
    prompt: `${brief(field)}\n${holds}\nGive ${count}.`,
    output: Output.array({ element: CANDIDATE }),
    abortSignal: signal,
    maxRetries: 0,
  });
  for await (const item of result.elementStream) {
    yield list
      ? { text: item.value, rationale: item.rationale }
      : { text: item.value, rationale: item.rationale, range: [0, value.length] };
  }
  reported.rethrow();
}
