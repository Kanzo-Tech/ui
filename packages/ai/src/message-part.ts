import type { MessageRole } from "./message.js";
import type { RunState } from "./task.js";

/**
 * A turn as a **list of parts**, and the join every component in this package was missing.
 *
 * `Message`, `MessageText`, `Reasoning`, `Tool` and `Task` were each correct and none of them was
 * wired to the next: a host held its own shape and translated into five sets of props by hand.
 * keasy's `AskMessage` is the worked example — it carries `sql`, `reasoning`, `explanation` and a
 * `phase` of `'generating' | 'executing' | 'explaining' | 'done'`, which is a tool part, a reasoning
 * part, a text part and a state, hand-rolled. **That is the second consumer, and it existed before
 * this file did.** So this is not a protocol invented ahead of its need.
 *
 * The shape mirrors the AI SDK's `UIMessage`, deliberately and without depending on it — the four
 * properties that make theirs work are the four copied here:
 *
 * 1. **A message is a list of parts, not a string.** One `.map` with one `switch` on `part.type`
 *    renders a whole turn.
 * 2. **State lives on the part**, so a renderer is told what to draw rather than inferring it.
 * 3. **Generic in metadata and tools**, so a product extends the union instead of forking it.
 * 4. **Transport stays separate.** Ours already is, and is smaller than theirs: a caller passes a
 *    function returning an `AsyncIterable`. Nothing here replaces that seam.
 *
 * ## Four variants, not nine
 *
 * Theirs has nine. `file`, `data-*`, `step-start` and `dynamic-tool` have no call site here, and
 * `source` is **declined rather than deferred**: discovery does not cite a document, it runs a
 * query, and provenance that is a statement plus rows is a tool call. It arrives the day an answer
 * rests on a text somebody wrote.
 *
 * ## The two state vocabularies are the ones already in the package
 *
 * `RunState` — `pending` · `running` · `done` · `failed` — is `Task`'s and `Tool`'s, from one table
 * with one label map and one icon family. It is not restated here, and the reference's
 * `input-streaming | input-available | output-available | output-error` is not adopted: four states
 * under two spellings is the drift this repo keeps deleting.
 *
 * `StreamState` is the other one, and it is two values because text and reasoning have two.
 *
 * ## What this file is not
 *
 * **It renders nothing.** There is no `<Message parts={…} />` here and that is the shape rather than
 * an omission: which part a product renders, in what order, with what chrome around it, is the
 * thing that differs per product — and a component that owned the `switch` would own those answers
 * too. The `switch` belongs to the host; what this gives it is a union exhaustive enough that
 * TypeScript tells the host when a case is missing.
 */

/** Where a streamed part has got to. Two values, because text and reasoning have two. */
export type StreamState = "streaming" | "done";

/** Prose the model wrote. `MessageText` draws it. */
export interface AiTextPart {
  type: "text";
  text: string;
  state?: StreamState;
}

/**
 * The model's own working, folded away. `Reasoning` draws it.
 *
 * **No duration here**, and that is checked rather than assumed: `Reasoning` times itself off the
 * `streaming` transition and renders *Thought for N seconds* from its own state. A `seconds` on the
 * part would be a second measurement of one fact, and the one no component reads.
 */
export interface AiReasoningPart {
  type: "reasoning";
  text: string;
  state?: StreamState;
}

/**
 * One call the model made. `Tool` draws it.
 *
 * `input` and `output` are `unknown` here and **children** at the component: `ToolInput` and
 * `ToolOutput` take what you render rather than a JSON blob, because we always know what the tool
 * was. The part still carries the values, because a host that wants the JSON tree has to have them.
 *
 * `NAME` is the axis a product extends along. Give it a union of your tool names and a `switch` on
 * `part.name` narrows `input` and `output` if you declare them per name.
 */
export interface AiToolPart<NAME extends string = string> {
  type: "tool";
  name: NAME;
  state?: RunState;
  input?: unknown;
  output?: unknown;
  /** Set when `state` is `failed`. */
  errorText?: string;
}

/**
 * One step of work, ours and with no equivalent in the reference. `Task` draws it.
 *
 * Two fields, because `Task` has two parts: `TaskTitle` takes the words and `TaskStatus` reads the
 * state off the root and says it. There is no list of sub-lines on the part because there is none
 * on the component — a step that wants children is a step whose host renders them.
 */
export interface AiTaskPart {
  type: "task";
  title: string;
  state?: RunState;
}

export type AiMessagePart<NAME extends string = string> =
  | AiTextPart
  | AiReasoningPart
  | AiToolPart<NAME>
  | AiTaskPart;

/**
 * One turn.
 *
 * `METADATA` is where a product hangs what only it knows — a request id, a cost, who asked. It is
 * unconstrained on purpose: constraining it is how a transport type ends up describing one product.
 */
export interface AiMessage<METADATA = unknown, NAME extends string = string> {
  id: string;
  role: MessageRole;
  metadata?: METADATA;
  parts: AiMessagePart<NAME>[];
}

/**
 * The guards, because they are what make a host's `switch` readable.
 *
 * Each is a type predicate, so `parts.filter(isToolPart)` is an `AiToolPart[]` and not a cast. That
 * is the whole reason they exist rather than the host writing `part.type === "tool"`: the equality
 * narrows inside a `switch` and does not survive a `.filter`.
 */
export const isTextPart = (part: AiMessagePart): part is AiTextPart => part.type === "text";

export const isReasoningPart = (part: AiMessagePart): part is AiReasoningPart =>
  part.type === "reasoning";

export const isToolPart = <NAME extends string>(
  part: AiMessagePart<NAME>,
): part is AiToolPart<NAME> => part.type === "tool";

export const isTaskPart = (part: AiMessagePart): part is AiTaskPart => part.type === "task";
