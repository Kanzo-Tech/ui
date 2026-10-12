/**
 * **A Task** — `/docs/design/tasks`: a small model fills a small artefact whose shape is a schema, the
 * oracles check it, and a bounded loop sends what they found back or turns it into a question for the
 * person. No React and no tools: the model answers with `Output.object`, which a constraining provider
 * decodes against the schema, and the loop is this module's — Instructor's pattern on the AI SDK.
 */

import { generateText, Output, type FlexibleSchema, type LanguageModel } from "ai";

/** Where a proposal lands when accepted: an LSP `TextEdit`, or a JSON Patch operation's path. */
export type Target =
  /** A continuation at the cursor. */
  | { readonly insert: number }
  | { readonly replace: readonly [from: number, to: number] }
  /** A new element of the list at this JSON Pointer. */
  | { readonly add: string }
  /** The slot at this JSON Pointer: a chip. */
  | { readonly set: string };

/** What an oracle found wrong, at a JSON Pointer into the artefact when it can say where. */
export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly at?: string;
}

/** A question for the person, in the shape of MCP's elicitation: never free text. */
export interface Decision {
  readonly id: string;
  readonly question: string;
  readonly options: readonly { readonly id: string; readonly label: string; readonly detail?: string }[];
}

/** What the oracles said of a proposal. */
export type Verdict =
  | { readonly ok: true; readonly assumed?: readonly { readonly decision: Decision; readonly option: string }[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly decision: Decision };

/** What a model offers: a value, where it lands, and what backs it. */
export interface Proposal<A> {
  readonly id: string;
  readonly task: string;
  readonly value: A;
  readonly target: Target;
  readonly verdict: Verdict;
  /** How many times the model was asked: 1 when its first answer held. */
  readonly attempts: number;
}

/** One oracle's word on an artefact: nothing, what is wrong with it, or a question it raises. */
export type Finding = Diagnostic | { readonly decision: Decision };

/** A fact checked of the artefact: the data's or the program's, never the model's opinion. */
export type Oracle<I, A> = (value: A, input: I) => Finding | readonly Finding[] | undefined | Promise<Finding | readonly Finding[] | undefined>;

/** The states a Task passes through, as the message's data parts carry them. */
export type TaskState = "linking" | "drafting" | "verifying" | "repairing" | "needs-input" | "done" | "failed";

export interface TaskDefinition<I, A, C = string> {
  /** What the model is resolved by and what the evaluation set is keyed by. */
  readonly name: string;
  /** The closed vocabulary the model may use: computed, not asked for. */
  readonly context?: (input: I, signal?: AbortSignal) => C | Promise<C>;
  /** The system prompt. */
  readonly instructions: string;
  /** The question as the model reads it: the input and the context. */
  readonly prompt: (input: I, context: C) => string;
  /** The artefact's schema — the context's enums in it — as `Output.object` takes it. */
  readonly output: (input: I, context: C) => FlexibleSchema<A>;
  readonly target?: (input: I) => Target;
  readonly verify?: readonly Oracle<I, A>[];
  /**
   * The decisions a safe default settles: the option assumed, so the Task goes on and the proposal
   * says what it assumed. A decision not here stops the Task and asks.
   */
  readonly decide?: Readonly<Record<string, { readonly assume: string }>>;
  /** How many times the model is asked before the diagnostics are the answer. */
  readonly attempts?: number;
}

/** A Task, declared: what the model knows, what it may return, and how that is checked. */
export function defineTask<I, A, C = string>(definition: TaskDefinition<I, A, C>): TaskDefinition<I, A, C> {
  return definition;
}

export interface RunOptions {
  readonly model: LanguageModel;
  readonly signal?: AbortSignal;
  /** Each state as the Task enters it. */
  readonly onState?: (state: TaskState) => void;
  /** The proposal's id; the call's own when absent. */
  readonly id?: string;
}

const isDecision = (f: Finding): f is { decision: Decision } => "decision" in f;

/** Every oracle's findings on `value`, split into what is wrong and what is the person's to decide. */
async function check<I, A, C>(task: TaskDefinition<I, A, C>, value: A, input: I) {
  const findings = (await Promise.all((task.verify ?? []).map((oracle) => oracle(value, input)))).flatMap((f) =>
    f === undefined ? [] : Array.isArray(f) ? f : [f as Finding],
  );
  return {
    diagnostics: findings.filter((f): f is Diagnostic => !isDecision(f)),
    decisions: findings.filter(isDecision).map((f) => f.decision),
  };
}

/** The verdict on findings with no diagnostic: the first open decision, or accepted with what was assumed. */
function decided<I, A, C>(task: TaskDefinition<I, A, C>, decisions: readonly Decision[]): Verdict {
  const open = decisions.find((d) => task.decide?.[d.id] === undefined);
  if (open) return { ok: false, decision: open };
  const assumed = decisions.map((decision) => ({ decision, option: task.decide![decision.id]!.assume }));
  return assumed.length > 0 ? { ok: true, assumed } : { ok: true };
}

/**
 * The verdict on a value nobody asked a model for — a person's edit of an earlier one: every oracle
 * run on it, as `runTask` runs them on an answer, with no repair to send it back to.
 */
export async function verify<I, A, C>(task: TaskDefinition<I, A, C>, value: A, input: I): Promise<Verdict> {
  const { diagnostics, decisions } = await check(task, value, input);
  return diagnostics.length > 0 ? { ok: false, diagnostics } : decided(task, decisions);
}

/**
 * Runs `task` on `input`: the context computed, the artefact asked for, every oracle run on it, and
 * the diagnostics sent back for another attempt while there are attempts left. A decision the task
 * does not settle ends it as a question; one it settles is recorded as assumed.
 */
export async function runTask<I, A, C>(task: TaskDefinition<I, A, C>, input: I, options: RunOptions): Promise<Proposal<A>> {
  const { model, signal, onState } = options;
  const id = options.id ?? `${task.name}-${Math.random().toString(36).slice(2, 10)}`;
  const target = task.target?.(input) ?? { add: "" };
  const attempts = task.attempts ?? 3;

  onState?.("linking");
  const context = task.context ? await task.context(input, signal) : ("" as C);
  const schema = task.output(input, context);
  const asked = task.prompt(input, context);

  let feedback = "";
  let last: { value: A; diagnostics: Diagnostic[] } | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    onState?.(attempt === 1 ? "drafting" : "repairing");
    const { output } = await generateText({
      model,
      system: task.instructions,
      prompt: feedback ? `${asked}\n\n${feedback}` : asked,
      output: Output.object({ schema }),
      abortSignal: signal,
    });
    const value = output as A;

    onState?.("verifying");
    const { diagnostics, decisions } = await check(task, value, input);

    if (diagnostics.length > 0) {
      last = { value, diagnostics };
      feedback = `Your previous answer was ${JSON.stringify(value)}. It does not hold:\n${diagnostics
        .map((d) => `- ${d.at ? `${d.at}: ` : ""}${d.message}`)
        .join("\n")}\nAnswer again, fixing these.`;
      continue;
    }
    const verdict = decided(task, decisions);
    onState?.(verdict.ok ? "done" : "needs-input");
    return { id, task: task.name, value, target, verdict, attempts: attempt };
  }

  onState?.("failed");
  return { id, task: task.name, value: last!.value, target, verdict: { ok: false, diagnostics: last!.diagnostics }, attempts };
}

/**
 * Several proposals at once, with no one asked for yet — what a list offers before the reader types:
 * the model writes `count` artefacts in one answer, each is checked on its own, and only those every
 * oracle accepts are kept. One call, no repair: an offer the oracles refuse is not shown.
 */
export async function propose<I, A, C>(
  task: TaskDefinition<I, A, C>,
  input: I,
  options: RunOptions & { readonly count: number },
): Promise<Proposal<A>[]> {
  const { model, signal, count } = options;
  const context = task.context ? await task.context(input, signal) : ("" as C);
  const { output } = await generateText({
    model,
    system: task.instructions,
    prompt: `${task.prompt(input, context)}\n\nOffer ${count}, different from one another.`,
    output: Output.array({ element: task.output(input, context) }),
    abortSignal: signal,
  });
  const offered: Proposal<A>[] = [];
  for (const [n, value] of ((output ?? []) as A[]).entries()) {
    const { diagnostics, decisions } = await check(task, value, input);
    if (diagnostics.length > 0) continue;
    const verdict = decided(task, decisions);
    if (!verdict.ok) continue;
    offered.push({ id: `${task.name}-${n}`, task: task.name, value, target: { add: "" }, verdict, attempts: 1 });
  }
  return offered.slice(0, count);
}
