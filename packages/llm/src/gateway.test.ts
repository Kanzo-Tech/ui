import { afterEach, describe, expect, it, vi } from "vitest";
import { Output, generateText, jsonSchema, streamText } from "ai";
import { AiError, createGateway } from "./gateway.js";

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

const sse = (chunk: object) => new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);

/**
 * A gateway that goes quiet: `answer` resolves the request's headers, `send` writes one chunk of the
 * body, and neither happens unless the test says so. Like a real `fetch`, an abort fails whatever is
 * pending with the signal's reason.
 */
function quietGateway() {
  let signal: AbortSignal | undefined;
  let answer = () => {};
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fetch = (_: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener("abort", () => {
        reject(signal?.reason);
        body?.error(signal?.reason);
      });
      answer = () =>
        resolve(
          new Response(new ReadableStream<Uint8Array>({ start: (c) => void (body = c) }), {
            headers: { "content-type": "text/event-stream" },
          }),
        );
    });
  return {
    fetch: fetch as typeof globalThis.fetch,
    get signal() {
      return signal;
    },
    answer: () => answer(),
    send: (content: string) => body?.enqueue(sse(delta(content))),
  };
}

function ask(fetch: typeof globalThis.fetch, abortSignal?: AbortSignal) {
  const gateway = createGateway({ baseURL: "http://gw/v1", fetch });
  const seen: { failed?: unknown; text: string } = { text: "" };
  const result = streamText({
    model: gateway("chat"),
    prompt: "hello",
    abortSignal,
    maxRetries: 0,
    onError: ({ error }) => void (seen.failed ??= error),
  });
  void (async () => {
    for await (const part of result.textStream) seen.text += part;
  })().catch((e: unknown) => void (seen.failed ??= e));
  return seen;
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("a model that goes silent", () => {
  afterEach(() => vi.useRealTimers());

  it("ends a stream whose headers do not come within 30 s as ai/silent, and not a millisecond before", async () => {
    vi.useFakeTimers();
    const gw = quietGateway();
    const seen = ask(gw.fetch);
    await advance(29_999);
    expect(seen.failed).toBeUndefined();
    await advance(1);
    expect(seen.failed).toBeInstanceOf(AiError);
    expect(seen.failed).toMatchObject({ code: "ai/silent", data: { after: 30_000 } });
    expect(gw.signal?.aborted).toBe(true);
  });

  it("ends a stream that stops sending mid-way, 30 s after its last chunk", async () => {
    vi.useFakeTimers();
    const gw = quietGateway();
    const seen = ask(gw.fetch);
    await advance(0);
    gw.answer();
    await advance(20_000);
    gw.send("hel");
    await advance(20_000);
    gw.send("lo");
    await advance(29_999);
    expect(seen.text).toBe("hello");
    expect(seen.failed).toBeUndefined();
    await advance(1);
    expect(seen.failed).toMatchObject({ code: "ai/silent", data: { after: 30_000 } });
    expect(gw.signal?.reason).toBeInstanceOf(AiError);
  });

  it("lets the caller's abort stay an abort, and fires nothing after it", async () => {
    vi.useFakeTimers();
    const gw = quietGateway();
    const stop = new AbortController();
    const seen = ask(gw.fetch, stop.signal);
    await advance(0);
    gw.answer();
    gw.send("hi");
    await advance(5_000);
    stop.abort();
    await advance(60_000);
    expect(seen.failed).toBeUndefined();
    expect(gw.signal?.reason).toBe(stop.signal.reason);
  });

  it("does not cut a request that does not stream, whose headers wait on the whole answer", async () => {
    vi.useFakeTimers();
    const fetch = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      return Response.json({
        id: "c",
        object: "chat.completion",
        created: 0,
        model: "complete",
        choices: [{ index: 0, message: { role: "assistant", content: "done" }, finish_reason: "stop" }],
      });
    }) as typeof globalThis.fetch;
    const gateway = createGateway({ baseURL: "http://gw/v1", fetch });
    const answer = generateText({ model: gateway("complete"), prompt: "hello", maxRetries: 0 });
    await advance(60_000);
    expect((await answer).text).toBe("done");
  });
});
