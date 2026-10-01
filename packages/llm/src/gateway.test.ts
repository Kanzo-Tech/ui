import { afterEach, describe, expect, it, vi } from "vitest";
import { Output, jsonSchema, streamText } from "ai";
import { createGateway } from "./gateway.js";

/** A gateway that answers every request with these chat-completion chunks, and records the calls. */
function fakeGateway(chunks: object[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const sse = [...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`), "data: [DONE]\n\n"].join("");
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const delta = (content: string) => ({
  id: "c",
  object: "chat.completion.chunk",
  created: 0,
  model: "chat",
  choices: [{ index: 0, delta: { content }, finish_reason: null }],
});

describe("createGateway", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the gateway by alias, at the host's base URL", async () => {
    vi.stubGlobal("location", new URL("https://ws.keasy.example/jobs/1"));
    const { calls, fetch } = fakeGateway([delta("hi")]);
    const gateway = createGateway({ baseURL: "/api/v1/ai", fetch, headers: { "x-csrf": "1" } });
    const result = streamText({ model: gateway("chat"), prompt: "hello" });
    expect(await result.text).toBe("hi");
    expect(calls[0]?.url).toBe("https://ws.keasy.example/api/v1/ai/chat/completions");
    expect(calls[0]?.body.model).toBe("chat");
  });

  it("lifts a <think> block out of the text and into reasoning", async () => {
    const { fetch } = fakeGateway([delta("<think>the user"), delta(" greets</think>"), delta("Hello!")]);
    const gateway = createGateway({ baseURL: "http://gw/v1", fetch });
    const result = streamText({ model: gateway("chat"), prompt: "hello" });
    expect(await result.text).toBe("Hello!");
    expect(await result.reasoningText).toBe("the user greets");
  });

  it("asks for a JSON schema when a caller wants structured output", async () => {
    const { calls, fetch } = fakeGateway([delta('{"elements":["a","b"]}')]);
    const gateway = createGateway({ baseURL: "http://gw/v1", fetch });
    const result = streamText({
      model: gateway("complete"),
      prompt: "two letters",
      output: Output.array({ element: jsonSchema<string>({ type: "string" }) }),
    });
    expect(await result.output).toEqual(["a", "b"]);
    const format = calls[0]?.body.response_format as { type: string };
    expect(format.type).toBe("json_schema");
  });
});
