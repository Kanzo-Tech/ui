import { describe, expect, it } from "vitest";
import {
  type AiMessage,
  type AiMessagePart,
  type AiReasoningPart,
  type AiTaskPart,
  type AiTextPart,
  type AiToolPart,
  isReasoningPart,
  isTaskPart,
  isTextPart,
  isToolPart,
} from "./message-part.js";
import type { MessageTextProps } from "./message-text.js";
import type { ReasoningProps } from "./reasoning.js";
import type { TaskProps } from "./task.js";
import type { ToolProps } from "./tool.js";

/**
 * A union is only worth having if two things hold, and neither is checked by using it.
 *
 * **It has to be exhaustive**, or the promise it makes — *TypeScript tells the host when a case is
 * missing* — is not kept. That is the `never` in `draw` below: add a fifth variant without a case
 * and this file stops compiling, which is the failure arriving where somebody can act on it.
 *
 * **And it has to agree with the components.** A part carries state so a renderer can be told what
 * to draw; the moment `RunState` grows a value the part does not have, or `Tool`'s prop narrows,
 * the wire format is describing components that no longer exist. The assignments below are written
 * in *both* directions on purpose — one direction alone permits one side to widen silently.
 *
 * ## What this cannot prove
 *
 * - **It renders nothing.** Whether `MessageText` actually draws an `AiTextPart` well is
 *   `message-text.test.tsx`'s claim; this only says the shapes fit.
 * - **The type-level half fails at `tsc`, not here.** `pnpm typecheck` is what runs it — a green
 *   vitest run with a broken assignment below is possible, and `pnpm test` alone does not cover it.
 * - **It says nothing about the four variants declined** (`file`, `data-*`, `step-start`,
 *   `dynamic-tool`) or about `source`. Those are absent by decision, and an absence has no test.
 */

// ── The union agrees with the components it describes ────────────────────────
// Both directions, so neither side can widen without the other.
const toolState: ToolProps["state"] = undefined as AiToolPart["state"];
const partToolState: AiToolPart["state"] = undefined as ToolProps["state"];
const taskState: TaskProps["state"] = undefined as AiTaskPart["state"];
const partTaskState: AiTaskPart["state"] = undefined as TaskProps["state"];

// Text and reasoning are the translation the host writes, and it is total: a two-value state maps
// onto the boolean both components take, with no third case to forget.
const textStreaming: MessageTextProps["streaming"] = ("done" as AiTextPart["state"]) === "streaming";
const reasoningStreaming: ReasoningProps["streaming"] =
  ("done" as AiReasoningPart["state"]) === "streaming";

/** The exhaustiveness check. A fifth variant with no case here fails `tsc`, not a reviewer. */
const draw = (part: AiMessagePart): string => {
  switch (part.type) {
    case "text":
      return part.text;
    case "reasoning":
      return part.text;
    case "tool":
      return part.name;
    case "task":
      return part.title;
    default: {
      const missing: never = part;
      return missing;
    }
  }
};

const TURN: AiMessage = {
  id: "ask-1",
  role: "assistant",
  parts: [
    { type: "task", title: "Generating SQL", state: "done" },
    { type: "tool", name: "query", state: "done", input: { table: "sightings" }, output: [] },
    { type: "reasoning", text: "The board files these at night.", state: "done" },
    { type: "text", text: "Most sightings are after dusk.", state: "streaming" },
  ],
};

describe("the message-part union", () => {
  it("renders a whole turn from one switch", () => {
    expect(TURN.parts.map(draw)).toEqual([
      "Generating SQL",
      "query",
      "The board files these at night.",
      "Most sightings are after dusk.",
    ]);
  });

  it("narrows through a filter, which is why the guards exist at all", () => {
    // `part.type === "tool"` narrows inside a switch and does not survive `.filter` — so this is
    // an `AiToolPart[]` without a cast, and `.name` below would not compile otherwise.
    const tools = TURN.parts.filter(isToolPart);
    expect(tools.map((tool) => tool.name)).toEqual(["query"]);

    expect(TURN.parts.filter(isTextPart).map((part) => part.text)).toEqual([
      "Most sightings are after dusk.",
    ]);
    expect(TURN.parts.filter(isReasoningPart)).toHaveLength(1);
    expect(TURN.parts.filter(isTaskPart).map((part) => part.state)).toEqual(["done"]);
  });

  it("keeps each guard to its own variant", () => {
    const text: AiMessagePart = { type: "text", text: "x" };
    expect([isTextPart(text), isReasoningPart(text), isToolPart(text), isTaskPart(text)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("holds the component contract at the type level", () => {
    // The assignments above are the assertion; `tsc` is what runs it. This keeps them alive so a
    // linter cannot drop them as unused, and says out loud that a green run proves nothing here.
    expect([toolState, partToolState, taskState, partTaskState]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect([textStreaming, reasoningStreaming]).toEqual([false, false]);
  });
});
