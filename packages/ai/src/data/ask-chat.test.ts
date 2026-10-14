// @vitest-environment node
import { Selection, type Engine } from "@kanzo-tech/mosaic";
import { QueryClient } from "@tanstack/react-query";
import type { InferUIMessageChunk, LanguageModel } from "ai";
import { beforeAll, describe, expect, it } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { answering } from "../testing/nobel.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { askEdit, askTransport, type AskChatOptions, type AskMessage } from "./ask-chat.js";
import { ask, type AskSpec } from "./ask.js";
import type { Oracle } from "../task/index.js";

type Chunk = InferUIMessageChunk<AskMessage>;

let db: TestDatabase;
beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
});

const user = (id: string, text: string): AskMessage => ({ id, role: "user", parts: [{ type: "text", text }] });

/** One turn through the transport: every chunk it wrote. */
async function turn(
  options: AskChatOptions,
  messages: AskMessage[],
  page: { client?: QueryClient; signal?: AbortSignal } = {},
): Promise<Chunk[]> {
  const stream = await askTransport(() => options, page.client ?? new QueryClient()).sendMessages({
    trigger: "submit-message",
    chatId: "c",
    messageId: undefined,
    messages,
    abortSignal: page.signal ?? new AbortController().signal,
  });
  const chunks: Chunk[] = [];
  const reader = stream.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) chunks.push(read.value as Chunk);
  return chunks;
}

const textOf = (chunks: Chunk[]) => chunks.flatMap((c) => (c.type === "text-delta" ? [c.delta] : [])).join("");

describe("askTransport", () => {
  it("answers with the tile the Task's spec is, read on the page's engine, and words written from its rows", async () => {
    const women: AskSpec = { of: "Person", where: [{ field: "gender", in: ["female"] }], show: { kind: "stat", measure: { op: "count" } } };
    const chunks = await turn({ model: answering(women) as LanguageModel, engine: db.engine, graph: PEOPLE, selection: Selection.crossfilter() }, [user("1", "How many women?")]);
    // One data part, written twice under one id: the answer as asked, then as read.
    const answers = chunks.filter((c) => c.type === "data-answer");
    expect(answers).toHaveLength(2);
    expect(answers[0]!.id).toBe(answers[1]!.id);
    expect(answers[0]).toMatchObject({ data: { answer: { relation: PERSON, tile: { kind: "stat", where: women.where } }, spec: women } });
    expect("rows" in answers[0]!.data).toBe(false);
    expect(answers[1]).toMatchObject({ data: { rows: [{ Count: 3 }], unanswered: [] } });
    expect(chunks.some((c) => c.type.startsWith("tool-"))).toBe(false);
    expect(textOf(chunks)).toBe("3.");
  });

  it("words a bar chart's leading groups with Intl, ties named together, through its translations", async () => {
    const byGender: AskSpec = { of: "Person", show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } } };
    const options: AskChatOptions = { model: answering(byGender) as LanguageModel, engine: db.engine, graph: PEOPLE, translations: { value: " = ", groups: " | " } };
    expect(textOf(await turn(options, [user("1", "People by gender?")]))).toBe("female and male = 3.");
    const byAge: AskSpec = { of: "Person", show: { kind: "chart", type: "bar", x: "age", y: { op: "count" } }, where: [{ field: "age", between: [40, 60] }] };
    expect(textOf(await turn({ ...options, model: answering(byAge) as LanguageModel }, [user("1", "?")]))).toBe("44 and 52 = 1.");
  });

  it("asks a decision as a data part, and settles it by the option the reply picks, not by its words", async () => {
    // Ask's own oracles raise none since its fields became paths; a Task's oracle may, and this one does.
    const men: AskSpec = { of: "Person", where: [{ field: "gender", in: ["male"] }], show: { kind: "stat", measure: { op: "count" } } };
    const decision = { id: "scope", question: "Count whom?", options: [{ id: "all", label: "Everyone" }, { id: "adults", label: "Adults" }] };
    const oracles = ask.verify as Oracle<unknown, unknown>[];
    oracles.push(() => ({ decision }));
    try {
      const options: AskChatOptions = { model: answering(men) as LanguageModel, engine: db.engine, graph: PEOPLE };
      const first = await turn(options, [user("1", "How many men?")]);
      expect(first.find((c) => c.type === "data-ask")).toMatchObject({ data: { spec: men, decision } });
      expect(textOf(first)).toBe("");
      expect(first.some((c) => c.type === "data-answer")).toBe(false);

      const reply = { id: "3", role: "user" as const, ...askEdit(men, { scope: "adults" }) };
      const second = await turn(options, [user("1", "How many men?"), reply]);
      expect([...second].reverse().find((c) => c.type === "data-answer")).toMatchObject({ data: { rows: [{ Count: 3 }] } });
    } finally {
      oracles.pop();
    }
  });

  it("asks an edited spec as it is, with no model in between", async () => {
    const men: AskSpec = { of: "Person", where: [{ field: "gender", in: ["male"] }], show: { kind: "stat", measure: { op: "count" } } };
    const model = answering(men);
    const chunks = await turn({ model: model as LanguageModel, engine: db.engine, graph: PEOPLE }, [
      { id: "1", role: "user", ...askEdit(men) },
    ]);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(chunks.find((c) => c.type === "data-answer" && "rows" in c.data)).toMatchObject({ data: { rows: [{ Count: 3 }], spec: men } });
  });

  it("reads an answer asked again under the same chips once, on the host's client", async () => {
    const men: AskSpec = { of: "Person", where: [{ field: "gender", in: ["male"] }], show: { kind: "stat", measure: { op: "count" } } };
    const asked: string[] = [];
    const engine: Pick<Engine, "query"> = { query: (sql, options) => (asked.push(sql), db.engine.query(sql, options)) };
    const client = new QueryClient();
    const options: AskChatOptions = { model: answering(men) as LanguageModel, engine, graph: PEOPLE };
    const edited = { id: "1", role: "user" as const, ...askEdit(men) };
    const first = await turn(options, [edited], { client });
    const second = await turn(options, [edited], { client });
    expect(asked).toHaveLength(1);
    for (const chunks of [first, second]) {
      expect(chunks.find((c) => c.type === "data-answer" && "rows" in c.data)).toMatchObject({ data: { rows: [{ Count: 3 }] } });
    }
  });

  it("ends the read with the chat's signal, keeps nothing of it, and reads again when asked again", async () => {
    const men: AskSpec = { of: "Person", where: [{ field: "gender", in: ["male"] }], show: { kind: "stat", measure: { op: "count" } } };
    const signals: AbortSignal[] = [];
    let hold = true;
    const engine: Pick<Engine, "query"> = {
      query: (sql, options) => {
        signals.push(options.signal);
        if (!hold) return db.engine.query(sql, options);
        // A read that lands only when it is stopped: what a slow statement is to the chat.
        return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason)));
      },
    };
    const client = new QueryClient();
    const options: AskChatOptions = { model: answering(men) as LanguageModel, engine, graph: PEOPLE };
    const edited = { id: "1", role: "user" as const, ...askEdit(men) };
    const stop = new AbortController();
    const stopped = turn(options, [edited], { client, signal: stop.signal });
    await expect.poll(() => signals.length).toBe(1);
    stop.abort();
    const chunks = await stopped.catch(() => []);
    expect(signals[0]!.aborted).toBe(true);
    expect(chunks.some((c) => c.type === "data-answer" && "rows" in c.data)).toBe(false);

    hold = false;
    const again = await turn(options, [edited], { client });
    expect(signals).toHaveLength(2);
    expect(again.find((c) => c.type === "data-answer" && "rows" in c.data)).toMatchObject({ data: { rows: [{ Count: 3 }] } });
  });
});
