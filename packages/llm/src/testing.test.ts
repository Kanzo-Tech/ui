import { Output, generateText, jsonSchema, streamText } from "ai";
import { describe, expect, it } from "vitest";
import { promptOf, scriptedModel } from "./testing";

describe("the scripted model", () => {
  it("answers each call with the first turn whose words its prompt holds, and a once turn only once", async () => {
    const model = scriptedModel({
      turns: [
        { when: "Laureate", once: true, reply: { text: "Marie Curie." } },
        { when: "Laureate", reply: { text: "Pierre Curie." } },
        { reply: { object: { elements: [] } } },
      ],
    });
    expect((await generateText({ model, prompt: "Name a Laureate." })).text).toBe("Marie Curie.");
    expect((await generateText({ model, prompt: "Name a Laureate." })).text).toBe("Pierre Curie.");
    const offers = await generateText({
      model,
      prompt: "Offer three.",
      output: Output.object({ schema: jsonSchema<{ elements: string[] }>({ type: "object", properties: { elements: { type: "array" } } }) }),
    });
    expect(offers.output).toEqual({ elements: [] });
    expect(model.doGenerateCalls.map(promptOf)).toEqual(["Name a Laureate.", "Name a Laureate.", "Offer three."]);
  });

  it("streams a word at a time, with its thinking first, and calls a tool for an agent", async () => {
    const model = scriptedModel({ turns: [{ once: true, reply: { tool: "count", input: { of: "Laureate" } } }, { reply: { text: "There are four.", reasoning: "Count them." } }] });
    const call = streamText({ model, prompt: "How many?" });
    expect((await call.toolCalls).map((c) => [c.toolName, c.input])).toEqual([["count", { of: "Laureate" }]]);
    const answer = streamText({ model, prompt: "How many?" });
    const deltas: string[] = [];
    for await (const delta of answer.textStream) deltas.push(delta);
    expect(deltas).toEqual(["There ", "are ", "four."]);
    expect(await answer.reasoningText).toBe("Count them.");
  });

  it("fails a call no turn answers, naming its prompt, and one scripted to fail after its first words", async () => {
    const model = scriptedModel({ turns: [{ when: "stop", reply: { fail: "The device was lost.", after: "There are" } }] });
    await expect(generateText({ model, prompt: "Anything else?", maxRetries: 0 })).rejects.toThrow(/no turn for: Anything else\?/);
    let failed: unknown;
    const cut = streamText({ model, prompt: "Count, then stop.", onError: ({ error }) => void (failed = error) });
    let text = "";
    for await (const delta of cut.textStream) text += delta;
    expect(text).toBe("There are");
    expect(failed).toMatchObject({ message: "The device was lost." });
  });

  it("never answers a call scripted to hang, until it is stopped", async () => {
    const model = scriptedModel({ turns: [{ reply: { hang: true } }] });
    const stop = new AbortController();
    const call = generateText({ model, prompt: "?", abortSignal: stop.signal, maxRetries: 0 });
    await new Promise((settle) => setTimeout(settle, 20));
    stop.abort(new Error("stopped"));
    await expect(call).rejects.toThrow("stopped");
  });

  it("answers with a test's own function of the call, when what it says is computed", async () => {
    const model = scriptedModel({ turns: (call, index) => ({ text: `${index}: ${promptOf(call).length}` }) });
    expect((await generateText({ model, prompt: "abc" })).text).toBe("0: 3");
  });
});
