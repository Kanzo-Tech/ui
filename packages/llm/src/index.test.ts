import { describe, expect, it } from "vitest";
import * as llm from "./index";

describe("@kanzo-tech/llm's barrel", () => {
  /**
   * The AI SDK is imported from `ai` by name, everywhere: a re-export was a second way to write one
   * import (`/docs/design/tasks#where-each-dependency-lives`). Types are erased, so this holds the
   * values; `ToolLoopAgent`, `tool`, `jsonSchema`, `Output` and `DirectChatTransport` were among them.
   *
   * Cannot prove: that no type of the SDK's is re-exported — `index.ts` is short enough to read.
   */
  it("carries the two doors and none of the AI SDK's names", () => {
    expect(Object.keys(llm).sort()).toEqual(["generate", "stream"]);
    for (const name of ["ToolLoopAgent", "tool", "jsonSchema", "Output", "DirectChatTransport", "stepCountIs"]) {
      expect(llm, name).not.toHaveProperty(name);
    }
  });
});
