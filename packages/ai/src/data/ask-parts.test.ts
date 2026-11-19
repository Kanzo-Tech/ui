// @vitest-environment node
import { safeValidateUIMessages } from "ai";
import { describe, expect, it } from "vitest";
import { ASK_PARTS } from "./ask-parts.js";
import type { AskMessage } from "./ask-chat.js";
import { askTile, type AskSpec } from "./ask.js";

const women: AskSpec = { match: [{ as: "person", type: "Person" }], where: [{ field: "person.gender", in: ["female"] }], show: { kind: "stat", measure: { op: "count" } } };

/** A turn of Ask as a kept chat holds it: the question, the answer as it was read, and the turn. */
const kept = (answer: Record<string, unknown>, turn: Record<string, unknown> = { spec: women }) => [
  { id: "1", role: "user", parts: [{ type: "text", text: "How many women?" }] },
  {
    id: "2",
    role: "assistant",
    parts: [
      { type: "data-answer", id: "ask-1", data: answer },
      { type: "data-ask", data: turn },
      { type: "text", text: "42." },
    ],
  },
];

const answer = {
  answer: { pattern: women.match, tile: askTile(women, "ask-1") },
  rows: [{ count: 42 }],
  truncated: false,
  under: [],
  unanswered: [],
  spec: women,
};

const read = (messages: unknown) => safeValidateUIMessages<AskMessage>({ messages, dataSchemas: ASK_PARTS });

describe("Ask's parts, read back", () => {
  it("reads back an answer and its turn as Ask wrote them, and nothing they do not hold", async () => {
    const result = await read(kept({ ...answer, sql: "SELECT 1" }, { spec: women, decided: { which: "a" }, note: "x" }));
    expect(result.success).toBe(true);
    const [, reply] = result.success ? result.data : [];
    const [part, turn] = reply!.parts;
    expect(part).toMatchObject({ type: "data-answer", data: { rows: [{ count: 42 }], spec: women } });
    expect((part as { data: object }).data).not.toHaveProperty("sql");
    expect(turn).toEqual({ type: "data-ask", data: { spec: women, decided: { which: "a" } } });
  });

  it("refuses an answer whose tile a dashboard would not read, or whose pattern is not one", async () => {
    const pie = await read(kept({ ...answer, answer: { ...answer.answer, tile: { ...answer.answer.tile, kind: "pie" } } }));
    expect(pie.success).toBe(false);
    const nowhere = await read(kept({ ...answer, answer: { ...answer.answer, pattern: [{ type: "Person" }, { edge: "knows" }] } }));
    expect(nowhere.success).toBe(false);
    if (!nowhere.success) expect(nowhere.error.message).toContain("answer.pattern");
  });
});
