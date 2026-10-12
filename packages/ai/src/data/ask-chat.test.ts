// @vitest-environment node
import { Selection, type Engine } from "@kanzo-tech/mosaic";
import type { InferUIMessageChunk, LanguageModel } from "ai";
import { beforeAll, describe, expect, it } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { answering, NOBEL, TYPES } from "../testing/nobel.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { askEdit, askTransport, type AskChatOptions, type AskMessage } from "./ask-chat.js";
import type { AskSpec } from "./ask.js";
import { readAnswerRelations } from "./relations.js";

type Chunk = InferUIMessageChunk<AskMessage>;

let db: TestDatabase;
beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
});

const user = (id: string, text: string): AskMessage => ({ id, role: "user", parts: [{ type: "text", text }] });

/** One turn through the transport: every chunk it wrote. */
async function turn(options: AskChatOptions, messages: AskMessage[]): Promise<Chunk[]> {
  const stream = await askTransport(() => options).sendMessages({
    trigger: "submit-message",
    chatId: "c",
    messageId: undefined,
    messages,
    abortSignal: new AbortController().signal,
  });
  const chunks: Chunk[] = [];
  const reader = stream.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) chunks.push(read.value as Chunk);
  return chunks;
}

const textOf = (chunks: Chunk[]) => chunks.flatMap((c) => (c.type === "text-delta" ? [c.delta] : [])).join("");

/** An engine with no data: the SQL it was asked, and no rows. */
function empty() {
  const asked: string[] = [];
  const engine = {
    query: async (sql: string) => {
      asked.push(sql);
      return { schema: { fields: [] }, numRows: 0, getChild: () => undefined };
    },
  } as unknown as Pick<Engine, "query">;
  return { engine, asked };
}

describe("askTransport", () => {
  it("answers with the tile the Task's spec is, read on the page's engine, and words written from its rows", async () => {
    const types = await readAnswerRelations(db.coordinator, PEOPLE, [PERSON]);
    const women: AskSpec = { of: "Person", where: [{ field: "Person.gender", in: ["female"] }], show: { kind: "stat", measure: { op: "count" } } };
    const chunks = await turn({ model: answering(women) as LanguageModel, engine: db.engine, graph: PEOPLE, types, selection: Selection.crossfilter() }, [user("1", "How many women?")]);
    expect(chunks.find((c) => c.type === "tool-input-available")).toMatchObject({ toolName: "answer", input: { relation: "Person", where: women.where } });
    expect(chunks.find((c) => c.type === "tool-output-available")).toMatchObject({ output: { rows: [{ count: 3 }], unanswered: [] } });
    expect(textOf(chunks)).toBe("3");
  });

  it("asks which way when two relations answer equally, and reads the one the reader picks", async () => {
    const byCountry: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "Country.name", y: { op: "count" } } };
    const { engine, asked } = empty();
    const options: AskChatOptions = { model: answering(byCountry) as LanguageModel, engine, graph: NOBEL, types: TYPES };
    const first = await turn(options, [user("1", "Prizes by country?")]);
    expect(textOf(first)).toContain("2. LaureateAward>university>University>addressCountry>Country");
    expect(first.some((c) => c.type === "tool-input-available")).toBe(false);

    const kept = first.flatMap((c) => (c.type === "data-ask" ? [{ type: c.type, data: c.data }] : []));
    const second = await turn(options, [user("1", "Prizes by country?"), { id: "2", role: "assistant", parts: kept }, user("3", "2")]);
    expect(second.find((c) => c.type === "tool-input-available")).toMatchObject({ input: { relation: "LaureateAward>university>University>addressCountry>Country" } });
    expect(asked).toHaveLength(1);
  });

  it("asks an edited spec as it is, with no model in between", async () => {
    const types = await readAnswerRelations(db.coordinator, PEOPLE, [PERSON]);
    const men: AskSpec = { of: "Person", where: [{ field: "Person.gender", in: ["male"] }], show: { kind: "stat", measure: { op: "count" } } };
    const model = answering(men);
    const chunks = await turn({ model: model as LanguageModel, engine: db.engine, graph: PEOPLE, types }, [
      { id: "1", role: "user", ...askEdit(men) },
    ]);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(chunks.find((c) => c.type === "tool-output-available")).toMatchObject({ output: { rows: [{ count: 3 }], spec: men } });
  });
});
