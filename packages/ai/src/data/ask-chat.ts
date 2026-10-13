"use client";

import { relationKey, relationOf, type Engine, type JoinGraph, type Relation, type Selection } from "@kanzo-tech/mosaic";
import { createUIMessageStream, type ChatTransport, type InferUIMessageChunk, type LanguageModel, type UIMessage } from "ai";
import * as React from "react";
import { useTransportChat, type AgentChat, type AgentChatOptions } from "../agent-chat.js";
import { propose, runTask, verify, type Decision, type Proposal, type Verdict } from "../task/index.js";
import { measureName, type AnswerInput, type AnswerRelation } from "./answer.js";
import { ask, askAnswer, askRelation, answerRelation, type AskInput, type AskSpec } from "./ask.js";
import { readAnswer, type AnswerOutput } from "./read.js";

/**
 * **Ask, in a chat** — the Ask Task behind `useChat`. Each question is one run of the Task: the model
 * fills a spec, the resolver finds its relation, the oracles check it, and the answer is read on the
 * page's engine under its chips and written into the transcript as the `answer` part `AnswerCard`
 * draws. A question two relations answer equally is asked back with the relations as options; the
 * reader's next message picks one. The reply's words are written from the rows, never by the model.
 */

/** What the page gives Ask: the model, the engine the answers are read on, and the data. */
export interface AskChatOptions {
  readonly model: LanguageModel;
  readonly engine: Pick<Engine, "query">;
  readonly graph: JoinGraph;
  /** Each type alone, with its fields — `readAnswerRelations(…, { hops: 0 })`. */
  readonly types: readonly AnswerRelation[];
  /** The page's crossfilter: an answer is read under it, and must reach the relations its chips are on. */
  readonly selection?: Selection;
}

/** What one turn of Ask keeps beside its answer: its spec, and the relations it asked the reader between. */
export interface AskTurn {
  readonly spec: AskSpec;
  readonly decision?: Decision;
  readonly choices?: readonly Relation[];
}

/** What an `answer` part reads back: the read, and the spec it was read from — what its chips edit. */
export type AskOutput = AnswerOutput & { readonly spec: AskSpec };

/**
 * Ask's messages: an `answer` tool part `AnswerCard` draws, and the turn as a data part. A person's
 * message may carry a `data-ask` part too — a spec they edited with `AskChips` — which is asked as it
 * is, with no model in between.
 */
export type AskMessage = UIMessage<never, { ask: AskTurn }, { answer: { input: AnswerInput; output: AskOutput } }>;

/** The message an edited spec is asked as: its words, and the spec itself. `chat.sendMessage(askEdit(spec))`. */
export function askEdit(spec: AskSpec): Pick<AskMessage, "parts"> {
  return { parts: [{ type: "text", text: questionOf(spec) }, { type: "data-ask", data: { spec } }] };
}

/** The root type of each relation the page's chips are on: what an answer must reach. */
const underOf = (selection?: Selection) =>
  [...new Set((selection?.clauses ?? []).map(relationOf).filter((r) => r != null).map((r) => (typeof r === "string" ? r : r.root)))];

const textOf = (message: AskMessage | undefined) =>
  (message?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();

const turnOf = (message: AskMessage | undefined): AskTurn | undefined =>
  message?.parts.flatMap((p) => (p.type === "data-ask" ? [p.data] : [])).at(-1);

/** The choice the reader's words make among `turn`'s options: its number, its id or its label. */
function chosen(turn: AskTurn | undefined, words: string): Relation | undefined {
  if (!turn?.decision || !turn.choices) return undefined;
  const said = words.trim().toLowerCase();
  const index = turn.decision.options.findIndex(
    (o, i) => said === String(i + 1) || said === o.id.toLowerCase() || said === o.label.toLowerCase(),
  );
  return index >= 0 ? turn.choices[index] : undefined;
}

const label = (field: string) => field.slice(field.indexOf(".") + 1);

/** The words of a spec, as a question a reader would ask: what the pills show and the reply opens with. */
export function questionOf(spec: AskSpec): string {
  const show = spec.show;
  const measure = show.kind === "stat" ? show.measure : show.kind === "chart" ? show.y : undefined;
  const what = measure ? `${measureName(measure) === "count" ? "How many" : measureName(measure)} ${spec.of}` : spec.of;
  const by = show.kind === "chart" ? ` by ${label(show.x)}` : show.kind === "table" ? ` with ${show.columns.map(label).join(", ")}` : "";
  const where = (spec.where ?? []).map((c) => ("in" in c ? `${label(c.field)} ${c.in.join(" or ")}` : "between" in c ? `${label(c.field)} ${c.between.join("–")}` : `${label(c.field)} ~ ${c.contains}`));
  return `${what}${by}${where.length ? `, where ${where.join(" and ")}` : ""}?`;
}

/** What the reply says of the rows: written from them, not by the model. */
function summary(output: AnswerOutput): string {
  if (output.unanswered.length > 0) return "None of these rows are in view under the page's filter.";
  if (output.rows.length === 0) return "No rows answer this.";
  const [first, second] = output.rows;
  const cells = (row: Record<string, unknown>) => Object.values(row).map(String);
  if (output.rows.length === 1) return cells(first!).join(": ");
  return `${cells(first!).join(": ")}, then ${cells(second!).join(": ")}${output.rows.length > 2 ? `, of ${output.rows.length}` : ""}.`;
}

function write(writer: { write: (chunk: InferUIMessageChunk<AskMessage>) => void }, text: string) {
  const id = `t${Math.random().toString(36).slice(2, 8)}`;
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/** The transport: one Ask turn per message, its options read anew each time — the page changes. */
export function askTransport(options: () => AskChatOptions, onError?: (value: unknown) => string): ChatTransport<AskMessage> {
  return {
    reconnectToStream: async () => null,
    sendMessages: async ({ messages, abortSignal }) =>
      createUIMessageStream<AskMessage>({
        onError,
        execute: async ({ writer }) => {
          const { model, engine, graph, types, selection } = options();
          const question = textOf(messages.at(-1));
          const before = turnOf([...messages].reverse().find((m) => m.role === "assistant"));
          const input: AskInput = { question, graph, types, under: underOf(selection), previous: before?.spec };
          writer.write({ type: "start" });

          let spec: AskSpec;
          let relation = chosen(before, question);
          const edited = turnOf(messages.at(-1))?.spec;
          if (relation && before) spec = before.spec;
          else {
            // A spec the person edited is checked as the model's would be, and never sent to it.
            let verdict: Verdict;
            if (edited) {
              spec = edited;
              verdict = await verify(ask, spec, input);
            } else {
              const proposal = await runTask(ask, input, { model, signal: abortSignal });
              spec = proposal.value;
              verdict = proposal.verdict;
            }
            if (!verdict.ok && "decision" in verdict) {
              const resolved = askRelation(spec, input);
              const choices = resolved.kind === "ambiguous" ? resolved.relations : [];
              writer.write({ type: "data-ask", data: { spec, decision: verdict.decision, choices } });
              write(writer, `${verdict.decision.question}\n\n${verdict.decision.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`);
              writer.write({ type: "finish" });
              return;
            }
            if (!verdict.ok) {
              writer.write({ type: "data-ask", data: { spec } });
              write(writer, `I could not answer that over this data: ${verdict.diagnostics.map((d) => d.message).join(" ")}`);
              writer.write({ type: "finish" });
              return;
            }
          }

          const toolCallId = `ask-${Math.random().toString(36).slice(2, 10)}`;
          const answer = askAnswer(spec, input, toolCallId, relation)!;
          relation = answer.relation;
          // What the model would have written: the relation by its key, the tile without the page's id and span.
          const show: Record<string, unknown> = { ...answer.show };
          delete show.id;
          delete show.span;
          const shown: AnswerInput = { ...answer, relation: relationKey(graph, relation), show: show as AnswerInput["show"] };
          writer.write({ type: "tool-input-available", toolCallId, toolName: "answer", input: shown });
          const output = await readAnswer(answer, answerRelation(relation, input), { engine, graph, selection, signal: abortSignal });
          writer.write({ type: "tool-output-available", toolCallId, output: { ...output, spec } satisfies AskOutput });
          writer.write({ type: "data-ask", data: { spec } });
          write(writer, summary(output));
          writer.write({ type: "finish" });
        },
      }),
  };
}

/** A chat with Ask over the page: `Chat` draws it, and each `answer` part is an `AnswerCard`. */
export function useAskChat(options: AskChatOptions, chat?: AgentChatOptions<AskMessage>): AgentChat<AskMessage> {
  const latest = React.useRef(options);
  latest.current = options;
  return useTransportChat((onError) => askTransport(() => latest.current, onError), chat);
}

/**
 * Questions to start from: Ask's own proposals with no question asked, each checked by its oracles,
 * whole. `Chat` takes them as they are and sends each one's spec with `askEdit`, so a pill is asked as
 * the spec that was checked, never re-read by the model from its words.
 */
export async function askOffers(
  options: Omit<AskChatOptions, "engine"> & { readonly count?: number; readonly signal?: AbortSignal },
): Promise<Proposal<AskSpec>[]> {
  const { model, graph, types, selection, count = 4, signal } = options;
  const input: AskInput = { question: "", graph, types, under: underOf(selection) };
  return propose(ask, input, { model, signal, count });
}
