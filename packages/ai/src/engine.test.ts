import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError, useStream } from "./engine.js";

/** A source the test drives: `emit` a value, `fail` with anything, or say nothing at all. */
function subject<T>() {
  const queue: ((r: IteratorResult<T>) => void)[] = [];
  const fails: ((e: unknown) => void)[] = [];
  let seen: AbortSignal | undefined;
  return {
    get signal() {
      return seen;
    },
    source: (signal: AbortSignal): AsyncIterable<T> => {
      seen = signal;
      return {
        [Symbol.asyncIterator]: () => ({
          next: () =>
            new Promise<IteratorResult<T>>((resolve, reject) => {
              queue.push(resolve);
              fails.push(reject);
            }),
        }),
      };
    },
    emit: (value: T) => {
      fails.shift();
      queue.shift()?.({ value, done: false });
    },
    fail: (error: unknown) => {
      queue.shift();
      fails.shift()?.(error);
    },
  };
}

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

afterEach(() => {
  vi.useRealTimers();
});

function started(s: ReturnType<typeof subject<string>>, each: (v: string) => boolean | void = () => {}) {
  const hook = renderHook(() => useStream<string>());
  const run: { outcome?: string } = {};
  act(() => {
    void hook.result.current.run(s.source, each).then((o) => (run.outcome = o));
  });
  return { ...hook, run };
}

describe("a stream that fails", () => {
  it("hands the host the value thrown mid-way, not its message", async () => {
    vi.useFakeTimers();
    const s = subject<string>();
    const { result, run } = started(s);
    const thrown = { code: "llm/refused", data: { model: "m" } };
    s.fail(thrown);
    await advance(0);
    expect(run.outcome).toBe("error");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(thrown);
  });

  it("ends a stream that sends nothing for 30 s as ai/silent, and not a millisecond before", async () => {
    vi.useFakeTimers();
    const s = subject<string>();
    const { result } = started(s);
    await advance(29_999);
    expect(result.current.status).toBe("loading");
    await advance(1);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(AiError);
    expect(result.current.error).toMatchObject({ code: "ai/silent", data: { after: 30_000 } });
    expect(s.signal?.aborted).toBe(true);
  });

  it("restarts the 30 s on every chunk", async () => {
    vi.useFakeTimers();
    const s = subject<string>();
    const { result } = started(s);
    await advance(20_000);
    s.emit("a");
    await advance(20_000);
    expect(result.current.status).toBe("loading");
  });

  it("ends as an error, not loading forever, when the caller's `each` throws", async () => {
    vi.useFakeTimers();
    const s = subject<string>();
    const thrown = new Error("each broke");
    const { result, run } = started(s, () => {
      throw thrown;
    });
    s.emit("a");
    await advance(0);
    expect(run.outcome).toBe("error");
    expect(result.current.error).toBe(thrown);
  });

  it("does not report a cancellation, even from a source that throws the abort", async () => {
    vi.useFakeTimers();
    const s = subject<string>();
    const { result, run } = started(s);
    act(() => result.current.cancel());
    s.fail(new DOMException("aborted", "AbortError"));
    await advance(0);
    expect(run.outcome).toBe("idle");
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
  });
});
