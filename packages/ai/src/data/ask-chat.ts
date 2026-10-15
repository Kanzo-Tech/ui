"use client";

import { relationOf, type Engine, type JoinGraph, type Selection } from "@kanzo-tech/mosaic";
import { createUIMessageStream, type ChatTransport, type InferUIMessageChunk, type LanguageModel, type UIMessage } from "ai";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useTransportChat, type AgentChat, type AgentChatOptions } from "../agent-chat.js";
import type { KeepPart } from "../kept-chat.js";
import { propose, runTask, verify, type Decision, type Proposal, type Verdict } from "../task/index.js";
import { ask, askAnswer, answerRelation, type AskInput, type AskSpec } from "./ask.js";
import { readAnswerQuery, type AnswerOutput, type QueryRow } from "./read.js";
import { ASK_PARTS } from "./ask-parts.js";
import type { Answer } from "./answer.js";

/**
 * **Ask, in a chat** — the Ask Task behind `useChat`. Each question is one run of the Task: the model
 * fills a spec, its paths are resolved, the oracles check it, and the answer is written into the
 * transcript as a `data-answer` part — once as it was asked, again once it is read on the page's
 * engine under its chips — which `Chat`'s `data` renderers hand to `AnswerCard`. A decision the Task
 * needs from the person is a `data-ask` part, drawn as a question; the pick comes back as the option's
 * id in the reply's own `data-ask` part, never parsed out of its words. The reply's sentence is
 * written from the rows, never by the model.
 */

/** Every word Ask's replies write. English by default. */
export interface AskChatTranslations {
  /** Between a label and its value in the sentence after an answer: *Physics: 230*. */
  value: string;
  /** Between the groups of that sentence: *Physics: 230; Chemistry: 200*. */
  groups: string;
  /** The reply when no row answers. */
  empty: string;
  /** The reply when the page's filter keeps none of the answer's rows. */
  hidden: string;
  /** Before why a question could not be answered. */
  failed: string;
}

const ENGLISH: AskChatTranslations = {
  value: ": ",
  groups: "; ",
  empty: "No rows answer this.",
  hidden: "None of these rows are in view under the page's filter.",
  failed: "I could not answer that over this data:",
};

/** What the page gives Ask: the model, the engine the answers are read on, and the data. */
export interface AskChatOptions {
  readonly model: LanguageModel;
  readonly engine: Pick<Engine, "query">;
  /** The data: what its types and fields are and hold is the graph's — `readJoinGraph` for a fossil corpus. */
  readonly graph: JoinGraph;
  /** The page's crossfilter: an answer is read under it, and must reach the relations its chips are on. */
  readonly selection?: Selection;
  /** The words of its replies. */
  readonly translations?: Partial<AskChatTranslations>;
}

/**
 * One turn of Ask, beside its answer: the spec it was read from, the decision it asks the person when
 * it asks one — and, in a reply, the options the person picked, by the decision's id.
 */
export interface AskTurn {
  readonly spec: AskSpec;
  readonly decision?: Decision;
  readonly decided?: Readonly<Record<string, string>>;
}

/** What a `data-answer` part holds: the answer and its read, and the spec it was read from — what its chips edit. */
export type AskOutput = AnswerOutput & { readonly spec: AskSpec };

/**
 * Ask's messages: an `answer` data part `AnswerCard` draws, and the turn as an `ask` data part. A
 * person's message may carry an `ask` part too — a spec they edited with `AskChips`, or a decision
 * they answered — which is asked as it is, with no model in between.
 */
export type AskMessage = UIMessage<never, { ask: AskTurn; answer: AskOutput }>;

/**
 * The message a spec is asked as: its words, and the spec itself — `chat.sendMessage(askEdit(spec))`.
 * `decided` answers the turn's decision: `askEdit(turn.spec, { [decision.id]: option.id })`.
 */
export function askEdit(spec: AskSpec, decided?: Readonly<Record<string, string>>): Pick<AskMessage, "parts"> {
  return { parts: [{ type: "text", text: questionOf(spec) }, { type: "data-ask", data: decided ? { spec, decided } : { spec } }] };
}

/** The root type of each relation the page's chips are on: what an answer must reach. */
const underOf = (selection?: Selection) =>
  [...new Set((selection?.clauses ?? []).map(relationOf).filter((r) => r != null).map((r) => (typeof r === "string" ? r : r.root)))];

const textOf = (message: AskMessage | undefined) =>
  (message?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();

const turnOf = (message: AskMessage | undefined): AskTurn | undefined =>
  message?.parts.flatMap((p) => (p.type === "data-ask" ? [p.data] : [])).at(-1);

/** The words of a spec, as a question a reader would ask: what the pills show and the reply opens with. */
export function questionOf(spec: AskSpec): string {
  const show = spec.show;
  const measure = show.kind === "stat" ? show.measure : show.kind === "chart" ? show.y : undefined;
  const what = measure
    ? `${measure.op === "count" ? `How many ${measure.path ?? spec.of}` : `${measure.op} ${measure.field} of ${spec.of}`}`
    : spec.of;
  const by = show.kind === "chart" ? ` by ${show.x}` : show.kind === "table" ? ` with ${show.columns.join(", ")}` : "";
  const where = (spec.where ?? []).map((c) => ("in" in c ? `${c.field} ${c.in.join(" or ")}` : "between" in c ? `${c.field} ${c.between.join("–")}` : `${c.field} ~ ${c.contains}`));
  return `${what}${by}${where.length ? `, where ${where.join(" and ")}` : ""}?`;
}

/** The page's language: `<html lang>`, as every word the library writes reads it. */
const lang = () => (typeof document === "undefined" ? undefined : document.documentElement.lang || undefined);

/** How many of a bar chart's leading groups the sentence names. */
const LEADING = 2;

/**
 * **The sentence after an answer — a minimal template, of `Intl` and the data's own words.** The
 * figure, for a figure; for a chart of a measure by x, its leading groups — the bars of one value,
 * named together with `Intl.ListFormat` — each with its value through `Intl.NumberFormat`: *Univ. of
 * California: 12; Harvard University and MIT: 9.* No verb and no plural, so its only words are its
 * two separators, which `translations` gives. Nothing for a table or a plot of rows, which the card
 * says alone. `/docs/design/tasks#the-sentence-after-a-chart-is-a-minimal-template`.
 */
export function answerSentence(output: AnswerOutput, translations: AskChatTranslations = ENGLISH): string {
  const t = translations;
  const rows = output.rows ?? [];
  if ((output.unanswered ?? []).length > 0) return t.hidden;
  if (rows.length === 0) return t.empty;
  const numbers = new Intl.NumberFormat(lang());
  const word = (value: unknown) => (typeof value === "number" ? numbers.format(value) : String(value));
  const tile = output.answer.tile;
  if (tile.kind === "stat") return `${word(Object.values(rows[0]!)[0])}.`;
  if (tile.kind !== "chart" || tile.type === "dot" || tile.type === "regression" || tile.color !== undefined) return "";
  const measure = (row: QueryRow) => Number(Object.values(row).at(-1));
  const groups = new Map<number, string[]>();
  for (const row of [...rows].sort((a, b) => measure(b) - measure(a))) {
    const value = measure(row);
    if (!groups.has(value) && groups.size === LEADING) break;
    groups.set(value, [...(groups.get(value) ?? []), word(row[tile.x])]);
  }
  const list = new Intl.ListFormat(lang(), { type: "conjunction" });
  return `${[...groups].map(([value, labels]) => `${list.format(labels)}${t.value}${word(value)}`).join(t.groups)}.`;
}

function write(writer: { write: (chunk: InferUIMessageChunk<AskMessage>) => void }, text: string) {
  if (!text) return;
  const id = `t${Math.random().toString(36).slice(2, 8)}`;
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/**
 * The transport: one Ask turn per message, its options read anew each time — the page changes. Each
 * answer is read as a query on `client`, the host's (`/docs/design/reads`).
 */
export function askTransport(
  options: () => AskChatOptions,
  client: QueryClient,
  onError?: (value: unknown) => string,
): ChatTransport<AskMessage> {
  return {
    reconnectToStream: async () => null,
    sendMessages: async ({ messages, abortSignal }) =>
      createUIMessageStream<AskMessage>({
        onError,
        execute: async ({ writer }) => {
          const { model, engine, graph, selection, translations } = options();
          const t = { ...ENGLISH, ...translations };
          const question = textOf(messages.at(-1));
          const before = turnOf([...messages].reverse().find((m) => m.role === "assistant"));
          const input: AskInput = { question, graph, under: underOf(selection), previous: before?.spec };
          writer.write({ type: "start" });

          // A spec the person edited, or a decision they answered, is checked as the model's would be
          // and never sent to it; an answered decision is settled as the option they picked.
          const sent = turnOf(messages.at(-1));
          let spec: AskSpec;
          let verdict: Verdict;
          if (sent) {
            spec = sent.spec;
            const decide = Object.fromEntries(Object.entries(sent.decided ?? {}).map(([id, option]) => [id, { assume: option }]));
            verdict = await verify({ ...ask, decide: { ...ask.decide, ...decide } }, spec, input);
          } else {
            const proposal = await runTask(ask, input, { model, signal: abortSignal });
            spec = proposal.value;
            verdict = proposal.verdict;
          }
          if (!verdict.ok && "decision" in verdict) {
            writer.write({ type: "data-ask", data: { spec, decision: verdict.decision } });
            writer.write({ type: "finish" });
            return;
          }
          if (!verdict.ok) {
            writer.write({ type: "data-ask", data: { spec } });
            write(writer, `${t.failed} ${verdict.diagnostics.map((d) => d.message).join(" ")}`);
            writer.write({ type: "finish" });
            return;
          }

          const id = `ask-${Math.random().toString(36).slice(2, 10)}`;
          const answer = askAnswer(spec, input, id)!;
          writer.write({ type: "data-answer", id, data: { answer, spec } });
          const output = await readAnswerQuery(client, answer, answerRelation(answer.relation, graph), { engine, graph, selection, signal: abortSignal });
          writer.write({ type: "data-answer", id, data: { ...output, spec } });
          writer.write({ type: "data-ask", data: { spec } });
          write(writer, answerSentence(output, t));
          writer.write({ type: "finish" });
        },
      }),
  };
}

/**
 * **What a kept Ask chat stores: the questions, not the data.** An answer's `rows` (and the cap's
 * `truncated`) are cut from its part — the spec, the answer's tile and the clauses it was read under
 * stay — so a stored transcript holds what was asked and never what the data answered. It is
 * `useAskChat`'s default `keep`; the rows come back when the chat is loaded ({@link readKept}).
 */
export const askKeep: KeepPart<AskMessage> = (part) => {
  if (part.type !== "data-answer") return part;
  const rest = { ...part.data };
  delete rest.rows;
  delete rest.truncated;
  return { ...part, data: rest };
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * **A stored Ask chat, with its answers read again.** Each `data-answer` part without `rows` — as
 * {@link askKeep} stores it — is read on the page's engine, under the page's chips as it is now
 * (`readAnswerQuery`). What `stored` is, is untrusted: a part that does not validate is left as it is,
 * for the chat's own validation to refuse. A read that fails fails the load, with what it threw.
 */
export async function readKept(stored: unknown, options: AskChatOptions, client: QueryClient, signal: AbortSignal): Promise<unknown> {
  if (!Array.isArray(stored)) return stored;
  const { engine, graph, selection } = options;
  const again = async (part: unknown) => {
    if (!isObject(part) || part.type !== "data-answer") return part;
    const checked = await ASK_PARTS.answer["~standard"].validate(part.data);
    if (checked.issues || checked.value.rows !== undefined) return part;
    const { answer, spec } = checked.value;
    const output = await readAnswerQuery(client, answer as Answer, answerRelation(answer.relation, graph), { engine, graph, selection, signal });
    return { ...part, data: { ...output, spec } };
  };
  return Promise.all(
    stored.map(async (message) => (isObject(message) && Array.isArray(message.parts) ? { ...message, parts: await Promise.all(message.parts.map(again)) } : message)),
  );
}

/**
 * A chat with Ask over the page: `Chat` draws it, and each `answer` part is an `AnswerCard`. Its reads
 * are queries on the host's `QueryClient`, so it needs a `QueryClientProvider` above it. Given `id`,
 * `load` and `save`, it is kept, its parts validated with Ask's own schemas — and what is kept is
 * structure only: `keep` defaults to {@link askKeep}, and a loaded chat's answers are read again.
 */
export function useAskChat(options: AskChatOptions, chat?: AgentChatOptions<AskMessage>): AgentChat<AskMessage> {
  const client = useQueryClient();
  const latest = React.useRef(options);
  latest.current = options;
  // Ask's parts are read through their own schemas — as they stream, and as a kept chat is loaded.
  const kept = {
    ...chat,
    dataPartSchemas: ASK_PARTS,
    ...(chat?.load && {
      keep: chat.keep ?? askKeep,
      load: async (id: string, read: { signal: AbortSignal }) => readKept(await chat.load!(id, read), latest.current, client, read.signal),
    }),
  } as AgentChatOptions<AskMessage>;
  return useTransportChat((onError) => askTransport(() => latest.current, client, onError), kept);
}

/**
 * Questions to start from: Ask's own proposals with no question asked, each checked by its oracles,
 * whole. `Chat` takes them as they are and sends each one's spec with `askEdit`, so a pill is asked as
 * the spec that was checked, never re-read by the model from its words.
 */
export async function askOffers(
  options: Omit<AskChatOptions, "engine" | "translations"> & { readonly count?: number; readonly signal?: AbortSignal },
): Promise<Proposal<AskSpec>[]> {
  const { model, graph, selection, count = 4, signal } = options;
  const input: AskInput = { question: "", graph, under: underOf(selection) };
  return propose(ask, input, { model, signal, count });
}
